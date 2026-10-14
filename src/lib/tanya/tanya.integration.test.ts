// Tanya Rona (Fase 8C), integrasi di database uji: lacak di chat (cocok, tidak cocok, sudah masuk), ongkir dan info
// cabang, kuis percakapan sampai profil lalu rutinitas, batas pemakaian bersama, fallback tanpa AI, dan link video
// (mock) termasuk catatan diagnosis di ai_logs. Model tidak pernah menerima data pesanan.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { aiConfig, aiModel } from "@/lib/ai";
import { mockOembedFetch, type FetchLike } from "@/lib/ai/oembed";
import { checkChatLimit, checkDailyFeatureLimit, checkSharedBuyerLimit, LIMITS, SHARED_LIMIT_MESSAGE } from "@/lib/ai/usage";
import { PESAN_TIDAK_COCOK } from "@/lib/orders/lacak";
import { isProfileUsable, quizToProfile } from "@/lib/skin/profile";
import { cocok, skema } from "@/lib/validasi";
import type { Kartu } from "./kartu";
import { jawabTanya, type TanyaDeps } from "./otak";

const user = (text: string) => ({ history: [{ role: "user" as const, text }] });
const jenis = (k: Kartu[]) => k.map((x) => x.jenis);

describe.skipIf(!dbUrl)("Tanya Rona satu pintu (integrasi)", () => {
  const t = integration();
  const { db, sql } = t;
  const tag = `uji-tanya-${process.pid}`;
  const cfgNoAi = aiConfig({});
  const cfgMock = aiConfig({ AI_PROVIDER: "mock" });
  const mock = aiModel("aiPembeli", cfgMock)!;
  let variantId = 0;
  const deps = (over: Partial<TanyaDeps> = {}): TanyaDeps => ({ db, now: new Date(), cfg: cfgNoAi, model: null, modelFoto: null, visitorHash: tag, ipKey: tag, customerId: null, profile: null, sleep: async () => {}, ...over });

  beforeAll(async () => {
    variantId = (await t.variant("pualam-velvet-matte-cushion-spf-50")).id;
    await t.setStock(variantId, await t.location("gudang-online"), 30);
  });
  afterAll(async () => {
    await db.execute(sql`delete from ai_logs where visitor_hash like ${`${tag}%`}`);
    await db.execute(sql`delete from rate_limits where key like ${`%${tag}%`} or key like 'lacak:nomor:%'`);
    await t.cleanup();
  });

  it("lacak di chat: nomor WA cocok, tidak cocok, pembeli yang masuk, dan tanpa nomor", async () => {
    const c = await t.customer();
    const lain = await t.customer();
    const o = await t.order({ items: [{ variantId, quantity: 1 }], buyer: { name: c.name, phone: c.phone, customerId: c.id } });

    const salah = await jawabTanya(deps(), user(`cek ${o.number} wa 089911112222`));
    expect(salah).toMatchObject({ jalur: "aturan", teks: PESAN_TIDAK_COCOK });
    expect(jenis(salah.kartu)).toEqual(["form_lacak"]);

    const benar = await jawabTanya(deps({ model: mock, cfg: cfgMock }), user(`lacak ${o.number} nomor wa ${c.phone}`));
    expect(benar.jalur).toBe("aturan");
    expect(benar.toolCalls).toEqual([]); // model tidak dipanggil, jadi tidak pernah melihat data pesanan
    const k = benar.kartu[0];
    expect(k).toMatchObject({ jenis: "pesanan", data: { nomor: o.number, statusLabel: "Menunggu Pembayaran", jumlahBarang: 1 } });
    // Tanpa data pribadi: nama, nomor WA, dan alamat tidak ada di kartu.
    expect(JSON.stringify(k)).not.toContain(c.phone);
    expect(JSON.stringify(k)).not.toMatch(/Pembeli Uji|Jl\. Uji/);

    const masuk = await jawabTanya(deps({ customerId: c.id }), { history: [], aksi: { jenis: "lacak", nomor: o.number } });
    expect(jenis(masuk.kartu)).toEqual(["pesanan"]);
    const bukanMilik = await jawabTanya(deps({ customerId: lain.id }), { history: [], aksi: { jenis: "lacak", nomor: o.number } });
    expect(jenis(bukanMilik.kartu)).toEqual(["form_lacak"]);
    expect(bukanMilik.teks).toMatch(/tidak ada di akunmu/);

    const tanpaNomor = await jawabTanya(deps(), user("lacak pesananku"));
    expect(tanpaNomor.kartu[0]).toMatchObject({ jenis: "form_lacak", masuk: false });
    const tanpaNomorMasuk = await jawabTanya(deps({ customerId: c.id }), user("pesananku sudah sampai mana?"));
    expect(tanpaNomorMasuk.kartu[0]).toMatchObject({ jenis: "form_lacak", masuk: true, pesanan: [{ nomor: o.number }] });
  });

  it("ongkir ke kota, kota ambigu, kota tak dikenal, dan info cabang", async () => {
    const bdg = await jawabTanya(deps(), user("ongkir ke Bandung berapa?"));
    const ongkir = bdg.kartu[0];
    expect(ongkir).toMatchObject({ jenis: "ongkir", data: { kota: "Kota Bandung", zona: "Jawa lainnya", beratGram: 500 } });
    if (ongkir.jenis === "ongkir") {
      expect(ongkir.data.opsi.length).toBeGreaterThan(0);
      expect(ongkir.data.opsi.every((x) => x.harga > 0 && x.eta)).toBe(true);
      expect(ongkir.data.ambilDiToko).toBe(false);
    }
    expect(jenis((await jawabTanya(deps(), user("ongkir ke malang"))).kartu)).toEqual(["pilih_kota"]);
    const tidak = await jawabTanya(deps(), user("ongkos kirim ke Atlantis"));
    expect(tidak.teks).toMatch(/belum mengenal kota "Atlantis"/);
    expect(jenis(tidak.kartu)).toEqual(["pilih_kota"]);
    const malang = await jawabTanya(deps(), { history: [], aksi: { jenis: "ongkir", kode: "35.73" } });
    expect(malang.kartu[0]).toMatchObject({ jenis: "ongkir", data: { zona: "Dalam kota Malang", ambilDiToko: true } });

    const dinoyo = await jawabTanya(deps(), user("jam buka cabang dinoyo"));
    expect(dinoyo.kartu[0]).toMatchObject({ jenis: "cabang", cabang: [{ slug: "dinoyo" }] });
    const semua = await jawabTanya(deps(), { history: [], aksi: { jenis: "cabang" } });
    if (semua.kartu[0].jenis === "cabang") {
      expect(semua.kartu[0].cabang.length).toBe(3);
      for (const c of semua.kartu[0].cabang) {
        expect(c.hariIni).toMatch(/^(Buka \d|Tutup)/);
        expect(c.rute).toMatch(/^https:\/\/www\.google\.com\/maps\//);
      }
    }
  });

  it("kuis percakapan sampai profil, lalu rutinitas dengan subtotal", async () => {
    const mulai = await jawabTanya(deps(), user("bantu aku pilih skincare"));
    expect(mulai.kartu[0]).toMatchObject({ jenis: "kuis", foto: false, awal: {} });
    // Jawaban kuis di chat memakai skema dan konversi yang sama dengan halaman Kuis Kulit.
    const jawaban = { skinType: "berminyak", concerns: ["jerawat"], sensitivity: "sedang", budget: 150_000, depth: 3, undertone: "neutral", routine: "dasar" };
    expect(cocok(skema.kuis, jawaban)).toBeTruthy();
    const profile = quizToProfile(jawaban, new Date());
    expect(isProfileUsable(profile)).toBe(true);
    const r = await jawabTanya(deps({ profile }), { history: [], aksi: { jenis: "rutinitas" } });
    const kartu = r.kartu[0];
    expect(kartu.jenis).toBe("rutinitas");
    if (kartu.jenis === "rutinitas") {
      expect(kartu.data.pagi.length).toBeGreaterThan(1);
      expect(kartu.data.inti.map((s) => s.key)).toEqual(["pembersih", "pelembap", "sunscreen"]);
      expect(kartu.data.ringkasan).toMatch(/berminyak/);
    }
    const ulang = await jawabTanya(deps({ profile }), { history: [], aksi: { jenis: "kuis" } });
    expect(ulang.kartu[0]).toMatchObject({ jenis: "kuis", awal: { skinType: "berminyak", budget: 150_000 } });
    expect(jenis((await jawabTanya(deps(), { history: [], aksi: { jenis: "rutinitas" } })).kartu)).toEqual(["kuis"]);
  });

  it("batas pemakaian bersama: habis untuk AI pembeli, kemampuan berbasis aturan tetap jalan", async () => {
    const hash = `${tag}-batas`;
    const features = ["advisor", "dupe", "foto_kulit", "padanan_shade"];
    await db.insert(t.schema.aiLogs).values(Array.from({ length: LIMITS.pembeliPerDay }, (_, i) => ({ feature: features[i % features.length], model: "mock", latencyMs: 10, ok: true, visitorHash: hash })));
    const now = new Date();
    expect((await checkSharedBuyerLimit(db, hash, now)).ok).toBe(false);
    expect(await checkChatLimit(db, cfgMock, hash, now)).toMatchObject({ ok: false, message: SHARED_LIMIT_MESSAGE });
    expect((await checkDailyFeatureLimit(db, cfgMock, hash, "dupe", 100, now, "cari dari video")).ok).toBe(false);
    // Batas staf terpisah dari batas pembeli.
    expect((await checkDailyFeatureLimit(db, cfgMock, hash, "asisten", 100, now, "Asisten Admin")).ok).toBe(true);
    const ai = await jawabTanya(deps({ model: mock, cfg: cfgMock, visitorHash: hash }), user("Sunscreen buat kulit berminyak di bawah 100 ribu"));
    expect(ai).toMatchObject({ jalur: "batas", teks: SHARED_LIMIT_MESSAGE });
    expect(ai.chips.map((c) => c.aksi.jenis)).toEqual(expect.arrayContaining(["ongkir", "lacak", "shade"]));
    const aturan = await jawabTanya(deps({ model: mock, cfg: cfgMock, visitorHash: hash }), user("ongkir ke Surabaya"));
    expect(aturan.jalur).toBe("aturan");
    expect(jenis(aturan.kartu)).toEqual(["ongkir"]);
  });

  it("tanpa AI: kuis, padanan shade, lacak, dan ongkir jalan; pertanyaan bebas dan video diarahkan dengan sopan", async () => {
    const bebas = await jawabTanya(deps(), user("Sunscreen buat kulit berminyak di bawah 100 ribu"));
    expect(bebas.jalur).toBe("tanpa_ai");
    expect(bebas.kartu[0]).toMatchObject({ jenis: "info", tautan: { href: expect.stringMatching(/^\/cari\?q=Sunscreen/) } });
    expect(bebas.chips.some((c) => c.aksi.jenis === "video")).toBe(false);
    expect((await jawabTanya(deps(), user("ini ada? https://vt.tiktok.com/ZSdemo0001/"))).teks).toMatch(/butuh AI/);
    expect(jenis((await jawabTanya(deps(), user("https://www.instagram.com/reel/abc/ yang ini"))).kartu)).toEqual(["unggah"]);
    const shade = await jawabTanya(deps(), user("Aku pakai Pualam Velvet Matte Cushion 02N, yang setara apa?"));
    const k = shade.kartu[0];
    expect(k.jenis).toBe("shade");
    if (k.jenis === "shade") {
      expect(k.hasil).toHaveLength(3);
      expect(k.hasil.every((h) => h.produk.varianPilihan && h.alasan)).toBe(true);
    }
    expect(jenis((await jawabTanya(deps(), user("aku pakai cushion merek lain, padanannya apa?"))).kartu)).toEqual(["pilih_shade"]);
  });

  it("link video lewat chat (mock): kartu dupe, hasil baca link dicatat; kegagalan menawarkan screenshot", async () => {
    const d = deps({ model: mock, modelFoto: aiModel("aiFotoLink", cfgMock), cfg: cfgMock, fetchImpl: mockOembedFetch, skipLimits: true, skipCache: true, visitorHash: `${tag}-link` });
    const r = await jawabTanya(d, user("ada yang mirip ini ga https://vt.tiktok.com/ZSdemo0001/ buat kondangan"));
    expect(r.jalur).toBe("link");
    const dupe = r.kartu[0];
    expect(dupe).toMatchObject({ jenis: "dupe", tipe: "mirip", sumber: { platform: "tiktok", author: "Demo Kreator" } });
    if (dupe.jenis === "dupe") expect(dupe.produk).toHaveLength(3);
    const tolak: FetchLike = async (url) => (new URL(url).pathname === "/oembed" ? new Response("overload-protect triggered", { status: 503 }) : new Response("<html>Please wait <p class=\"_wafchallengeid\"></p></html>", { status: 200 }));
    const gagal = await jawabTanya({ ...d, fetchImpl: tolak, visitorHash: `${tag}-gagal` }, user("https://www.tiktok.com/@a/video/7300000000000000009"));
    expect(gagal.teks).toMatch(/screenshot/);
    expect(jenis(gagal.kartu)).toEqual(["unggah"]);
    const logs = (await db.execute(sql`select model, ok, error from ai_logs where feature = 'link_video' and visitor_hash like ${`${tag}-%`} order by id`)) as unknown as { model: string; ok: boolean; error: string | null }[];
    expect(logs).toEqual([
      { model: "oembed", ok: true, error: null },
      { model: "gagal", ok: false, error: "tahap=halaman status=200 kode=ditolak percobaan=6" },
    ]);
  });
});
