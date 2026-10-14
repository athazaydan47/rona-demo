// Klien AI (format URL dan header gateway, coba ulang, batas waktu), pagar keluaran Advisor, tafsiran pencarian,
// dan ringkasan ulasan. Murni, dengan fetch tiruan.
import { describe, expect, it } from "vitest";
import { emptyFilters } from "@/lib/catalog/filters";
import { aiConfig, aiTersedia, AiError, createGeminiModel, parseResponse, requestBody } from "./client";
import { medicalClaims, stripSentences, validateAdvisorOutput } from "./guard";
import { interpretationToFilters, looksLikeSentence, normalizeQuery, validateInterpretation, type AllowedValues } from "./interpret";
import { reviewListHash, validateSummary } from "./review-summary";
import { parsePriceMax, parseQueryRules } from "./rules-parser";

const GW = "https://gateway.ai.cloudflare.com/v1/akun/gateway/google-ai-studio";
const okBody = { candidates: [{ content: { role: "model", parts: [{ text: "halo" }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 2 } };

describe("konfigurasi AI", () => {
  it("tersedia hanya bila gateway dan kunci lengkap, atau mode mock", () => {
    expect(aiTersedia(aiConfig({}))).toBe(false);
    expect(aiTersedia(aiConfig({ AI_GATEWAY_URL: GW }))).toBe(false);
    expect(aiTersedia(aiConfig({ AI_GATEWAY_URL: GW, GEMINI_API_KEY: "k" }))).toBe(true);
    expect(aiTersedia(aiConfig({ AI_PROVIDER: "mock" }))).toBe(true);
    expect(aiConfig({}).model).toBe("gemini-3.5-flash");
    expect(aiConfig({ AI_DAILY_CAP: "250" }).dailyCap).toBe(250);
  });
});

describe("klien Gemini lewat Cloudflare AI Gateway", () => {
  const cfg = aiConfig({ AI_GATEWAY_URL: `${GW}/`, GEMINI_API_KEY: "kunci", AI_MODEL: "gemini-3.5-flash", CF_AIG_TOKEN: "token-gw" });
  it("URL, header kunci Google, dan header autentikasi gateway sesuai dokumentasi", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(okBody), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await createGeminiModel(cfg, fake).generate({ contents: [{ role: "user", parts: [{ text: "hai" }] }], system: "sistem", tools: [{ name: "cari", description: "c", parameters: { type: "OBJECT", properties: {} } }], toolMode: "ANY" });
    expect(calls[0].url).toBe(`${GW}/v1beta/models/gemini-3.5-flash:generateContent`);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["x-goog-api-key"]).toBe("kunci");
    expect(h["cf-aig-authorization"]).toBe("Bearer token-gw");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.systemInstruction.parts[0].text).toBe("sistem");
    expect(body.toolConfig.functionCallingConfig.mode).toBe("ANY");
    expect(res).toMatchObject({ text: "halo", usage: { input: 10, output: 5 } });
  });
  it("satu kali coba ulang untuk 503, tidak untuk 400", async () => {
    let n = 0;
    const flaky = (async () => (++n === 1 ? new Response(JSON.stringify({ error: { message: "sibuk" } }), { status: 503 }) : new Response(JSON.stringify(okBody), { status: 200 }))) as unknown as typeof fetch;
    await expect(createGeminiModel(cfg, flaky).generate({ contents: [] })).resolves.toMatchObject({ text: "halo" });
    expect(n).toBe(2);
    let m = 0;
    const bad = (async () => {
      m++;
      return new Response(JSON.stringify({ error: { message: "salah" } }), { status: 400 });
    }) as unknown as typeof fetch;
    await expect(createGeminiModel(cfg, bad).generate({ contents: [] })).rejects.toMatchObject({ name: "AiError", retryable: false, status: 400 });
    expect(m).toBe(1);
  });
  it("batas waktu menjadi AiError yang bisa dicoba ulang; anggaran habis tidak dicoba lagi", async () => {
    const slow = ((_url: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("habis"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    const t0 = Date.now();
    await expect(createGeminiModel(cfg, slow).generate({ contents: [] }, { timeoutMs: 300 })).rejects.toBeInstanceOf(AiError);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
  it("jawaban dengan function call dan tanpa kandidat", () => {
    const r = parseResponse({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "cariProduk", args: { kategori: "toner" } }, thoughtSignature: "sig" }] } }] }, "m");
    expect(r.functionCalls).toEqual([{ name: "cariProduk", args: { kategori: "toner" }, id: undefined }]);
    expect(r.content.parts[0].thoughtSignature).toBe("sig"); // dikembalikan utuh ke giliran berikutnya
    expect(() => parseResponse({ candidates: [] }, "m")).toThrow(AiError);
    expect(requestBody({ contents: [], jsonSchema: { type: "OBJECT" } }).generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("validasi keluaran Advisor", () => {
  const names = ["Lumi Velvet Matte Lipstick", "Pualam Velvet Matte Cushion SPF 50", "Surya Shield Gel Sunscreen SPF 50 PA++++"];
  it("id di luar hasil tool ditolak, duplikat dibuang, maksimal 4", () => {
    const v = validateAdvisorOutput({ teks: "ok", produkIds: [5, 5, 9, 1, 2, 3, 4] }, new Set([1, 2, 3, 4, 5]), names, new Set());
    expect(v.ids).toEqual([5, 1, 2, 3]);
    expect(v.rejectedIds).toEqual([9, 4]);
  });
  it("nama produk katalog yang tidak ada di hasil tool terdeteksi; klaim medis terdeteksi", () => {
    const v = validateAdvisorOutput({ teks: "Coba Lumi Velvet Matte Lipstick dan Pualam Velvet Matte Cushion SPF 50, dijamin sembuh.", produkIds: [1] }, new Set([1]), names, new Set(["Lumi Velvet Matte Lipstick"]));
    expect(v.foreignNames).toEqual(["Pualam Velvet Matte Cushion SPF 50"]);
    expect(v.medical).toEqual(["dijamin sembuh"]);
    expect(stripSentences("Kalimat aman. Ada Pualam Velvet Matte Cushion SPF 50 juga. Selesai.", v.foreignNames)).toBe("Kalimat aman. Selesai.");
    expect(medicalClaims("Periksa ke dokter kulit, ya.")).toEqual([]);
  });
});

describe("tafsiran pencarian", () => {
  const allowed: AllowedValues = { categories: [{ slug: "lipstick", name: "Lipstick" }, { slug: "sunscreen-wajah", name: "Sunscreen Wajah" }], brands: [{ slug: "lumi", name: "Lumi" }] };
  it("kalimat dikenali, kata kunci pendek tidak", () => {
    expect(looksLikeSentence("lipstik yang ga bikin bibir kering buat kondangan")).toBe(true);
    expect(looksLikeSentence("sunscreen buat berminyak")).toBe(true);
    expect(looksLikeSentence("cushion pualam")).toBe(false);
    expect(looksLikeSentence("lipstick")).toBe(false);
    expect(normalizeQuery("  Lipstik, yang GA bikin kering!! ")).toBe("lipstik yang ga bikin kering");
  });
  it("nilai yang tidak dikenal dibuang", () => {
    const v = validateInterpretation({ kategori: "lipstick", merek: ["lumi", "wardah"], jenisKulit: ["berminyak", "plastik"], masalah: [], finish: ["satin", "metalik"], undertone: [], spf: false, hargaMaks: 50, atribut: ["melembapkan", "ajaib"], kataKunci: "kondangan<script>" }, allowed)!;
    expect(v).toEqual({ kategori: "lipstick", merek: ["lumi"], jenisKulit: ["berminyak"], masalah: [], finish: ["satin"], undertone: [], spf: false, hargaMaks: null, atribut: ["melembapkan"], kataKunci: "kondanganscript" });
    expect(validateInterpretation({ kategori: "mobil" }, allowed)!.kategori).toBeNull();
    expect(validateInterpretation("bukan objek", allowed)).toBeNull();
  });
  it("tafsiran menjadi filter katalog yang ditandai tafsir", () => {
    const f = interpretationToFilters({ kategori: "lipstick", merek: [], jenisKulit: [], masalah: [], finish: ["satin"], undertone: [], spf: false, hargaMaks: 150_000, atribut: ["melembapkan"], kataKunci: "" }, { ...emptyFilters(), q: "lipstik yang ga bikin kering" });
    expect(f).toMatchObject({ q: "lipstik yang ga bikin kering", category: "lipstick", finishes: ["satin"], priceMax: 150_000, attributes: ["melembapkan"], interpreted: true });
  });
  it("pengurai aturan (dipakai mock) untuk contoh di prompt", () => {
    expect(parseQueryRules("lipstik yang ga bikin bibir kering buat kondangan")).toMatchObject({ kategori: "lipstick", finish: ["satin"], atribut: expect.arrayContaining(["melembapkan"]) });
    expect(parsePriceMax("serum di bawah 100 ribu")).toBe(100_000);
    expect(parsePriceMax("maks 150rb")).toBe(150_000);
    expect(parsePriceMax("budget 1,5 juta")).toBeNull();
  });
});

describe("ringkasan ulasan", () => {
  it("hash berubah bila ulasan berubah, tidak bergantung urutan", () => {
    const a = [{ id: 1, rating: 5, body: "Bagus" }, { id: 2, rating: 4, body: "Oke" }];
    expect(reviewListHash(a)).toBe(reviewListHash([...a].reverse()));
    expect(reviewListHash(a)).not.toBe(reviewListHash([a[0]]));
    expect(reviewListHash(a)).not.toBe(reviewListHash([a[0], { ...a[1], body: "Oke banget" }]));
  });
  it("validasi ringkasan: maksimal 3 butir, klaim medis dibuang", () => {
    expect(validateSummary({ pros: ["Ringan", "Tahan lama", "Wangi", "Lembap"], cons: ["Mengobati jerawat"], suitableFor: "Kulit berminyak" })).toEqual({ pros: ["Ringan", "Tahan lama", "Wangi"], cons: [], suitableFor: "Kulit berminyak" });
    expect(validateSummary({ pros: [], cons: [], suitableFor: "" })).toBeNull();
  });
});
