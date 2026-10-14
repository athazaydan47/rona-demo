// Skema masukan dari browser (Fase 8B). Setiap server action dan route handler memeriksa sesi dan izin lebih dulu,
// lalu bentuk datanya dengan zod sebelum diteruskan ke modul layanan (yang tetap menegakkan aturan bisnis).
// Batas panjang di sini mencegah muatan raksasa; aturan isi (harga, stok, slug unik) ada di modul masing-masing.
import { z } from "zod";

export const id = z.coerce.number().int().positive().max(2_147_483_647);
export const idOpsional = id.nullable().optional();
export const skemaId = id;
export const daftarId = (max = 200) => z.array(id).max(max);
export const teks = (max: number) => z.string().max(max);
export const tanggalIso = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.");
export const rupiah = z.coerce.number().int().min(0).max(1_000_000_000);
export const nomorPesanan = z.string().trim().toUpperCase().max(30);
export const nomorWa = z.string().max(30);
export const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/);

// Ambil data yang lolos skema, atau null (pemanggil menjawab "Data tidak valid.").
export function cocok<T extends z.ZodType>(skema: T, raw: unknown): z.output<T> | null {
  const r = skema.safeParse(raw);
  return r.success ? r.data : null;
}

export const TIDAK_VALID = { ok: false as const, message: "Data tidak valid." };

// Aksi chip dan kartu chat asisten (Fase 8C).
const aksi = z.discriminatedUnion("jenis", [
  z.object({ jenis: z.literal("rekomendasi") }),
  z.object({ jenis: z.literal("kuis") }),
  z.object({ jenis: z.literal("rutinitas") }),
  z.object({ jenis: z.literal("video") }),
  z.object({ jenis: z.literal("shade"), varianId: id.optional() }),
  z.object({ jenis: z.literal("lacak"), nomor: nomorPesanan.optional(), wa: nomorWa.optional() }),
  z.object({ jenis: z.literal("ongkir"), kota: teks(60).optional(), kode: z.string().regex(/^[a-z0-9.-]{2,30}$/).optional() }),
  z.object({ jenis: z.literal("cabang") }),
  z.object({ jenis: z.literal("promo") }),
  z.object({ jenis: z.literal("bantuan"), topik: z.enum(["retur", "bayar", "kirim", "faq", "kontak"]) }),
  z.object({ jenis: z.literal("cocok"), produkId: id.optional() }),
]);

export const skema = {
  aksiTanya: aksi,
  kategori: z.object({ id: idOpsional, name: teks(80), parentId: idOpsional, description: teks(400).optional(), force: z.boolean().optional() }),
  susunanKategori: z.array(z.object({ id, parentId: idOpsional, sortOrder: z.coerce.number().int().min(0).max(10_000) })).max(200),
  merek: z.object({ id: idOpsional, name: teks(80), slug: teks(80).optional(), color: teks(9), tagline: teks(160).optional(), description: teks(1000).optional(), force: z.boolean().optional() }),
  slotFlash: z.object({ name: teks(80), startsAt: tanggalIso, endsAt: tanggalIso }),
  itemFlash: z.object({ slotId: id, variantId: id, flashPrice: rupiah, quota: z.coerce.number().int().min(0).max(100_000), maxPerCustomer: z.coerce.number().int().min(1).max(100), confirmRunning: z.boolean().optional() }),
  promoVarian: z.object({ variantId: id, promoPrice: rupiah.nullable(), startsAt: tanggalIso.nullable(), endsAt: tanggalIso.nullable() }),
  promoBar: z.array(teks(160)).max(10),
  // Pengaturan dinormalisasi dan divalidasi ulang penuh di modul pengaturan; di sini hanya bentuk luarnya.
  pengaturan: z.object({ profile: z.record(z.string(), z.unknown()), cutoff: z.record(z.string(), z.unknown()), instant: z.record(z.string(), z.unknown()), couriers: z.record(z.string(), z.unknown()), payments: z.array(teks(30)).max(20), lowStock: z.unknown(), freeShipping: z.record(z.string(), z.unknown()), saran: z.unknown().optional(), gaya: z.unknown().optional() }).loose(),
  cabang: z.object({ address: teks(200), district: teks(80), city: teks(80), phone: teks(30), lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), openingHours: z.record(z.string(), z.unknown()), closedDates: z.array(teks(10)).max(60), canPickup: z.boolean() }),
  sembunyikanUlasan: z.object({ ids: daftarId(100), reason: teks(300) }),
  balasUlasan: z.object({ id, text: teks(2000), aiAssisted: z.boolean().optional() }),
  nomorPesananList: z.array(nomorPesanan).max(100),
  profil: z.object({ name: teks(80), email: teks(120) }),
  profilKulit: z.record(z.string(), z.unknown()),
  telepon: z.object({ phone: nomorWa }),
  verifikasiOtp: z.object({ phone: nomorWa, code: teks(10), kembali: teks(300).optional(), guestWishlist: z.array(id).max(200).optional() }),
  masukDemo: z.object({ kembali: teks(300).optional(), guestWishlist: z.array(id).max(200).optional() }),
  nama: z.object({ name: teks(80) }),
  masukStaf: z.object({ email: teks(160), password: teks(200), kembali: teks(300).optional() }),
  masukStafDemo: z.object({ email: teks(160), kembali: teks(300).optional() }),
  kuis: z.record(z.string(), z.unknown()),
  profilShade: z.object({ depth: z.coerce.number().int().min(1).max(6), undertone: teks(20) }),
  varian: z.object({ variantId: id }),
  deskripsiAi: z.object({ name: teks(120), brand: teks(60), category: teks(60), activeIngredients: z.array(teks(60)).max(15).optional(), skinTypes: z.array(teks(20)).max(6).optional(), finish: teks(20).nullable().optional(), spf: z.number().int().nullable().optional(), netto: teks(40).optional(), bpom: teks(40).optional(), points: teks(2000).optional(), supplierText: teks(4000).optional(), current: z.record(z.string(), teks(6000)).optional(), variation: teks(20).nullable().optional() }),
};
