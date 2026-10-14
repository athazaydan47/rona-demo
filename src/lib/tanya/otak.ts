// Otak chat asisten (Fase 8C): satu pintu untuk semua kemampuan pembeli. Dipakai route /api/ai/advisor dan evaluasi
// (npm run eval:ai), jadi perilakunya sama di keduanya.
//
// Urutan:
//   1. Aksi dari chip atau kartu interaktif: selalu berbasis aturan, tanpa model.
//   2. Niat yang dikenali aturan (link video, nomor pesanan, ongkir, kuis, rutinitas, padanan shade, cocok untuk kulit,
//      cabang, promo, bantuan): ditangani tanpa model, kecuali membaca link video yang butuh AI untuk mengenali produk.
//   3. Selain itu: Advisor dengan tool katalog dan tool toko, dalam batas pemakaian per fitur, bersama, dan global.
// Tanpa AI (env kosong) atau kuota habis, langkah 1 dan 2 tetap jalan; langkah 3 diganti ajakan memakai chip.
import type { SkinProfile } from "@/db/schema/customers";
import type { AnyDb } from "@/lib/db-types";
import type { AiConfig, AiModel } from "@/lib/ai/client";
import { runAdvisor, type ChatTurn } from "@/lib/ai/advisor";
import { dupeFromLink } from "@/lib/ai/dupe";
import type { FetchLike } from "@/lib/ai/oembed";
import { checkChatLimit, checkDailyFeatureLimit, LIMITS, logAi } from "@/lib/ai/usage";
import { kartuPesanan, lacakPesanan } from "@/lib/orders/lacak";
import { isProfileUsable } from "@/lib/skin/profile";
import { resolveShadeText, shadeSources, tafsirShadeDenganAi } from "@/lib/skin/tafsir-shade";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { CHIP_PEMBUKA, type Aksi, type Chip, type Kartu, type TanyaEvent } from "./kartu";
import { jawabBantuan, jawabCabang, jawabCocok, jawabOngkir, jawabPromo, jawabRutinitas, jawabShade, kartuDupe, pesananTerakhir, produkDisebut, produkKartu, teksDupe, type Jawaban } from "./kemampuan";
import { kenaliNiat, type Niat } from "./niat";

export type TanyaDeps = {
  db: AnyDb;
  now: Date;
  cfg: AiConfig;
  model: AiModel | null; // Advisor (fitur aiPembeli)
  modelFoto: AiModel | null; // membaca link video dan screenshot (fitur aiFotoLink)
  visitorHash: string;
  ipKey: string;
  customerId: number | null;
  profile: SkinProfile | null;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  skipLimits?: boolean; // hanya evaluasi
  skipCache?: boolean; // hanya evaluasi
};
export type TanyaInput = { history: ChatTurn[]; produkId?: number | null; aksi?: Aksi | null };
export type Jalur = "aturan" | "ai" | "link" | "batas" | "tanpa_ai";
export type TanyaHasil = { ok: boolean; teks: string; kartu: Kartu[]; chips: Chip[]; jalur: Jalur; niat: string | null; usage: { input: number; output: number }; toolCalls: string[]; firstTextMs: number | null; error?: string };

type Emit = (e: TanyaEvent) => void;

// Chip berbasis aturan yang selalu bisa dipakai (juga saat AI mati atau kuota habis).
export function chipAturan(opts: { aiFoto: boolean }): Chip[] {
  return CHIP_PEMBUKA.filter((c) => (c.butuh === "aiFoto" ? opts.aiFoto : c.butuh === "multiCabang" ? fiturAktif("multiCabang") : true)).map(({ label, aksi }) => ({ label, aksi }));
}

const kuisKartu = (deps: TanyaDeps): Kartu => ({
  jenis: "kuis",
  awal: deps.profile ? { skinType: deps.profile.skinType ?? undefined, concerns: deps.profile.concerns ?? undefined, sensitivity: deps.profile.sensitivity ?? undefined, budget: deps.profile.budget ?? undefined, undertone: deps.profile.undertone ?? undefined, depth: deps.profile.depth ?? undefined, routine: deps.profile.routine ?? undefined } : {},
  foto: Boolean(deps.modelFoto),
});

