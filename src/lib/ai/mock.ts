// Model mock (AI_PROVIDER=mock) untuk uji, cuplik, dan Playwright. Deterministik dan memakai jalur yang sama dengan
// model sungguhan: memanggil tool katalog lewat function call, lalu menutup dengan "jawab". Tugas JSON (tafsiran
// pencarian, ringkasan ulasan, penjelasan rutinitas, tafsir padanan) dijawab dengan aturan sederhana.
import { withStream, type AiModel, type Content, type GenRequest, type GenResponse, type Part } from "./client";
import { MEDICAL_REFERRAL } from "./guard";
import { adminMockTurn } from "@/lib/asisten/mock";
import { greetingName } from "@/lib/reviews/display-name";
import type { ImageInput } from "./images";
import visionFixtures from "../../../evals/7c/sidik.json";
import { mockDupeFromImages, mockSkinReading } from "./mock-vision";
import { INJECTION, MEDICAL_INTENT, OFF_TOPIC, parseQueryRules, realBrandIn } from "./rules-parser";
import { MEREK } from "@/config/merek";

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

const json = (v: unknown): Part => ({ text: JSON.stringify(v) });
const CATEGORY_WORDS: Record<string, string> = { "sunscreen-wajah": "sunscreen", "tinted-sunscreen": "tinted sunscreen", "serum-dan-essence": "serum", "lip-tint": "lip tint", "lip-cream": "lip cream", lipstick: "lipstik", pembersih: "pembersih wajah" };
const categoryWords = (slug?: unknown) => (typeof slug === "string" ? (CATEGORY_WORDS[slug] ?? slug.replace(/-/g, " ")) : "");

type MockHit = { id?: number; produkId?: number; nama?: string; produk?: string; harga: number; hargaNormal?: number; rating?: number; stokOnline?: number; kategori?: string };

function lastCallArgs(contents: Content[]) {
  for (let i = contents.length - 1; i >= 0; i--) {
    const call = contents[i].parts.find((p) => p.functionCall)?.functionCall;
    if (contents[i].role === "model" && call) return call.args ?? {};
  }
  return {};
}

function reasonFor(h: MockHit, args: Record<string, unknown>) {
  if (h.hargaNormal && h.hargaNormal > h.harga) return "Sedang promo, harganya lebih hemat dari biasanya";
  if (typeof args.jenisKulit === "string") return `Cocok untuk kulit ${args.jenisKulit}, teksturnya nyaman dipakai harian`;
  if ((h.rating ?? 0) >= 4.6) return "Rating tinggi dari pembeli lain";
  if (typeof args.lokasi === "string") return "Stoknya ada di cabang yang kamu sebut";
  return "Pilihan populer di kategorinya";
}

