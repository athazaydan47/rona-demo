// AI dan fungsi katalog terhadap database lokal: filter katalog, padanan shade, rutinitas, validasi Advisor dengan
// model tiruan, batas pemakaian per pengunjung dan global, fallback tafsiran saat AI gagal atau lambat, cache
// ringkasan ulasan berbasis hash, dan atribusi item dari Advisor. Data uji dibersihkan di akhir.
import { afterAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { addItems, createCart } from "@/lib/cart/service";
import { cariProduk, cekStok, detailProduk, padananShade, susunRutinitas } from "@/lib/catalog/tools";
import { placeOrder, type PlaceOrderInput } from "@/lib/orders/service";
import { runAdvisor } from "./advisor";
import { aiConfig, type AiModel, type GenRequest, type GenResponse, type Part } from "./client";
import { interpretQuery, normalizeQuery } from "./interpret";
import { createMockModel } from "./mock";
import { refreshReviewSummary } from "./review-summary";
import { checkChatLimit, LIMITS } from "./usage";

const fnCall = (name: string, args: Record<string, unknown>): Part => ({ functionCall: { name, args } });
const respond = (parts: Part[]): GenResponse => ({ content: { role: "model", parts }, text: parts.map((p) => p.text ?? "").join(""), functionCalls: parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} })), usage: { input: 100, output: 20 }, model: "tiruan" });

// Model tiruan yang menjalankan naskah giliran demi giliran.
function scripted(turns: ((req: GenRequest) => Part[])[]): AiModel & { calls: number } {
  const m = {
    name: "tiruan",
    calls: 0,
    async generate(req: GenRequest) {
      const t = turns[Math.min(m.calls, turns.length - 1)];
      m.calls++;
      return respond(t(req));
    },
  };
  return m;
}
const lastToolResult = (req: GenRequest) => req.contents[req.contents.length - 1].parts.find((p) => p.functionResponse)?.functionResponse?.response as Record<string, unknown>;

