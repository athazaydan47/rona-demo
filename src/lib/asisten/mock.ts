// Model mock Asisten Admin (AI_PROVIDER=mock) untuk uji, Playwright, dan cuplik. Deterministik: maksud pertanyaan
// dikenali dengan aturan sederhana, lalu tool baca sungguhan dipanggil lewat jalur yang sama dengan model asli, dan
// jawaban disusun dari hasil tool (angka apa adanya).
import type { Content, GenRequest, GenResponse, Part } from "@/lib/ai/client";
import { formatRupiah } from "@/lib/format";

const est = (s: string) => Math.ceil(s.length / 4);
function reply(parts: Part[], req: GenRequest): GenResponse {
  return {
    content: { role: "model", parts },
    text: parts.map((p) => p.text ?? "").join(""),
    functionCalls: parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
    usage: { input: est(JSON.stringify(req.contents)) + est(req.system ?? ""), output: est(JSON.stringify(parts)) },
    model: "mock",
  };
}
const call = (name: string, args: Record<string, unknown> = {}): Part => ({ functionCall: { name, args } });
const json = (v: unknown): Part => ({ text: JSON.stringify(v) });
const lastUser = (contents: Content[]) => [...contents].reverse().find((c) => c.role === "user" && c.parts.some((p) => p.text) && !c.parts.some((p) => p.text?.startsWith("Jawaban ditolak")))?.parts.find((p) => p.text)?.text ?? "";

const PERIODS = ["hari ini", "kemarin lusa", "kemarin", "minggu ini", "minggu lalu", "bulan ini", "bulan lalu", "tahun ini"];
function periodIn(q: string) {
  const n = /(\d{1,3}) hari terakhir/.exec(q);
  if (n) return `${n[1]} hari terakhir`;
  return PERIODS.find((p) => q.includes(p));
}
function locationIn(q: string) {
  if (/dinoyo/.test(q)) return "Dinoyo";
  if (/sawojajar/.test(q)) return "Sawojajar";
  if (/soekarno|suhat/.test(q)) return "Soekarno-Hatta";
  if (/gudang/.test(q)) return "Gudang Online";
  return undefined;
}

type Intent = { tool: string; args: Record<string, unknown> } | { direct: string; pilihan?: string[] };
export const COMPARE_CHOICES = ["Hari ini dibanding kemarin", "Minggu ini dibanding minggu lalu", "Bulan ini dibanding bulan lalu"];