async function jawabLacak(deps: TanyaDeps, nomor: string | null | undefined, wa: string | null | undefined): Promise<Jawaban> {
  const masuk = Boolean(deps.customerId);
  if (!nomor) {
    const pesanan = deps.customerId ? await pesananTerakhir(deps.db, deps.customerId) : [];
    return {
      teks: masuk ? (pesanan.length ? "Pesanan yang mana? Pilih di bawah, atau tulis nomor pesanannya." : "Belum ada pesanan di akunmu. Pesanan tanpa masuk bisa dilacak dengan nomor pesanan dan nomor WhatsApp.") : "Tulis nomor pesanan dan nomor WhatsApp yang kamu pakai saat memesan, ya. Keduanya harus cocok.",
      kartu: [{ jenis: "form_lacak", masuk, pesanan }],
    };
  }
  // Nomor WA diperiksa server (lacakPesanan), tidak pernah oleh model; model tidak menerima data pesanan apa pun.
  const r = await lacakPesanan(deps.db, { nomor, wa, customerId: deps.customerId, ipKey: deps.ipKey, now: deps.now });
  if (r.ok) return { teks: `Status pesanan ${r.order.number}:`, kartu: [{ jenis: "pesanan", data: kartuPesanan(r.order) }] };
  if (r.alasan === "terbatas") return { teks: r.pesan, kartu: [] };
  return { teks: r.pesan, kartu: [{ jenis: "form_lacak", masuk, nomor: r.alasan === "format" ? undefined : nomor.toUpperCase() }] };
}

async function jawabAksi(deps: TanyaDeps, aksi: Aksi, produkId: number | null, emit: Emit): Promise<Jawaban> {
  switch (aksi.jenis) {
    case "rekomendasi":
      if (isProfileUsable(deps.profile)) {
        emit({ type: "status", text: "Menyusun rutinitas dari profilmu" });
        const j = await jawabRutinitas(deps.db, deps.profile, deps.now);
        return { ...j, teks: deps.model ? "Ini rutinitas dari profil kulitmu. Mau cari produk tertentu? Tulis saja kebutuhanmu." : j.teks };
      }
      return { teks: "Yuk kenali kulitmu dulu. Pilih jawaban yang paling pas, semua pertanyaan boleh dilewati.", kartu: [kuisKartu(deps)] };
    case "kuis":
      return { teks: "Yuk kenali kulitmu. Pilih jawaban yang paling pas, semua pertanyaan boleh dilewati.", kartu: [kuisKartu(deps)] };
    case "rutinitas":
      emit({ type: "status", text: "Menyusun rutinitas" });
      return jawabRutinitas(deps.db, deps.profile, deps.now);
    case "video":
      return deps.modelFoto ? { teks: "Tempel link TikTok atau YouTube-nya di kolom pesan, atau kirim 1 sampai 3 screenshot produknya.", kartu: [{ jenis: "video" }] } : { teks: "Membaca video dan screenshot butuh AI yang sedang tidak tersedia. Coba cari produknya lewat kotak cari, ya.", kartu: [] };
    case "shade":
      if (aksi.varianId) {
        emit({ type: "status", text: "Mencocokkan warna" });
        return jawabShade(deps.db, aksi.varianId, deps.now);
      }
      return { teks: "Pilih produk dan shade yang biasa kamu pakai, atau tulis misalnya: aku pakai cushion Pualam 02.", kartu: [{ jenis: "pilih_shade" }] };
    case "lacak":
      return jawabLacak(deps, aksi.nomor, aksi.wa);
    case "ongkir":
      emit({ type: "status", text: "Menghitung ongkir" });
      return jawabOngkir(deps.db, { kota: aksi.kota, kode: aksi.kode });
    case "cabang":
      return jawabCabang(deps.db, deps.now);
    case "promo":
      emit({ type: "status", text: "Mengecek promo" });
      return jawabPromo(deps.db, deps.now);
    case "bantuan":
      return jawabBantuan(aksi.topik);
    case "cocok": {
      const id = aksi.produkId ?? produkId;
      return id ? jawabCocok(deps.db, id, deps.profile) : { teks: "Buka halaman produknya lalu tanya dari sana, atau tulis nama produknya, ya.", kartu: [] };
    }
  }
}