describe.skipIf(!dbUrl)("AI dan fungsi katalog (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, inArray } = t;
  const now = new Date();
  const visitor = `uji-${Date.now().toString(36)}`;

  afterAll(async () => {
    await db.delete(schema.aiLogs).where(t.sql`${schema.aiLogs.visitorHash} like ${`${visitor}%`}`);
    await db.delete(schema.aiCache).where(t.sql`${schema.aiCache.key} like 'tafsir:%' and ${schema.aiCache.feature} = 'uji'`);
    await t.cleanup();
  });

  describe("fungsi katalog", () => {
    it("cariProduk: kategori dan harga maksimal memakai harga efektif", async () => {
      const r = await cariProduk(db, { kategori: "sunscreen-wajah", hargaMaks: 80_000 }, now);
      expect(r.length).toBeGreaterThan(0);
      for (const p of r) {
        expect(p.kategoriSlug).toBe("sunscreen-wajah");
        expect(p.harga).toBeLessThanOrEqual(80_000);
        expect(p.varianCocok.every((v) => v.harga <= 80_000)).toBe(true);
      }
    });
    it("cariProduk: induk kategori, jenis kulit, lokasi, teks, dan promo", async () => {
      const skincare = await cariProduk(db, { kategori: "skincare", jenisKulit: "sensitif", batas: 10 }, now);
      expect(skincare.length).toBeGreaterThan(0);
      const dinoyo = await cariProduk(db, { lokasi: "dinoyo", kategori: "lip-tint" }, now);
      for (const p of dinoyo) {
        const s = await cekStok(db, p.varianCocok[0].id, "dinoyo");
        expect(s!.lokasi[0].tersedia).toBeGreaterThan(0);
        expect(p.cabangDenganStok).toContain("Rona Dinoyo");
      }
      const teks = await cariProduk(db, { teks: "cushion" }, now);
      expect(teks[0].nama.toLowerCase()).toContain("cushion");
      expect(await cariProduk(db, { teks: "zzqx tidak ada sama sekali" }, now)).toEqual([]);
    });
    it("detailProduk dan cekStok membaca data server", async () => {
      const [first] = await cariProduk(db, { kategori: "cushion" }, now);
      const d = await detailProduk(db, first.id, now);
      expect(d).toMatchObject({ id: first.id, nama: first.nama });
      expect(d!.varianCocok.length).toBeGreaterThan(1);
      const s = await cekStok(db, d!.varianCocok[0].id);
      expect(s!.lokasi.length).toBe(4);
      expect(s!.produkId).toBe(first.id);
      expect(await detailProduk(db, 999_999, now)).toBeNull();
    });
    it("padananShade: 3 shade terdekat dari produk lain di kategori yang sama", async () => {
      const [cushion] = await cariProduk(db, { kategori: "cushion" }, now);
      const d = await detailProduk(db, cushion.id, now);
      const r = await padananShade(db, d!.varianCocok[0].id, now);
      expect(r.hasil).toHaveLength(3);
      expect(r.hasil.every((h) => h.produkId !== cushion.id)).toBe(true);
      expect(r.hasil.map((h) => h.skor)).toEqual([...r.hasil.map((h) => h.skor)].sort((a, b) => a - b));
      expect(r.hasil[0].alasan).toMatch(/undertone/);
    });
    it("susunRutinitas dari katalog sungguhan", async () => {
      const r = await susunRutinitas(db, { skinType: "berminyak", concerns: ["jerawat"], budget: 150_000 }, 150_000, now);
      expect(r.pagi.length).toBeGreaterThanOrEqual(4);
      expect(r.malam.length).toBeGreaterThanOrEqual(4);
      expect(r.pagi.at(-1)!.key).toBe("sunscreen");
      expect(r.total).toBeGreaterThan(0);
    });
  });

  describe("validasi Advisor", () => {
    it("id di luar hasil tool ditolak dan jawaban dibuat ulang sekali", async () => {
      const [outside] = await cariProduk(db, { kategori: "eau-de-parfum" }, now);
      const model = scripted([
        () => [fnCall("cariProduk", { kategori: "sunscreen-wajah" })],
        (req) => {
          const hasil = (lastToolResult(req).hasil as { id: number }[]).map((h) => h.id);
          return [fnCall("jawab", { teks: "Ini pilihannya.", produkIds: [hasil[0], outside.id] })];
        },
        (req) => {
          expect(String(JSON.stringify(lastToolResult(req)))).toMatch(/ditolak/);
          return [fnCall("jawab", { teks: "Ini sunscreen yang cocok.", produkIds: [] })];
        },
      ]);
      const r = await runAdvisor(db, model, { history: [{ role: "user", text: "sunscreen dong" }], now });
      expect(r.regenerated).toBe(true);
      expect(r.productIds).toEqual([]);
      expect(r.text).toBe("Ini sunscreen yang cocok.");
      expect(model.calls).toBe(3);
    });
    it("nama produk katalog yang tidak ada di hasil tool dibuang dari teks bila tetap muncul", async () => {
      const [other] = await cariProduk(db, { kategori: "eau-de-parfum" }, now);
      let h: { id: number; nama: string } | null = null;
      const model = scripted([
        () => [fnCall("cariProduk", { kategori: "toner" })],
        (req) => {
          h ??= (lastToolResult(req).hasil as { id: number; nama: string }[])[0];
          // Tetap menyebut produk di luar hasil tool, juga setelah diminta menulis ulang.
          return [fnCall("jawab", { teks: `Pakai ${h.nama}. Atau ${other.nama} juga bagus.`, produkIds: [h.id] })];
        },
      ]);
      const r = await runAdvisor(db, model, { history: [{ role: "user", text: "toner" }], now });
      expect(r.regenerated).toBe(true);
      expect(r.text).not.toContain(other.nama);
      expect(r.text).toContain(h!.nama);
      expect(r.productIds).toHaveLength(1);
    });
    it("model mock: kartu produk berasal dari hasil tool dan harga server", async () => {
      const r = await runAdvisor(db, createMockModel(), { history: [{ role: "user", text: "Sunscreen untuk kulit berminyak di bawah 100 ribu" }], now });
      expect(r.toolCalls).toEqual(["cariProduk", "jawab"]);
      const list = await cariProduk(db, { kategori: "sunscreen-wajah", jenisKulit: "berminyak", hargaMaks: 100_000 }, now);
      expect(r.productIds).toEqual(list.slice(0, 3).map((p) => p.id));
    });
    it("AI gagal: jawaban ramah, tidak melempar galat", async () => {
      const broken: AiModel = { name: "rusak", generate: async () => Promise.reject(new Error("HTTP 503")) };
      const r = await runAdvisor(db, broken, { history: [{ role: "user", text: "halo" }], now });
      expect(r).toMatchObject({ ok: false, productIds: [] });
      expect(r.text).toMatch(/tidak bisa dihubungi/);
    });
  });

  describe("batas pemakaian", () => {
    const log = (hash: string, feature: string, at: Date, n: number) => db.insert(schema.aiLogs).values(Array.from({ length: n }, () => ({ feature, model: "uji", visitorHash: hash, createdAt: at })));
    it("per menit dan per hari (DEMO_MODE) per pengunjung", async () => {
      const cfg = { ...aiConfig({ AI_PROVIDER: "mock", DEMO_MODE: "true" }), dailyCap: 1_000_000 };
      const a = `${visitor}-a`;
      expect(await checkChatLimit(db, cfg, a, now)).toEqual({ ok: true });
      await log(a, "advisor", new Date(now.getTime() - 10_000), LIMITS.chatPerMinute);
      expect(await checkChatLimit(db, cfg, a, now)).toMatchObject({ ok: false, reason: "menit" });
      const b = `${visitor}-b`;
      await log(b, "advisor", new Date(now.getTime() - 5 * 60_000), LIMITS.chatPerDayDemo);
      expect(await checkChatLimit(db, cfg, b, now)).toMatchObject({ ok: false, reason: "harian" });
      // Di luar DEMO_MODE batas harian per pengunjung tidak berlaku.
      expect(await checkChatLimit(db, { ...cfg, demoMode: false }, b, now)).toEqual({ ok: true });
    });
    it("batas global harian dari AI_DAILY_CAP", async () => {
      const [{ n }] = (await db.execute(t.sql`select count(*)::int as n from ai_logs where created_at >= ${new Date(now.getTime() - 86_400_000).toISOString()}::timestamptz and feature <> 'eval'`)) as unknown as { n: number }[];
      const cfg = { ...aiConfig({ AI_PROVIDER: "mock" }), dailyCap: Math.max(1, Number(n)) };
      expect(await checkChatLimit(db, cfg, `${visitor}-c`, now)).toMatchObject({ ok: false, reason: "global" });
    });
  });

  describe("tafsiran pencarian", () => {
    it("AI lambat: kembali null dalam anggaran waktu, pencarian biasa dipakai", async () => {
      const slow: AiModel = { name: "lambat", generate: () => new Promise(() => {}) };
      const t0 = Date.now();
      expect(await interpretQuery(db, slow, "lipstik yang tahan lama buat kondangan uji lambat", now, { budgetMs: 400, visitorHash: `${visitor}-t` })).toBeNull();
      expect(Date.now() - t0).toBeLessThan(1500);
    });
    it("AI gagal atau jawaban rusak: null", async () => {
      const broken: AiModel = { name: "rusak", generate: async () => Promise.reject(new Error("HTTP 500")) };
      expect(await interpretQuery(db, broken, "sunscreen yang ga lengket uji gagal", now, { visitorHash: `${visitor}-t` })).toBeNull();
      const junk = scripted([() => [{ text: "bukan json" }]]);
      expect(await interpretQuery(db, junk, "serum yang bikin glowing uji rusak", now, { visitorHash: `${visitor}-t` })).toBeNull();
    });
    it("hasil disimpan di cache: kueri yang sama tidak memanggil AI lagi", async () => {
      const q = `lipstik yang ga bikin kering buat kondangan ${visitor}`;
      const model = scripted([() => [{ text: JSON.stringify({ kategori: "lipstick", merek: [], jenisKulit: [], masalah: [], finish: ["satin"], undertone: [], spf: false, hargaMaks: 0, atribut: ["melembapkan"], kataKunci: "" }) }]]);
      const first = await interpretQuery(db, model, q, now, { visitorHash: `${visitor}-t` });
      expect(first).toMatchObject({ source: "ai", interpretation: { kategori: "lipstick", finish: ["satin"], atribut: ["melembapkan"] } });
      const second = await interpretQuery(db, model, `  ${q.toUpperCase()}!! `, now, { visitorHash: `${visitor}-t` });
      expect(second?.source).toBe("cache");
      expect(model.calls).toBe(1);
      const [log] = await db.select().from(schema.aiLogs).where(eq(schema.aiLogs.visitorHash, `${visitor}-t`)).orderBy(t.sql`${schema.aiLogs.id} desc`).limit(1);
      expect(log.query).toBe(normalizeQuery(q));
    });
  });

  it("ringkasan ulasan dibuat ulang hanya bila hash daftar ulasan berubah", async () => {
    const [{ productId }] = (await db.execute(t.sql`select product_id as "productId" from reviews where status = 'tampil' group by product_id having count(*) >= 6 order by product_id limit 1`)) as unknown as { productId: number }[];
    const [before] = await db.select().from(schema.reviewSummaries).where(eq(schema.reviewSummaries.productId, productId));
    await db.delete(schema.reviewSummaries).where(eq(schema.reviewSummaries.productId, productId));
    const mock = createMockModel();
    expect(await refreshReviewSummary(db, mock, productId, now)).toBe("dibuat");
    expect(await refreshReviewSummary(db, mock, productId, now)).toBe("sama");
    const [r] = await db.select({ id: schema.reviews.id }).from(schema.reviews).where(t.and(eq(schema.reviews.productId, productId), eq(schema.reviews.status, "tampil"))).limit(1);
    await db.update(schema.reviews).set({ status: "sembunyi" }).where(eq(schema.reviews.id, r.id));
    try {
      expect(await refreshReviewSummary(db, mock, productId, now)).toBe("dibuat");
      const [s] = await db.select().from(schema.reviewSummaries).where(eq(schema.reviewSummaries.productId, productId));
      expect(s.reviewCount).toBeGreaterThanOrEqual(5);
    } finally {
      await db.update(schema.reviews).set({ status: "tampil" }).where(eq(schema.reviews.id, r.id));
      await db.delete(schema.reviewSummaries).where(eq(schema.reviewSummaries.productId, productId));
      if (before) await db.insert(schema.reviewSummaries).values(before);
    }
    // Tanpa AI tidak ada ringkasan baru (halaman produk tidak pernah memicu pembuatan).
    expect(await refreshReviewSummary(db, null, productId, now)).toBe("gagal");
  });

  it("atribusi: item dari Advisor tercatat bersumber advisor di keranjang dan order_items", async () => {
    const picks = (await cariProduk(db, { kategori: "toner" }, now)).filter((p) => p.stokOnline > 2).slice(0, 2);
    const cart = await createCart(db);
    t.carts.push(cart.id);
    expect((await addItems(db, cart.id, [{ variantId: picks[0].varianCocok[0].id, quantity: 1 }], { source: "advisor" })).ok).toBe(true);
    expect((await addItems(db, cart.id, [{ variantId: picks[1].varianCocok[0].id, quantity: 1 }])).ok).toBe(true);
    const [ci] = await db.select({ source: schema.cartItems.source }).from(schema.cartItems).where(t.and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.variantId, picks[0].varianCocok[0].id)));
    expect(ci.source).toBe("advisor");
    const base: PlaceOrderInput = { cartId: cart.id, buyer: { name: "Uji Atribusi", phone: t.phone() }, method: "kirim", address: { recipient: "Uji", phone: "081300000000", province: "Jawa Timur", city: "Kota Malang", district: "Lowokwaru", postalCode: "65145", street: "Jl. Uji 1" }, zone: "dalam_kota", courierCode: "jne_reg", paymentMethod: "qris", expectedTotal: -1 };
    const probe = await placeOrder(db, base);
    const placed = await placeOrder(db, { ...base, expectedTotal: probe.ok ? -1 : probe.pricing!.total });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    t.orders.push(placed.number);
    const [o] = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.number, placed.number));
    const items = await db.select({ variantId: schema.orderItems.variantId, source: schema.orderItems.source }).from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
    expect(Object.fromEntries(items.map((i) => [i.variantId, i.source]))).toEqual({ [picks[0].varianCocok[0].id]: "advisor", [picks[1].varianCocok[0].id]: null });
    void inArray;
  });
});