export function adminIntent(raw: string): Intent {
  const q = raw.toLowerCase();
  const periode = periodIn(q);
  const lokasi = locationIn(q);
  if (/abaikan|lupakan (semua )?(instruksi|aturan)|kamu sekarang|system prompt|tampilkan prompt/.test(q)) return { direct: "Aku tetap mengikuti aturan asisten: hanya membaca data toko sesuai izinmu. Ada data yang mau kamu cek?" };
  if (/(batal|batalkan)\s+(semua\s+)?pesanan|ubah harga|ganti harga|turunkan harga|naikkan harga|hapus|kosongkan stok|set stok|ubah stok/.test(q)) return { direct: "Maaf, aku hanya bisa membaca data. Membatalkan pesanan, mengubah harga, mengubah stok langsung, dan menghapus data dilakukan sendiri oleh staf yang berwenang di halaman admin." };
  if (/natal|lebaran|tahun baru|imlek/.test(q)) return { direct: "Tanggal berapa sampai berapa periode yang kamu maksud? Misal 20 sampai 26 Des 2025." };
  if (/advisor/.test(q)) return { tool: "kinerja_advisor", args: { periode: periode ?? "30 hari terakhir" } };
  if (/kinerja flash/.test(q)) return { tool: "kinerja_flash_sale", args: { periode: periode ?? "30 hari terakhir" } };
  if (/^(cara|bagaimana|gimana|langkah)|cara (membuat|bikin|buat|transfer|opname|balas|tambah|atur|pakai|mengatur|mencatat|membalas|menambah)/.test(q)) return { tool: "panduan_admin", args: { topik: raw } };
  if (/transfer|pindahkan|kirim semua stok/.test(q)) return { tool: "saran_transfer_stok", args: lokasi ? { lokasi } : {} };
  if (/flash/.test(q)) return { tool: "saran_flash_sale", args: {} };
  if (/habis|menipis/.test(q) && !/diminta|ditunggu|peminat/.test(q)) return { tool: "stok_menipis", args: lokasi ? { lokasi } : {} };
  if (/kabari|diminta|peminat|ditunggu|paling banyak dicari/.test(q)) return { tool: "permintaan_kabari_aku", args: {} };
  if (/stok/.test(q) && /menipis|habis|kosong|tipis|hampir/.test(q)) return { tool: "stok_menipis", args: lokasi ? { lokasi } : {} };
  if (/stok/.test(q)) {
    const cari = q.replace(/stok|berapa|di sini|ada|masih|yang|cek|tolong|\?/g, " ").replace(/\b(di )?(dinoyo|sawojajar|soekarno[- ]hatta|suhat|gudang online|gudang)\b/g, " ").replace(/\bshade\b/g, " ").replace(/\s+/g, " ").trim();
    if (!cari) return { direct: "Produk atau shade apa yang mau dicek stoknya?" };
    return { tool: "stok_varian", args: { cari, ...(lokasi ? { lokasi } : {}) } };
  }
  const nomor = /rona-\d{4}-\d{6}/i.exec(raw)?.[0] ?? /(?:08|62)\d{8,12}/.exec(raw)?.[0];
  if (nomor) return { tool: "cari_pesanan", args: { cari: nomor } };
  if ((/berapa pesanan|rata-rata nilai pesanan|unit terjual/.test(q) || (/pesanan/.test(q) && periode && !/ambil|tindakan|proses/.test(q))) && !/kinerja/.test(q)) return { tool: "ringkasan_penjualan", args: { periode: periode ?? "30 hari terakhir", ...(lokasi ? { cabang: lokasi } : {}) } };
  if (/pesanan|ambil hari ini|perlu tindakan|diproses/.test(q) && !/omzet/.test(q)) return { tool: "pesanan_perlu_tindakan", args: lokasi ? { cabang: lokasi } : {} };
  if (/voucher/.test(q)) return { tool: "kinerja_voucher", args: { periode: periode ?? "30 hari terakhir" } };
  if (/advisor/.test(q)) return { tool: "kinerja_advisor", args: { periode: periode ?? "30 hari terakhir" } };
  if (/ulasan|review|bintang/.test(q)) return { tool: "ringkasan_ulasan", args: { periode: periode ?? "30 hari terakhir" } };
  if (/pelanggan|pembeli baru|segmen/.test(q)) return { tool: "ringkasan_pelanggan", args: { periode: periode ?? "30 hari terakhir" } };
  if (/merek/.test(q)) return { tool: "penjualan_per", args: { dimensi: "merek", periode: periode ?? "30 hari terakhir", ...(lokasi ? { cabang: lokasi } : {}) } };
  if (/kategori/.test(q)) return { tool: "penjualan_per", args: { dimensi: "kategori", periode: periode ?? "30 hari terakhir", ...(lokasi ? { cabang: lokasi } : {}) } };
  if (/kanal/.test(q)) return { tool: "penjualan_per", args: { dimensi: "kanal", periode: periode ?? "30 hari terakhir" } };
  if (/per cabang|cabang mana|tiap cabang/.test(q)) return { tool: "penjualan_per", args: { dimensi: "cabang", periode: periode ?? "30 hari terakhir" } };
  if (/terlaris|paling laku|best ?seller/.test(q)) return { tool: "produk_terlaris", args: { periode: periode ?? "30 hari terakhir", ...(lokasi ? { cabang: lokasi } : {}) } };
  if (/omzet|penjualan|pendapatan|jualan|revenue/.test(q)) {
    if (!periode && /banding/.test(q)) return { direct: "Mau dibandingkan untuk periode apa?", pilihan: COMPARE_CHOICES };
    const pembanding = /banding\w*\s+(?:dengan\s+)?(minggu lalu|bulan lalu|kemarin)/.exec(q)?.[1];
    return { tool: "ringkasan_penjualan", args: { periode: periode ?? "30 hari terakhir", ...(pembanding ? { pembanding } : {}), ...(lokasi ? { cabang: lokasi } : {}) } };
  }
  if (/banding/.test(q)) return { direct: "Mau dibandingkan untuk periode apa?", pilihan: COMPARE_CHOICES };
  return { direct: "Aku belum paham pertanyaannya. Coba sebut datanya, misal omzet minggu ini atau stok cushion 02N di Dinoyo." };
}