// Niat berbasis aturan. null berarti diteruskan ke model (misal "cocok" tanpa produk yang jelas, atau shade yang tidak
// dikenali aturan saat AI tersedia).
async function jawabNiat(deps: TanyaDeps, niat: Niat, produkId: number | null, emit: Emit): Promise<Jawaban | null> {
  switch (niat.jenis) {
    case "lacak":
      return jawabLacak(deps, niat.nomor, niat.wa);
    case "ongkir":
      emit({ type: "status", text: "Menghitung ongkir" });
      return jawabOngkir(deps.db, { kota: niat.kota });
    case "kuis":
      return jawabAksi(deps, { jenis: "kuis" }, produkId, emit);
    case "rutinitas":
      return jawabAksi(deps, { jenis: "rutinitas" }, produkId, emit);
    case "cabang":
      return jawabCabang(deps.db, deps.now, niat.teks);
    case "promo":
      emit({ type: "status", text: "Mengecek promo" });
      return jawabPromo(deps.db, deps.now);
    case "bantuan":
      return jawabBantuan(niat.topik);
    case "cocok": {
      const id = produkId ?? (await produkDisebut(deps.db, niat.teks));
      if (id) return jawabCocok(deps.db, id, deps.profile);
      return deps.model ? null : { teks: "Produk yang mana? Buka halaman produknya lalu tekan Tanya, atau tulis nama lengkap produknya.", kartu: [] };
    }
    case "shade": {
      emit({ type: "status", text: "Mencari shade yang kamu maksud" });
      const sources = await shadeSources(deps.db);
      const r = resolveShadeText(niat.teks, sources);
      if (r.status === "cocok") {
        emit({ type: "status", text: "Mencocokkan warna" });
        return jawabShade(deps.db, r.pilih.varianId, deps.now);
      }
      if (r.status === "pilih") return { teks: r.pesan, kartu: [], chips: r.pilihan.map((p) => ({ label: p.label, aksi: { jenis: "shade", varianId: p.varianId } })) };
      if (deps.model && (deps.skipLimits || (await checkChatLimit(deps.db, deps.cfg, deps.visitorHash, deps.now)).ok)) {
        const t0 = Date.now();
        try {
          const ai = await tafsirShadeDenganAi(deps.model, niat.teks, sources);
          await logAi(deps.db, { feature: "padanan_shade", model: ai.model, inputTokens: ai.usage.input, outputTokens: ai.usage.output, latencyMs: Date.now() - t0, ok: Boolean(ai.pilih), visitorHash: deps.visitorHash, at: deps.now }).catch(() => {});
          if (ai.pilih) {
            emit({ type: "status", text: "Mencocokkan warna" });
            return jawabShade(deps.db, ai.pilih.varianId, deps.now);
          }
        } catch (e) {
          await logAi(deps.db, { feature: "padanan_shade", model: deps.model.name, latencyMs: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e), visitorHash: deps.visitorHash, at: deps.now }).catch(() => {});
        }
      }
      return { teks: `Produk itu belum kutemukan di katalog ${MEREK.nama}. Pilih produk dan shade yang paling mirip dengan yang kamu pakai, ya.`, kartu: [{ jenis: "pilih_shade" }] };
    }
    case "video":
      return jawabAksi(deps, { jenis: "video" }, produkId, emit);
    case "link":
      return null; // ditangani jawabLink
  }
}

async function jawabLink(deps: TanyaDeps, niat: Extract<Niat, { jenis: "link" }>, emit: Emit): Promise<{ j: Jawaban; jalur: Jalur }> {
  if (niat.link.kind === "lainnya") {
    const host = niat.link.host.replace(/^www\./, "");
    const nama = /instagram\.com$|instagr\.am$/.test(host) ? "Instagram" : /shopee\./.test(host) ? "Shopee" : /tokopedia\.com$/.test(host) ? "Tokopedia" : host;
    return { jalur: "aturan", j: { teks: `Link ${nama} belum bisa kami buka. Kirim screenshot produknya saja, ya, hasilnya sama bagusnya.`, kartu: [{ jenis: "unggah", alasan: `Screenshot dari ${nama} yang menampilkan produknya` }] } };
  }
  if (niat.link.kind !== "tiktok" && niat.link.kind !== "youtube") return { jalur: "aturan", j: { teks: "Link-nya belum bisa kami baca. Tempel link lengkap dari TikTok atau YouTube, ya.", kartu: [] } };
  if (!deps.modelFoto) return { jalur: "tanpa_ai", j: { teks: "Membaca video butuh AI yang sedang tidak tersedia. Kamu tetap bisa mencari produknya lewat kotak cari, ya.", kartu: [] } };
  if (!deps.skipLimits) {
    const limit = await checkDailyFeatureLimit(deps.db, deps.cfg, deps.visitorHash, "dupe", LIMITS.dupePerDay, deps.now, "cari dari video");
    if (!limit.ok) return { jalur: "batas", j: { teks: limit.message, kartu: [] } };
  }
  const outcome = await dupeFromLink({ db: deps.db, model: deps.modelFoto, now: deps.now, visitorHash: deps.visitorHash, fetchImpl: deps.fetchImpl, sleep: deps.sleep, skipCache: deps.skipCache, onStatus: (text) => emit({ type: "status", text }) }, niat.raw);
  if (!outcome.ok) return { jalur: "link", j: { teks: outcome.message, kartu: outcome.suggestScreenshot ? [{ jenis: "unggah", alasan: "Screenshot dari video yang menampilkan produknya" }] : [] } };
  const k = await kartuDupe(deps.db, outcome, deps.now);
  if (k.jenis !== "dupe") return { jalur: "link", j: { teks: "", kartu: [] } };
  return { jalur: "link", j: { teks: teksDupe(k), kartu: [k, ...(k.tipe === "tidak_dikenali" ? [{ jenis: "unggah" as const, alasan: "Screenshot yang menampilkan produknya dengan jelas" }] : [])] } };
}

