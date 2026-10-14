// Model mock (AI_PROVIDER=mock) untuk uji, cuplik, dan Playwright. Deterministik dan memakai jalur yang sama dengan
// model sungguhan: memanggil tool katalog lewat function call, lalu menutup dengan "jawab". Tugas JSON (tafsiran
// pencarian, ringkasan ulasan, penjelasan rutinitas, tafsir padanan) dijawab dengan aturan sederhana.
import { formatRupiah } from "@/lib/format";
import type { AiModel, Content, GenRequest, GenResponse, Part } from "./client";
import { MEDICAL_REFERRAL } from "./guard";
import { INJECTION, MEDICAL_INTENT, OFF_TOPIC, parseQueryRules, realBrandIn } from "./rules-parser";

const estimateTokens = (s: string) => Math.ceil(s.length / 4);

function reply(parts: Part[], req: GenRequest): GenResponse {
  const input = estimateTokens(JSON.stringify(req.contents)) + estimateTokens(req.system ?? "");
  const text = parts.map((p) => p.text ?? "").join("");
  return {
    content: { role: "model", parts },
    text,
    functionCalls: parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
    usage: { input, output: estimateTokens(JSON.stringify(parts)) },
    model: "mock",
  };
}

const call = (name: string, args: Record<string, unknown>): Part => ({ functionCall: { name, args } });
const lastUserText = (contents: Content[]) => [...contents].reverse().find((c) => c.role === "user" && c.parts.some((p) => p.text))?.parts.find((p) => p.text)?.text ?? "";

function brandsFromPrompt(text: string) {
  const line = /Merek: (.+)\./.exec(text)?.[1] ?? "";
  return [...line.matchAll(/([a-z0-9-]+) \(([^)]+)\)/g)].map((m) => ({ slug: m[1], name: m[2] }));
}

function advisorTurn(req: GenRequest): GenResponse {
  const last = req.contents[req.contents.length - 1];
  const responses = last?.parts.filter((p) => p.functionResponse) ?? [];
  const q = lastUserText(req.contents).toLowerCase();
  const brand = realBrandIn(q);
  const onlyJawab = (req.tools ?? []).every((t) => t.name === "jawab");

  // Giliran pertama: putuskan dari kalimat pembeli.
  if (!responses.length) {
    if (INJECTION.test(q)) return reply([call("jawab", { teks: "Aku hanya bisa membantu soal produk dan perawatan kulit di Rona Beauty, dan aturanku tidak bisa diubah. Ada yang ingin kamu cari?", produkIds: [] })], req);
    if (OFF_TOPIC.test(q) && !/kulit|makeup|lipstik|skincare|sunscreen|produk/.test(q)) return reply([call("jawab", { teks: "Maaf, aku khusus membantu belanja kosmetik dan perawatan kulit di Rona Beauty. Mau aku carikan sesuatu untuk kulitmu?", produkIds: [] })], req);
    if (MEDICAL_INTENT.test(q)) return reply([call("jawab", { teks: `Aku bukan tenaga medis, jadi tidak bisa menilai kondisi kulitmu. ${MEDICAL_REFERRAL} Setelah itu aku bisa bantu pilih pembersih yang lembut.`, produkIds: [] })], req);
    if (onlyJawab) return reply([call("jawab", { teks: "Maaf, aku belum menemukan jawabannya.", produkIds: [] })], req);
    if (/rutinitas|skincare routine|urutan skincare/.test(q)) return reply([call("susunRutinitas", {})], req);
    const p = parseQueryRules(q);
    const args: Record<string, unknown> = {};
    if (p.kategori) args.kategori = p.kategori;
    if (/padanan|shade|sawo matang/.test(q) && !p.kategori) args.kategori = "cushion";
    if (p.jenisKulit[0]) args.jenisKulit = p.jenisKulit[0];
    if (p.masalah[0]) args.masalah = p.masalah[0];
    if (p.finish[0] && !/kondangan|pesta/.test(q)) args.finish = p.finish[0];
    if (p.hargaMaks) args.hargaMaks = p.hargaMaks;
    else if (/kado|hadiah/.test(q)) args.hargaMaks = 200_000;
    if (p.undertone[0]) args.undertone = p.undertone[0];
    if (/sawo matang/.test(q)) args.kedalaman = 4;
    const loc = /dinoyo/.test(q) ? "dinoyo" : /soekarno|suhat/.test(q) ? "soekarno-hatta" : /sawojajar/.test(q) ? "sawojajar" : null;
    if (loc) args.lokasi = loc;
    if (!Object.keys(args).length || (brand && !p.kategori)) {
      const words = q.replace(brand?.toLowerCase() ?? "", "").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3 && !/^(yang|buat|untuk|ada|cari|mau|dong|kamu|punya|jual|apakah|produk)$/.test(w));
      if (!brand && words.length) args.teks = words.slice(0, 3).join(" ");
    }
    return reply([call("cariProduk", args)], req);
  }

  // Giliran berikutnya: susun jawaban dari hasil tool (nama dan harga dari server).
  const r = responses[0].functionResponse!;
  if (r.name === "jawab") {
    // Jawaban sebelumnya ditolak validasi: jawab ulang tanpa produk.
    return reply([call("jawab", { teks: "Maaf, aku ulangi: ini hanya produk yang ada di katalog Rona.", produkIds: [] })], req);
  }
  const data = r.response as Record<string, unknown>;
  if (r.name === "susunRutinitas") {
    if (data.galat) return reply([call("jawab", { teks: "Aku perlu tahu jenis kulitmu dulu. Ikuti Kuis Kulit di /kuis-kulit, nanti rutinitasnya langsung tersusun.", produkIds: [] })], req);
    const steps = (data.langkah as { utama: { id: number; nama: string } }[]) ?? [];
    return reply([call("jawab", { teks: `Ini rutinitas yang disusun dari profil kulitmu, ${steps.length} langkah pagi dan malam. Lihat lengkapnya di halaman Rutinitas.`, produkIds: [...new Set(steps.map((s) => s.utama.id))].slice(0, 4) })], req);
  }
  const hasil = ((data.hasil as { id: number; nama: string; harga: number; cabangDenganStok?: string[] }[]) ?? []).slice(0, 3);
  const prefix = brand ? `Rona tidak menjual ${brand}, jadi aku tidak bisa merekomendasikannya. ` : "";
  if (!hasil.length) return reply([call("jawab", { teks: `${prefix}Aku belum menemukan produk yang cocok di katalog Rona. Coba longgarkan budget atau kategorinya, ya.`, produkIds: [] })], req);
  const list = hasil.map((h) => `${h.nama} (${formatRupiah(h.harga)})`).join(", ");
  const loc = /dinoyo/.test(q) ? " Semuanya ada stoknya di Rona Dinoyo." : "";
  return reply([call("jawab", { teks: `${prefix}${brand ? "Sebagai gantinya, ini" : "Ini"} pilihan dari katalog Rona yang cocok untukmu: ${list}.${loc}`, produkIds: hasil.map((h) => h.id) })], req);
}