const rp = (n: unknown) => (typeof n === "number" ? formatRupiah(n) : "");
const pct = (n: unknown) => (typeof n === "number" ? `${String(n).replace(".", ",")}%` : "");
type R = Record<string, unknown>;

function compose(name: string, r: R): { teks: string; angka: { nilai: string; sumber: string }[]; tabel?: { kolom: string[]; baris: string[][] }; tautan: { label: string; href: string }[] } {
  const tautan = r.tautan && typeof r.tautan === "object" ? [r.tautan as { label: string; href: string }] : [];
  const status = r.status as string | undefined;
  if (status === "ambigu") return { teks: `Ada beberapa ${r.jenis} yang cocok dengan "${r.dicari}": ${(r.kandidat as string[]).join(", ")}. Yang mana maksudmu?`, angka: [], tautan: [] };
  if (status) return { teks: String(r.pesan ?? "Datanya belum bisa dibaca."), angka: [], tautan: [] };
  const sem = r.sementara ? " (sementara, hari ini belum selesai)" : "";
  const izin = r.catatanIzin ? ` ${r.catatanIzin}` : "";
  switch (name) {
    case "ringkasan_penjualan": {
      const b = r.pembanding as R;
      const ch = (r.perubahanPersen as R)?.omzet;
      if (r.omzetRp == null) return { teks: `${r.periode}${sem}: ${r.pesanan} pesanan dibayar.${izin}`, angka: [{ nilai: String(r.pesanan), sumber: "ringkasan_penjualan.pesanan" }], tautan };
      return {
        teks: `Omzet ${r.periode}${sem}: ${rp(r.omzetRp)} dari ${r.pesanan} pesanan, rata-rata ${rp(r.rataRataPesananRp)}. Pembanding ${b.periode}: ${rp(b.omzetRp)}${ch == null ? "" : ` (${pct(ch)})`}. Omzet dihitung dari pesanan yang dibayar, tanpa yang batal atau retur.`,
        angka: [
          { nilai: rp(r.omzetRp), sumber: "ringkasan_penjualan.omzetRp" },
          { nilai: String(r.pesanan), sumber: "ringkasan_penjualan.pesanan" },
          { nilai: rp(b.omzetRp), sumber: "ringkasan_penjualan.pembanding.omzetRp" },
        ],
        tautan,
      };
    }
    case "stok_varian": {
      const v = (r.varian as R[]) ?? [];
      return {
        teks: `Stok tersedia per ${r.waktu}, ${r.cabang}.`,
        angka: [],
        tabel: { kolom: ["Varian", "Lokasi", "Tersedia"], baris: v.flatMap((x) => (x.lokasi as R[]).map((l) => [`${x.produk} ${x.shade}`, String(l.nama), l.tersedia == null ? "-" : String(l.tersedia)])).slice(0, 6) },
        tautan: v[0] ? [{ label: "Buka buku stok", href: String(v[0].tautan) }] : [],
      };
    }
    case "saran_transfer_stok": {
      const s = (r.saran as R[]) ?? [];
      if (!s.length) return { teks: `Belum ada saran transfer untuk ${r.cabang}. ${r.aturan}`, angka: [], tautan };
      const draft = s.find((x) => x.tautanDraf);
      return { teks: `Ada ${r.totalSaran} saran transfer. ${s[0].alasan}`, angka: [], tabel: { kolom: ["Varian", "Dari", "Ke", "Jumlah"], baris: s.slice(0, 5).map((x) => [`${x.produk} ${x.shade}`, String(x.dari), String(x.ke), String(x.jumlah)]) }, tautan: draft ? [{ label: "Buka draf transfer", href: String(draft.tautanDraf) }, ...tautan] : tautan };
    }
    case "saran_flash_sale": {
      const s = (r.saran as R[]) ?? [];
      return { teks: s.length ? `Ada ${s.length} kandidat flash sale. ${s[0].alasan}` : "Belum ada kandidat flash sale.", angka: [], tabel: s.length ? { kolom: ["Varian", "Diskon", "Kuota"], baris: s.slice(0, 5).map((x) => [`${x.produk} ${x.shade}`, `${x.diskonPersen}%`, String(x.kuota)]) } : undefined, tautan: s[0]?.tautanDraf ? [{ label: "Buka draf flash sale", href: String(s[0].tautanDraf) }, ...tautan] : tautan };
    }
    case "panduan_admin":
      return { teks: `${r.judul}: ${String(r.isi ?? "").replace(/\n+/g, " ").slice(0, 400)}`, angka: [], tautan: [] };
    case "pesanan_perlu_tindakan": {
      const pick = (r.ambilDiToko as R[]) ?? [];
      return { teks: `Ada ${r.totalAmbilAktif} pesanan ambil di toko yang aktif di ${r.cabang}.`, angka: [], tabel: pick.length ? { kolom: ["Nomor", "Status", "Cabang"], baris: pick.slice(0, 6).map((o) => [String(o.nomor), String(o.status), String(o.cabang)]) } : undefined, tautan };
    }
    default: {
      const rows = (Object.values(r).find((v) => Array.isArray(v) && v.length && typeof v[0] === "object") as R[] | undefined) ?? [];
      const cols = rows[0] ? Object.keys(rows[0]).filter((k) => !k.startsWith("tautan")).slice(0, 4) : [];
      return { teks: `Ini datanya untuk ${r.periode ?? "saat ini"}${sem}.${izin}`, angka: [], tabel: cols.length ? { kolom: cols, baris: rows.slice(0, 6).map((x) => cols.map((c) => (c.endsWith("Rp") ? rp(x[c]) : String(x[c] ?? "")))) } : undefined, tautan };
    }
  }
}