export async function jawabTanya(deps: TanyaDeps, input: TanyaInput, emit: Emit = () => {}): Promise<TanyaHasil> {
  const produkId = input.produkId ?? null;
  const done = (j: Jawaban, jalur: Jalur, niat: string | null, extra: Partial<TanyaHasil> = {}): TanyaHasil => ({ ok: true, teks: j.teks, kartu: j.kartu, chips: j.chips ?? [], jalur, niat, usage: { input: 0, output: 0 }, toolCalls: [], firstTextMs: null, ...extra });

  if (input.aksi) return done(await jawabAksi(deps, input.aksi, produkId, emit), "aturan", `aksi:${input.aksi.jenis}`);

  const question = [...input.history].reverse().find((t) => t.role === "user")?.text ?? "";
  const niat = kenaliNiat(question);
  if (niat?.jenis === "link") {
    const r = await jawabLink(deps, niat, emit);
    return done(r.j, r.jalur, `link:${niat.link.kind}`);
  }
  if (niat) {
    const j = await jawabNiat(deps, niat, produkId, emit);
    if (j) return done(j, "aturan", niat.jenis);
  }

  // Pertanyaan bebas: Advisor. Tanpa AI atau kuota habis, tawarkan kemampuan berbasis aturan.
  const fallback = (teks: string, jalur: Jalur): TanyaHasil => done({ teks, kartu: question ? [{ jenis: "info", judul: "Cari langsung di katalog", paragraf: [], tautan: { href: `/cari?q=${encodeURIComponent(question.slice(0, 80))}`, label: `Cari "${question.slice(0, 40)}"` } }] : [], chips: chipAturan({ aiFoto: Boolean(deps.modelFoto) }) }, jalur, niat?.jenis ?? null);
  if (!deps.model) return fallback("Untuk pertanyaan bebas, AI sedang tidak tersedia. Kamu tetap bisa memakai pilihan di bawah atau mencari langsung.", "tanpa_ai");
  if (!deps.skipLimits) {
    const limit = await checkChatLimit(deps.db, deps.cfg, deps.visitorHash, deps.now);
    if (!limit.ok) return fallback(limit.message, "batas");
  }
  const r = await runAdvisor(deps.db, deps.model, { history: input.history, productId: produkId, profile: deps.profile, now: deps.now, loggedIn: Boolean(deps.customerId), timeoutMs: deps.timeoutMs }, (e) => emit(e));
  const products = r.products.length && !r.kartu.some((k) => k.jenis === "rutinitas") ? await produkKartu(deps.db, r.products.map((p) => ({ id: p.id, alasan: p.alasan })), deps.now) : [];
  // Total paket dihitung server dari harga efektif kartu, bukan dari model.
  const kartu: Kartu[] = [...(products.length ? [{ jenis: "produk" as const, produk: products, total: products.length > 1 ? products.reduce((s, p) => s + p.price, 0) : null }] : []), ...r.kartu];
  return { ok: r.ok, teks: r.text, kartu, chips: r.ok ? [] : chipAturan({ aiFoto: Boolean(deps.modelFoto) }), jalur: "ai", niat: niat?.jenis ?? null, usage: r.usage, toolCalls: r.toolCalls, firstTextMs: r.firstTextMs, error: r.error };
}
