// Fase 7C (murni): skema dan validasi foto kuis (kolom terlarang ditolak), usulan kuis (keyakinan rendah tidak
// diisi), pengambil oEmbed (daftar izin, redirect, batas waktu, ukuran, SSRF), pencocokan dupe beserta alasannya,
// dan tidak ada jalur penyimpanan untuk foto.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { CatalogItem, CatalogVariant } from "@/lib/catalog/filters";
import { matchDupe, pickAlternatives, validateExtraction, type DupeExtraction } from "./dupe";
import { sniffImageType } from "./images";
import { classifyLink, FETCH_HOSTS, fetchOembed, guardedFetch, type FetchLike } from "./oembed";
import { SKIN_PHOTO_FIELDS, SKIN_PHOTO_SCHEMA, suggestionFromPhoto, validateSkinPhoto } from "./skin-photo";

const ok = (nilai: unknown, keyakinan = "tinggi") => ({ nilai, keyakinan });
const reading = (over: Record<string, unknown> = {}) => ({ kualitas: "cukup", kilap: ok("jelas"), kering: ok("tidak"), kemerahan: ok("sedikit"), noda: ok("ada"), kedalaman: ok(4), undertone: ok("warm"), ...over });

describe("foto kuis: skema ketat", () => {
  it("skema hanya berisi kolom pengamatan, tanpa kolom teks bebas", () => {
    expect(Object.keys(SKIN_PHOTO_SCHEMA.properties!).sort()).toEqual([...SKIN_PHOTO_FIELDS].sort());
    const strings = JSON.stringify(SKIN_PHOTO_SCHEMA);
    expect(strings).not.toMatch(/diagnos|usia|umur|gender|kelamin|etnis|ras"|saran|obat/);
    // Setiap kolom STRING punya enum (tidak ada tempat untuk teks bebas).
    const walk = (s: { type: string; enum?: string[]; properties?: Record<string, unknown>; items?: unknown }): boolean =>
      (s.type !== "STRING" || Boolean(s.enum?.length)) && Object.values(s.properties ?? {}).every((p) => walk(p as never)) && (!s.items || walk(s.items as never));
    expect(walk(SKIN_PHOTO_SCHEMA as never)).toBe(true);
  });
  it("keluaran valid diterima", () => {
    expect(validateSkinPhoto(reading())).toMatchObject({ kualitas: "cukup", kedalaman: { nilai: 4, keyakinan: "tinggi" } });
  });
  it("kolom terlarang atau di luar skema membuat seluruh keluaran ditolak", () => {
    expect(validateSkinPhoto(reading({ diagnosis: "akne vulgaris" }))).toBeNull();
    expect(validateSkinPhoto(reading({ usia: 25 }))).toBeNull();
    expect(validateSkinPhoto(reading({ jenisKelamin: "perempuan" }))).toBeNull();
    expect(validateSkinPhoto(reading({ saran: "pakai salep" }))).toBeNull();
    expect(validateSkinPhoto(reading({ noda: { nilai: "ada", keyakinan: "tinggi", jenis: "kistik" } }))).toBeNull();
    expect(validateSkinPhoto(reading({ kedalaman: ok(7) }))).toBeNull();
    expect(validateSkinPhoto(reading({ kilap: ok("berminyak sekali") }))).toBeNull();
    expect(validateSkinPhoto(reading({ kualitas: "bagus" }))).toBeNull();
    expect(validateSkinPhoto("teks bebas")).toBeNull();
  });
});

describe("foto kuis: usulan jawaban", () => {
  it("memetakan pengamatan ke jawaban kuis dan menandai sumbernya", () => {
    const s = suggestionFromPhoto(validateSkinPhoto(reading())!);
    expect(s.answers).toEqual({ skinType: "berminyak", concerns: ["jerawat"], depth: 4, undertone: "warm" });
    expect(s.fromPhoto.sort()).toEqual(["concerns", "depth", "skinType", "undertone"]);
    expect(suggestionFromPhoto(validateSkinPhoto(reading({ kilap: ok("tidak"), kering: ok("jelas") }))!).answers.skinType).toBe("kering");
    expect(suggestionFromPhoto(validateSkinPhoto(reading({ kilap: ok("sedikit"), kering: ok("sedikit") }))!).answers.skinType).toBe("kombinasi");
    expect(suggestionFromPhoto(validateSkinPhoto(reading({ kilap: ok("tidak"), kering: ok("tidak") }))!).answers.skinType).toBe("normal");
  });
  it("keyakinan rendah tidak diisi otomatis; sensitivitas, budget, dan rutinitas tidak pernah diisi", () => {
    const s = suggestionFromPhoto(validateSkinPhoto(reading({ kilap: ok("jelas", "rendah"), undertone: ok("cool", "rendah"), noda: ok("ada", "rendah") }))!);
    expect(s.answers).toEqual({ depth: 4 });
    expect(s.answers).not.toHaveProperty("sensitivity");
    expect(s.answers).not.toHaveProperty("budget");
    expect(s.answers).not.toHaveProperty("routine");
  });
  it("kemerahan yang jelas hanya menjadi petunjuk di langkah sensitivitas", () => {
    const s = suggestionFromPhoto(validateSkinPhoto(reading({ kemerahan: ok("jelas", "sedang") }))!);
    expect(s.hints.sensitivity).toMatch(/kemerahan/);
    expect(s.answers.sensitivity).toBeUndefined();
  });
});

describe("gambar dari pembeli", () => {
  it("jenis berkas dicek dari isinya", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("tidak ada jalur penyimpanan foto: modul foto dan screenshot tidak menulis berkas, Blob, cache, atau isi gambar ke log", () => {
    const files = ["src/lib/ai/skin-photo.ts", "src/lib/ai/images.ts", "src/app/api/ai/foto-kulit/route.ts", "src/app/api/ai/dupe/route.ts"];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/node:fs|from "fs"|writeFile|@vercel\/blob|put\(|cacheSet|console\.(log|info|error)/);
    }
    // logAi untuk foto hanya menerima metadata: tidak ada data gambar atau query.
    const photo = readFileSync("src/lib/ai/skin-photo.ts", "utf8");
    for (const call of photo.match(/logAi\([^;]+;/g) ?? []) expect(call).not.toMatch(/image|data|query/);
    // Screenshot tidak di-cache: dupeFromScreenshots tidak memanggil cacheSet.
    const dupe = readFileSync("src/lib/ai/dupe.ts", "utf8");
    const screenshots = dupe.slice(dupe.indexOf("export async function dupeFromScreenshots"));
    expect(screenshots).not.toMatch(/cacheSet|cacheGet/);
  });
});

describe("link video: daftar izin dan SSRF", () => {
  it("TikTok dan YouTube dikenali dan dinormalkan", () => {
    expect(classifyLink("https://www.tiktok.com/@kreator/video/7301234567890123456?is_from_webapp=1")).toEqual({ kind: "tiktok", url: "https://www.tiktok.com/@kreator/video/7301234567890123456", short: false });
    expect(classifyLink("vt.tiktok.com/ZSabc123/")).toMatchObject({ kind: "tiktok", short: true });
    expect(classifyLink("https://youtu.be/dQw4w9WgXcQ?t=10")).toEqual({ kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ" });
    expect(classifyLink("https://www.youtube.com/shorts/abcDEF12345")).toMatchObject({ kind: "youtube", videoId: "abcDEF12345" });
    expect(classifyLink("https://m.youtube.com/watch?v=abcDEF12345&list=x")).toMatchObject({ kind: "youtube" });
  });
  it("Instagram dan domain lain diarahkan ke screenshot", () => {
    expect(classifyLink("https://www.instagram.com/reel/abc/")).toEqual({ kind: "lainnya", host: "www.instagram.com" });
    expect(classifyLink("https://shopee.co.id/produk-123")).toMatchObject({ kind: "lainnya" });
  });
  it("alamat lokal, IP privat, port, userinfo, dan domain tiruan tidak pernah lolos sebagai link video", () => {
    const bad = [
      "http://localhost:3000/api",
      "http://127.0.0.1/admin",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://0x7f000001/",
      "https://tiktok.com.evil.com/@a/video/1",
      "https://evil.com/www.tiktok.com/@a/video/1",
      "https://www.tiktok.com@evil.com/@a/video/1",
      "https://www.tiktok.com:8443/@a/video/1",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://intranet/",
      "https://db.internal/",
    ];
    for (const u of bad) expect(["tidak_valid", "lainnya"], u).toContain(classifyLink(u).kind);
    for (const u of bad) expect(classifyLink(u).kind, u).not.toMatch(/tiktok|youtube/);
  });
  it("guardedFetch: host di luar daftar tidak pernah dihubungi", async () => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(url);
      return new Response("{}");
    };
    for (const u of ["http://127.0.0.1/", "https://evil.com/oembed", "https://www.tiktok.com.evil.com/", "http://www.tiktok.com/oembed", "https://www.tiktok.com:444/oembed"]) await expect(guardedFetch(u, f)).rejects.toThrow(/tidak diizinkan/);
    expect(calls).toEqual([]);
  });
  it("redirect diikuti maksimal sekali dan harus tetap di host yang diizinkan", async () => {
    const hop = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const calls: string[] = [];
    const f = (responses: Response[]): FetchLike => async (url) => {
      calls.push(new URL(url).host);
      return responses.shift()!;
    };
    await expect(guardedFetch("https://www.tiktok.com/oembed?url=x", f([hop("https://www.tiktok.com/oembed?url=y"), new Response("{}", { status: 200 })]))).resolves.toMatchObject({ status: 200 });
    await expect(guardedFetch("https://www.tiktok.com/oembed", f([hop("http://169.254.169.254/")]))).rejects.toThrow(/Redirect/);
    await expect(guardedFetch("https://www.tiktok.com/oembed", f([hop("https://evil.com/")]))).rejects.toThrow(/Redirect/);
    await expect(guardedFetch("https://www.tiktok.com/oembed", f([hop("https://www.tiktok.com/a"), hop("https://www.tiktok.com/b")]))).rejects.toThrow(/Redirect/);
    expect(calls.every((h) => (FETCH_HOSTS as readonly string[]).includes(h))).toBe(true);
  });
  it("batas waktu dan batas ukuran respons", async () => {
    const slow: FetchLike = (_url, init) => new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("habis"), { name: "TimeoutError" }))));
    const t0 = Date.now();
    await expect(guardedFetch("https://www.youtube.com/oembed", slow, { timeoutMs: 200 })).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(1000);
    const huge: FetchLike = async () => new Response(JSON.stringify({ title: "x".repeat(200_000) }), { status: 200 });
    await expect(fetchOembed({ kind: "youtube", url: "https://www.youtube.com/watch?v=abcDEF12345", videoId: "abcDEF12345" }, huge)).rejects.toThrow(/terlalu besar/);
  });
  it("oEmbed: hanya endpoint resmi, tautan pendek TikTok diselesaikan sekali, sampul hanya dari CDN resmi", async () => {
    const calls: { url: string; method?: string }[] = [];
    const f: FetchLike = async (url, init) => {
      calls.push({ url, method: init.method });
      if (url.startsWith("https://vt.tiktok.com/")) return new Response(null, { status: 301, headers: { location: "https://www.tiktok.com/@kreator/video/7301234567890123456?_r=1" } });
      return new Response(JSON.stringify({ title: "Review lipstik <b>nude</b>", author_name: "kreator", author_url: "https://www.tiktok.com/@kreator", thumbnail_url: "https://p16-sign.tiktokcdn.com/obj/abc.jpeg" }), { status: 200 });
    };
    const info = await fetchOembed({ kind: "tiktok", url: "https://vt.tiktok.com/ZSabc123/", short: true }, f);
    expect(calls[0]).toEqual({ url: "https://vt.tiktok.com/ZSabc123/", method: "HEAD" });
    expect(calls[1].url).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent("https://www.tiktok.com/@kreator/video/7301234567890123456")}`);
    expect(info).toMatchObject({ platform: "tiktok", author: "kreator", thumbnailUrl: "https://p16-sign.tiktokcdn.com/obj/abc.jpeg" });
    const evilThumb: FetchLike = async () => new Response(JSON.stringify({ title: "x", thumbnail_url: "http://127.0.0.1/a.jpg", author_url: "https://evil.com/" }), { status: 200 });
    expect(await fetchOembed({ kind: "youtube", url: "https://www.youtube.com/watch?v=abcDEF12345", videoId: "abcDEF12345" }, evilThumb)).toMatchObject({ thumbnailUrl: null, authorUrl: null });
    const shortToEvil: FetchLike = async () => new Response(null, { status: 301, headers: { location: "https://evil.com/x" } });
    await expect(fetchOembed({ kind: "tiktok", url: "https://vt.tiktok.com/ZSabc123/", short: true }, shortToEvil)).rejects.toThrow();
  });
});

const variant = (id: number, hex: string, price: number, shadeName = `Shade ${id}`, stock = 10): CatalogVariant => ({ id, shadeName, shadeSlug: `s${id}`, hex, undertone: null, depth: null, price, normalPrice: price, source: "normal", stockByLocation: { "gudang-online": stock } });
const product = (id: number, over: Partial<CatalogItem>): CatalogItem => ({
  id,
  name: `Produk ${id}`,
  slug: `produk-${id}`,
  brandSlug: "lumi",
  brandName: "Lumi",
  brandColor: "#C2416B",
  categorySlug: "lipstick",
  parentSlug: "bibir",
  packaging: "lipstick",
  ratingAvg: 4,
  reviewCount: 2,
  soldCount: 10,
  isNew: false,
  isBestseller: false,
  publishedAt: "2026-09-01T00:00:00.000Z",
  skinTypes: [],
  concerns: [],
  finish: "matte",
  spf: null,
  relevance: 0,
  attrText: "",
  variants: [variant(id * 10, "#B8475D", 89_000)],
  ...over,
});
const ex = (over: Partial<DupeExtraction>): DupeExtraction => ({ kategori: "lipstick", jenisProduk: "lipstik", warnaHex: null, finish: null, merek: null, namaProduk: null, kataKunci: [], keyakinan: "sedang", ...over });

describe("pencocokan dupe ke katalog (tanpa AI)", () => {
  const catalog = [
    product(1, { name: "Lumi Velvet Matte Lipstick", soldCount: 300, variants: [variant(11, "#A91C32", 89_000, "06 Merah Ceri"), variant(12, "#C9707E", 89_000, "03 Mawar Muda")] }),
    product(2, { name: "Lumi Satin Glow Lipstick", finish: "satin", soldCount: 120, ratingAvg: 4.8, reviewCount: 6, variants: [variant(21, "#B0302E", 95_000, "Merah Delima")] }),
    product(3, { name: "Lumi Longwear Matte Lip Cream", categorySlug: "lip-cream", finish: "matte", soldCount: 80, variants: [variant(31, "#D98268", 65_000, "Peach")] }),
    product(4, { name: "Pualam Cream Blush", brandName: "Pualam", brandSlug: "pualam", categorySlug: "blush", parentSlug: "makeup-wajah", packaging: "cream_jar", variants: [variant(41, "#B2516E", 79_000, "Berry")] }),
  ];
  it("produk Rona yang sama persis: cocok, shade yang tertulis dipilih", () => {
    const m = matchDupe(catalog, ex({ merek: "Lumi", namaProduk: "Lumi Velvet Matte Lipstick shade 06 Merah Ceri" }));
    expect(m).toMatchObject({ tipe: "cocok", namaTerbaca: "Lumi Velvet Matte Lipstick", picks: [{ productId: 1, variantId: 11 }] });
  });
  it("merek asli yang tidak dijual: nama terbaca hanya teks, 3 alternatif dengan alasan", () => {
    const m = matchDupe(catalog, ex({ merek: "Wardah", namaProduk: "Matte Lip Cream", warnaHex: "#B12F2D", finish: "matte" }));
    expect(m.tipe).toBe("mirip");
    if (m.tipe !== "mirip") return;
    expect(m.namaTerbaca).toBe("Wardah Matte Lip Cream");
    expect(m.picks).toHaveLength(3);
    expect(m.picks[0]).toMatchObject({ productId: 2, variantId: 21, alasan: "Warna paling dekat: Merah Delima" });
    expect(m.picks[1].alasan).toBe("Finish matte sama, harga paling hemat");
    expect(m.picks[1].productId).toBe(3);
    expect(new Set(m.picks.map((p) => p.productId)).size).toBe(3);
  });
  it("merek milik Rona tanpa nama produk: tidak disebut 'tidak dijual', produk merek itu didahulukan", () => {
    const m = matchDupe(catalog, ex({ kategori: "blush", merek: "Pualam" }));
    expect(m).toMatchObject({ tipe: "mirip", namaTerbaca: null });
    expect(m.picks[0].productId).toBe(4);
  });
  it("produk tidak dikenali atau kategori tanpa produk", () => {
    expect(matchDupe(catalog, ex({ kategori: null, keyakinan: "rendah" })).tipe).toBe("tidak_dikenali");
    expect(matchDupe(catalog, ex({ kategori: null, kataKunci: [] })).tipe).toBe("tidak_dikenali");
    expect(matchDupe(catalog, ex({ kategori: "parfum" })).tipe).toBe("tidak_ada_sejenis");
  });
  it("alasan tidak berulang dan warna jauh tidak disebut 'paling dekat'", () => {
    const picks = pickAlternatives(catalog.slice(0, 3), ex({ warnaHex: "#2E8B57" }));
    expect(picks.some((p) => p.alasan.startsWith("Warna paling dekat"))).toBe(false);
    expect(new Set(picks.map((p) => p.alasan)).size).toBe(picks.length);
  });
  it("validasi ekstraksi: kolom di luar skema ditolak, nilai asing dikosongkan, teks dibersihkan", () => {
    const cats = ["lipstick", "blush"];
    expect(validateExtraction({ ...ex({}), diagnosis: "x" }, cats)).toBeNull();
    expect(validateExtraction({ ...ex({}), keyakinan: "pasti" }, cats)).toBeNull();
    expect(validateExtraction({ ...ex({ kategori: "mobil", warnaHex: "merah", finish: "metalik", merek: "<script>Wardah</script>" }) }, cats)).toMatchObject({ kategori: null, warnaHex: null, finish: null, merek: "script Wardah /script" });
  });
});

describe("fitur tersembunyi saat AI tidak tersedia", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("route foto dan dupe menjawab 404 tanpa memproses apa pun", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_GATEWAY_URL", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("DATABASE_URL", process.env.DATABASE_URL || "postgres://uji@127.0.0.1:1/tidak-dipakai");
    const { POST: foto } = await import("@/app/api/ai/foto-kulit/route");
    const { POST: dupe } = await import("@/app/api/ai/dupe/route");
    const req = (url: string) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" }, body: "{}" });
    expect((await foto(req("http://localhost:3000/api/ai/foto-kulit") as never)).status).toBe(404);
    expect((await dupe(req("http://localhost:3000/api/ai/dupe") as never)).status).toBe(404);
  });
});