function advisorTurn(req: GenRequest): GenResponse {
  const last = req.contents[req.contents.length - 1];
  const responses = last?.parts.filter((p) => p.functionResponse) ?? [];
  const q = lastUserText(req.contents.filter((c) => !c.parts.some((p) => p.text?.startsWith("Jawaban")))).toLowerCase();
  const brand = realBrandIn(q);
  const direct = (teks: string) => reply([call("jawabLangsung", { teks })], req);

  // Putaran pertama (mode tool wajib): pilih tool dari kalimat pembeli.
  if (req.toolMode === "ANY") {
    if (INJECTION.test(q)) return direct(`Aku hanya bisa membantu soal produk dan perawatan kulit di ${MEREK.namaLengkap}, dan aturanku tidak bisa diubah. Ada yang ingin kamu cari?`);
    if (/diskon|ubah harga|harganya rp|jadi admin|sebagai admin/.test(q)) return direct("Maaf, aku tidak bisa mengubah harga atau memberi diskon. Harga dan promo resmi selalu tampil di halaman produk.");
    if (OFF_TOPIC.test(q) && !/kulit|makeup|lipstik|skincare|sunscreen|produk/.test(q)) return direct(`Maaf, aku khusus membantu belanja kosmetik dan perawatan kulit di ${MEREK.namaLengkap}. Mau aku carikan sesuatu untuk kulitmu?`);
    if (MEDICAL_INTENT.test(q)) return direct(`Aku bukan tenaga medis, jadi tidak bisa menilai kondisi kulitmu. ${MEDICAL_REFERRAL} Setelah itu aku bisa bantu pilih pembersih yang lembut.`);
    if (/rutinitas|skincare routine|urutan skincare/.test(q)) return reply([call("susunRutinitas", { catatan: "Aku susun rutinitas dari profil kulitmu." })], req);
    // Fase 8C: kemampuan toko lewat tool (kalimat yang tidak dikenali aturan chat asisten).
    if (/tipe (kulit|apa)|kulitku (tipe|jenis)|kenal(an|i) (sama )?kulit/.test(q)) return reply([call("mulaiKuis", { catatan: "Aku siapkan kuis kulit singkat." })], req);
    if (/paket(ku)?|kiriman(ku)?|belum (datang|sampai)/.test(q)) return reply([call("lacakPesanan", { catatan: "Aku bantu lacak pesananmu." })], req);
    const kirimKe = /kirim ke ([a-z ]+?)(?: kena| berapa| ya|\?|$)/.exec(q);
    if (kirimKe) return reply([call("cekOngkir", { catatan: "Aku hitung ongkirnya.", kota: kirimKe[1].trim() })], req);
    if (/dikembalikan|pecah|rusak|retur/.test(q)) return reply([call("infoToko", { catatan: "Aku cek kebijakan returnya.", topik: "retur" })], req);
    if (/video|tiktok|reels|instagram/.test(q) && !/https?:/.test(q)) return reply([call("mintaScreenshot", { catatan: "Kirim screenshot-nya, ya." })], req);
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
    const what = categoryWords(args.kategori) || "produk";
    args.catatan = `Aku carikan ${what}${args.jenisKulit ? ` untuk kulit ${args.jenisKulit}` : ""} di katalog ${MEREK.nama}.`;
    return reply([call("cariProduk", args)], req);
  }

  // Putaran berikutnya: jawaban terstruktur dari hasil tool (nama dan harga tampil di kartu, bukan di teks).
  if (!responses.length) return reply([json({ teks: `Maaf, aku ulangi: ini hanya produk yang ada di katalog ${MEREK.nama}.`, produk: [] })], req);
  const r = responses[0].functionResponse!;
  const data = r.response as Record<string, unknown>;
  const args = lastCallArgs(req.contents);
  const TOOL_TEKS: Record<string, string> = {
    mulaiKuis: "Yuk jawab kuis singkat di bawah supaya aku tahu tipe kulitmu.",
    lacakPesanan: "Isi nomor pesanan dan nomor WhatsApp di formulir di bawah, ya.",
    cekOngkir: "Ini perkiraan ongkirnya.",
    infoToko: "Ini aturan resmi toko soal itu.",
    mintaScreenshot: "Kirim screenshot produknya dari video itu, nanti aku carikan yang mirip.",
    infoCabang: "Ini info cabang kami.",
    promoBerjalan: "Ini promo yang sedang berjalan.",
  };
  if (TOOL_TEKS[r.name]) return reply([json({ teks: TOOL_TEKS[r.name], produk: [] })], req);
  if (r.name === "susunRutinitas") {
    if (data.galat) return reply([json({ teks: "Aku perlu tahu jenis kulitmu dulu. Ikuti Kuis Kulit di /kuis-kulit, nanti rutinitasnya langsung tersusun.", produk: [] })], req);
    const steps = (data.langkah as { id: number; langkah: string }[]) ?? [];
    const ids = [...new Set(steps.map((s) => s.id))].slice(0, 4);
    return reply([json({ teks: `Ini rutinitas dari profil kulitmu, ${steps.length} langkah pagi dan malam. Lihat lengkapnya di halaman Rutinitas.`, produk: ids.map((id) => ({ id, alasan: steps.find((s) => s.id === id)?.langkah ?? "Bagian dari rutinitasmu" })) })], req);
  }
  const hasil = (((data.hasil as MockHit[]) ?? []).map((h) => ({ ...h, id: h.id ?? h.produkId }))).slice(0, 3);
  const prefix = brand ? `${MEREK.nama} tidak menjual ${brand}, jadi aku tidak bisa merekomendasikannya. ` : "";
  if (!hasil.length) return reply([json({ teks: `${prefix}Aku belum menemukan produk yang cocok di katalog ${MEREK.nama}. Coba longgarkan budget atau kategorinya, ya.`, produk: [] })], req);
  const what = categoryWords(args.kategori) || "produk";
  const budget = typeof args.hargaMaks === "number" ? `, semuanya di bawah ${Math.round(args.hargaMaks / 1000)} ribu` : "";
  const skin = typeof args.jenisKulit === "string" ? ` untuk kulit ${args.jenisKulit}` : "";
  const loc = typeof args.lokasi === "string" ? " Semuanya ada stoknya di cabang itu." : "";
  const teks = `${prefix}${brand ? "Sebagai gantinya, ini" : "Ini"} ${hasil.length} pilihan ${what}${skin} dari katalog ${MEREK.nama}${budget}.${loc}`;
  return reply([json({ teks, produk: hasil.map((h) => ({ id: h.id, alasan: reasonFor(h, args) })) })], req);
}

// Kata warna di caption ke perkiraan hex (untuk tugas dupe dari teks).
const COLOR_WORDS: [RegExp, string][] = [
  [/merah bata|terracotta/, "#A0452E"],
  [/nude/, "#C98B76"],
  [/mauve/, "#B07A8C"],
  [/coral/, "#F07F65"],
  [/pink|merah muda/, "#E58FA5"],
  [/merah/, "#B0302E"],
  [/cokelat|coklat|brown/, "#8B5A3C"],
];