function jsonTask(req: GenRequest): GenResponse {
  const prompt = lastUserText(req.contents);
  const task = /TUGAS: (\w+)/.exec(prompt)?.[1] ?? "";
  if (task === "tafsir_cari") {
    const q = /Kueri: (.+)$/m.exec(prompt)?.[1] ?? "";
    return reply([{ text: JSON.stringify(parseQueryRules(q, brandsFromPrompt(prompt))) }], req);
  }
  if (task === "ringkasan_ulasan") {
    const reviews = [...prompt.matchAll(/^- \[(\d)\] (.+)$/gm)].map((m) => ({ rating: Number(m[1]), body: m[2].toLowerCase() }));
    const prosWords: [RegExp, string][] = [
      [/ringan|tidak berat/, "Terasa ringan di kulit"],
      [/tahan lama|awet|seharian/, "Tahan lama untuk aktivitas seharian"],
      [/lembap|melembap|hidrasi/, "Melembapkan tanpa terasa lengket"],
      [/warna|shade|cantik/, "Pilihan warnanya disukai"],
      [/harga|terjangkau|murah/, "Harganya sepadan"],
      [/kemasan|praktis/, "Kemasannya praktis dibawa"],
    ];
    const consWords: [RegExp, string][] = [
      [/luntur|cepat hilang/, "Beberapa pembeli merasa cepat luntur"],
      [/aroma|wangi/, "Aromanya terasa kuat bagi sebagian orang"],
      [/kemasan|retak|bocor/, "Ada keluhan soal kemasan saat pengiriman"],
      [/gelap|terang|beda/, "Warna di foto dan aslinya bisa sedikit berbeda"],
      [/kering/, "Bisa terasa kering bila tanpa pelembap"],
    ];
    const pick = (list: [RegExp, string][], rows: typeof reviews) => list.filter(([re]) => rows.some((r) => re.test(r.body))).map(([, t]) => t).slice(0, 3);
    const pros = pick(prosWords, reviews.filter((r) => r.rating >= 4));
    const cons = pick(consWords, reviews.filter((r) => r.rating <= 3));
    const skin = /kulit (berminyak|kering|sensitif|kombinasi|normal)/.exec(reviews.map((r) => r.body).join(" "))?.[1];
    return reply([{ text: JSON.stringify({ pros: pros.length ? pros : ["Banyak pembeli puas dengan hasilnya"], cons, suitableFor: skin ? `Pembeli dengan kulit ${skin} paling sering memberi ulasan positif.` : "Cocok untuk pemakaian sehari-hari." }) }], req);
  }
  if (task === "jelaskan_rutinitas") {
    return reply([{ text: JSON.stringify({ penjelasan: "Pagi fokus membersihkan, menjaga kelembapan, dan melindungi dari matahari. Malam fokus membersihkan sisa sunscreen dan memberi perawatan. Mulai pelan-pelan dan perhatikan respons kulitmu." }) }], req);
  }
  if (task === "padanan_teks") {
    const q = (/Kalimat: (.+)$/m.exec(prompt)?.[1] ?? "").toLowerCase();
    const options = [...prompt.matchAll(/^- (\d+): (.+)$/gm)].map((m) => ({ id: Number(m[1]), label: m[2].toLowerCase() }));
    const scored = options.map((o) => ({ id: o.id, score: o.label.split(/[^a-z0-9]+/).filter((w) => w.length > 1 && q.includes(w)).length })).sort((a, b) => b.score - a.score || a.id - b.id);
    return reply([{ text: JSON.stringify({ varianId: scored[0]?.score ? scored[0].id : 0 }) }], req);
  }
  return reply([{ text: "{}" }], req);
}

export function createMockModel(): AiModel {
  return {
    name: "mock",
    async generate(req) {
      if (req.jsonSchema) return jsonTask(req);
      return advisorTurn(req);
    },
  };
}