export function adminMockTurn(req: GenRequest): GenResponse {
  const last = req.contents[req.contents.length - 1];
  const responses = last?.parts.filter((p) => p.functionResponse) ?? [];
  if (req.toolMode === "ANY") {
    const intent = adminIntent(lastUser(req.contents));
    const allowed = new Set((req.tools ?? []).map((t) => t.name));
    if ("direct" in intent) return reply([call("jawabLangsung", { teks: intent.direct, ...(intent.pilihan ? { pilihan: intent.pilihan } : {}) })], req);
    if (!allowed.has(intent.tool)) return reply([call("jawabLangsung", { teks: "Maaf, data itu di luar izin peranmu. Coba tanyakan ke owner, ya." })], req);
    return reply([call(intent.tool, intent.args)], req);
  }
  // Kabar Harian: narasi dari data yang sudah dihitung.
  const prompt = lastUser(req.contents);
  if (/^TUGAS: kabar_harian/.test(prompt)) {
    const data = JSON.parse(/Data \(sudah dihitung, pakai apa adanya\): ([\s\S]+)$/.exec(prompt)?.[1] ?? "{}") as R;
    const top = (data.terlaris as R[] | undefined)?.[0];
    const teks = `Kemarin omzet ${rp(data.omzetRp)} dari ${data.pesanan} pesanan.${top ? ` Paling laku ${top.produk}.` : ""} ${data.ulasanBurukBelumDibalas ? `Ada ${data.ulasanBurukBelumDibalas} ulasan buruk yang menunggu balasan.` : "Tidak ada ulasan buruk yang menunggu."}`;
    return reply([json({ teks, angka: [], tautan: [] })], req);
  }
  if (!responses.length) return reply([json({ teks: "Maaf, aku ulangi hanya dengan angka dari data.", angka: [], tautan: [] })], req);
  const r = responses[0].functionResponse!;
  return reply([json(compose(r.name, r.response as R))], req);
}