async function jsonTask(req: GenRequest): Promise<GenResponse> {
  const prompt = lastUserText(req.contents);
  const task = /TUGAS: (\w+)/.exec(prompt)?.[1] ?? "";
  const images = req.contents.flatMap((c) => c.parts.filter((p) => p.inlineData).map((p) => p.inlineData!)) as ImageInput[];
  if (task === "deskripsi_produk") {
    const name = /Nama: (.+?)\. Merek:/.exec(prompt)?.[1] ?? "Produk ini";
    const actives = (/Bahan aktif: (.+?)\. Cocok/.exec(prompt)?.[1] ?? "").split(", ").filter((x) => x && x !== "tidak ada");
    const skin = /Cocok untuk kulit: (.+?)\. Finish/.exec(prompt)?.[1] ?? "";
    const points = (/Poin dari admin:\n([\s\S]+?)(\n[A-Z][a-z]+ |$)/.exec(prompt)?.[1] ?? "").split("\n").map((x) => x.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
    const short = /lebih singkat/.test(prompt);
    const skinText = skin && skin !== "tidak disebut" ? ` untuk kulit ${skin}` : "";
    const ringkas = `${name}${actives[0] ? ` dengan ${actives[0]}` : ""}${skinText}, ringan dan nyaman dipakai setiap hari.`;
    const manfaat = (points.length ? points.map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1).replace(/\.$/, "")}.`) : ["Terasa ringan dan nyaman dipakai harian."]).slice(0, short ? 1 : 4).join(" ");
    return reply([{ text: JSON.stringify({ ringkas, manfaat, kandungan: actives.length ? `Bahan aktif utama: ${actives.join(", ")}.` : "Komposisi lengkap ada di kemasan.", caraPakai: "Pakai secukupnya pada wajah yang bersih, lalu ratakan perlahan. Gunakan rutin pagi atau malam.", metaJudul: `${name} | ${MEREK.namaLengkap}`.slice(0, 60), metaDeskripsi: ringkas.slice(0, 155) }) }], req);
  }
  if (task === "balas_ulasan") {
    const nama = greetingName(/Nama tampilan: (.+?)\. Bintang/.exec(prompt)?.[1] ?? "");
    const situasi = /Situasi: ([^.]+)\./.exec(prompt)?.[1] ?? "";
    const balasan =
      situasi === "Pujian"
        ? `Terima kasih banyak, ${nama}! Senang sekali produknya cocok untukmu. Semoga makin betah memakainya, ya.`
        : situasi === "Salah shade"
          ? `Terima kasih sudah berbagi, ${nama}. Maaf shadenya kurang pas di kulitmu. Coba Padanan Shade di /padanan-shade untuk menemukan shade yang lebih cocok, ya. Sesuai kebijakan, shade kurang cocok tidak termasuk retur.`
          : situasi.startsWith("Pengiriman")
            ? `Mohon maaf atas kondisi paketnya, ${nama}. Bila produk rusak atau segel terbuka, kamu bisa mengajukan retur maksimal 2 x 24 jam setelah paket sampai dengan video unboxing. Hubungi kami lewat WA, ya.`
            : `Terima kasih sudah berbagi pengalamanmu, ${nama}. Maaf hasilnya belum sesuai harapan. Coba pakai lebih tipis dan beri jeda sebelum lapisan berikutnya, dan hubungi kami lewat WA bila masih ada kendala.`;
    return reply([{ text: JSON.stringify({ balasan }) }], req);
  }
  if (task === "transkripsi") return reply([{ text: "Omzet minggu ini dibanding minggu lalu" }], req);
  if (task === "foto_kulit") return reply([{ text: JSON.stringify(await mockSkinReading(images[0])) }], req);
  if (task === "dupe_gambar") {
    return reply([{ text: JSON.stringify(await mockDupeFromImages(images, visionFixtures.gambar)) }], req);
  }
  if (task === "dupe_teks" || task === "dupe_video") {
    const t = (/Teks: ([\s\S]+)$/.exec(prompt)?.[1] ?? "").toLowerCase();
    const p = parseQueryRules(t);
    const hex = COLOR_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
    const known = Boolean(p.kategori || hex);
    return reply([{ text: JSON.stringify({ kategori: p.kategori, jenisProduk: p.kategori ?? "", warnaHex: hex, finish: p.finish[0] ?? null, merek: realBrandIn(t), namaProduk: null, kataKunci: [], keyakinan: known ? "sedang" : "rendah" }) }], req);
  }
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

// Advisor dikenali dari prompt sistemnya; tugas JSON lain memakai penanda "TUGAS:" di pesan pembeli.
export function createMockModel(): AiModel {
  return withStream({
    name: "mock",
    async generate(req) {
      if (req.system?.startsWith(`Kamu ${MEREK.asisten.nama}`)) return advisorTurn(req);
      if (req.system?.startsWith("Kamu Asisten Admin")) return adminMockTurn(req);
      return jsonTask(req);
    },
  });
}
