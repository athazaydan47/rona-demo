// Tampilan log aktivitas yang manusiawi (Fase 8B). Data sebelum dan sesudah tetap tersimpan mentah di audit_logs;
// modul ini hanya menerjemahkan saat tampil: id lokasi, varian, staf, pelanggan, dan kategori menjadi nama, daftar
// baris stok menjadi "Teduh Gentle Milk Cleanser 150 ml × 2", kunci menjadi label, uang menjadi rupiah, waktu menjadi WIB.
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { PERMISSIONS, ROLE_TEMPLATES, type RoleSlug } from "./permissions";

export type AuditNames = {
  locations: Map<number, string>;
  variants: Map<number, string>; // "Nama produk Shade" atau nama produk saja untuk produk satu varian
  staff: Map<number, string>;
  customers: Map<number, string>;
  categories: Map<number, string>;
};

export const EMPTY_NAMES: AuditNames = { locations: new Map(), variants: new Map(), staff: new Map(), customers: new Map(), categories: new Map() };

// Label kunci data sebelum dan sesudah. Kunci pengaturan memakai nama baris di tabel settings.
export const AUDIT_KEY_LABELS: Record<string, string> = {
  publik: "Ditawarkan ke pembeli",
  baris: "Barang",
  lokasiId: "Lokasi",
  lokasi: "Lokasi",
  dari: "Dari",
  ke: "Ke",
  catatan: "Catatan",
  status: "Status",
  alasan: "Alasan",
  resi: "Nomor resi",
  kurir: "Kurir",
  harga: "Harga",
  kuota: "Kuota",
  maks: "Maks per pembeli",
  nama: "Nama",
  induk: "Induk",
  warna: "Warna",
  slug: "Slug",
  mulai: "Mulai",
  selesai: "Selesai",
  aktif: "Aktif",
  tipe: "Jenis",
  nilai: "Nilai",
  minimal: "Belanja minimal",
  judul: "Judul",
  pesan: "Pesan",
  balasan: "Balasan",
  saldo: "Saldo poin",
  email: "Email",
  peran: "Peran",
  izinTambahan: "Izin tambahan",
  izinDicabut: "Izin dicabut",
  percobaan: "Percobaan",
  promo: "Harga promo",
  alamat: "Alamat",
  kecamatan: "Kecamatan",
  telepon: "Telepon",
  jam: "Jam buka",
  libur: "Tanggal libur",
  ambil: "Bisa Ambil di Toko",
  lat: "Lintang",
  lng: "Bujur",
  durationMs: "Durasi",
  truncateMs: "Mengosongkan tabel",
  seedMs: "Mengisi data",
  photos: "Foto ulasan dihapus",
  "toko.profil": "Profil toko",
  "toko.cutoff": "Batas jam pesan",
  "kurir.instan": "Jam kurir instan",
  "kurir.aktif": "Kurir aktif",
  "ongkir.tarif": "Tarif ongkir",
  "bayar.metode": "Metode bayar",
  "stok.ambangMenipis": "Ambang stok menipis",
  "ongkir.gratisMinimal": "Gratis ongkir mulai",
  "ongkir.gratisMaks": "Potongan ongkir maksimal",
  "promo.bar": "Pesan PromoBar",
  "ai.saran": "Saran AI",
  "ai.gaya": "Panduan gaya bahasa",
};

const MONEY_KEYS = new Set(["harga", "nilai", "minimal", "promo", "ongkir.gratisMinimal", "ongkir.gratisMaks", "normal", "jual"]);
const TIME_KEYS = new Set(["mulai", "selesai"]);
const MS_KEYS = new Set(["durationMs", "truncateMs", "seedMs"]);
const PERMISSION_LABELS = new Map<string, string>(PERMISSIONS.map((p) => [p.key, p.label]));
const isRecord = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);
const asId = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

export const auditKeyLabel = (key: string) => AUDIT_KEY_LABELS[key] ?? (/^\d+$/.test(key) ? `Varian ${key}` : key.replace(/[._]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()));

type Row = { action: string; before: unknown; after: unknown; staffId?: number | null; objectType?: string; objectId?: string };

// Kumpulkan semua id yang perlu dicari namanya dari baris log yang tampil.
export function collectAuditRefs(rows: Row[]) {
  const refs = { locations: new Set<number>(), variants: new Set<number>(), staff: new Set<number>(), customers: new Set<number>(), categories: new Set<number>() };
  const visit = (key: string, v: unknown, action: string) => {
    if (key === "baris" && Array.isArray(v)) {
      for (const l of v) if (isRecord(l) && asId(l.variantId) != null) refs.variants.add(asId(l.variantId)!);
      return;
    }
    if (key === "lokasiId" || key === "dari" || key === "ke") {
      const id = asId(v);
      if (id != null) refs.locations.add(id);
    }
    if (key === "lokasi" && Array.isArray(v)) for (const x of v) if (asId(x) != null) refs.locations.add(asId(x)!);
    if (key === "induk" && asId(v) != null) refs.categories.add(asId(v)!);
    // Opname menyimpan stok per varian dengan id varian sebagai kunci.
    if (action === "stok.opname" && /^\d+$/.test(key)) refs.variants.add(Number(key));
  };
  for (const r of rows) {
    for (const side of [r.before, r.after]) if (isRecord(side)) for (const [k, v] of Object.entries(side)) visit(k, v, r.action);
    if (r.objectType === "staf" && asId(r.objectId) != null) refs.staff.add(asId(r.objectId)!);
    if (r.objectType === "pelanggan" && asId(r.objectId) != null) refs.customers.add(asId(r.objectId)!);
  }
  return refs;
}

export async function loadAuditNames(db: AnyDb, rows: Row[]): Promise<AuditNames> {
  const refs = collectAuditRefs(rows);
  const ids = (s: Set<number>) => [...s];
  const [locs, vars, staff, customers, cats] = await Promise.all([
    refs.locations.size ? db.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(inArray(schema.locations.id, ids(refs.locations))) : [],
    refs.variants.size
      ? db
          .select({ id: schema.variants.id, shade: schema.variants.shadeName, product: schema.products.name, sku: schema.variants.sku })
          .from(schema.variants)
          .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
          .where(inArray(schema.variants.id, ids(refs.variants)))
      : [],
    refs.staff.size ? db.select({ id: schema.staff.id, name: schema.staff.name }).from(schema.staff).where(inArray(schema.staff.id, ids(refs.staff))) : [],
    refs.customers.size ? db.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).where(inArray(schema.customers.id, ids(refs.customers))) : [],
    refs.categories.size ? db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).where(inArray(schema.categories.id, ids(refs.categories))) : [],
  ]);
  return {
    locations: new Map(locs.map((l) => [l.id, l.name])),
    variants: new Map(vars.map((v) => [v.id, variantLabel(v.product, v.shade)])),
    staff: new Map(staff.map((s) => [s.id, s.name])),
    customers: new Map(customers.map((c) => [c.id, c.name])),
    categories: new Map(cats.map((c) => [c.id, c.name])),
  };
}

// "Teduh Gentle Milk Cleanser 150 ml" untuk produk satu varian ("Standar" tidak ditulis), selain itu nama dan shade.
export const variantLabel = (product: string, shade: string) => (!shade || /^standar$/i.test(shade) || product.toLowerCase().includes(shade.toLowerCase()) ? product : `${product} ${shade}`);

const nameOr = (map: Map<number, string>, v: unknown, fallback: string) => {
  const id = asId(v);
  return id != null ? (map.get(id) ?? `${fallback} #${id}`) : String(v);
};

// Nilai satu kunci menjadi teks. Nilai kosong (undefined) ditangani pemanggil.
export function formatAuditValue(key: string, value: unknown, names: AuditNames = EMPTY_NAMES, action = ""): string {
  if (value === null) return "kosong";
  if (key === "baris" && Array.isArray(value)) {
    return value.map((l) => (isRecord(l) ? `${nameOr(names.variants, l.variantId, "Varian")} × ${Number(l.quantity ?? 0)}` : String(l))).join(", ");
  }
  if (key === "lokasiId" || key === "dari" || key === "ke") return nameOr(names.locations, value, "Lokasi");
  if (key === "lokasi" && Array.isArray(value)) return value.length ? value.map((x) => nameOr(names.locations, x, "Lokasi")).join(", ") : "semua lokasi";
  if (key === "induk") return value == null ? "tanpa induk" : nameOr(names.categories, value, "Kategori");
  if (key === "peran" && typeof value === "string") return ROLE_TEMPLATES[value as RoleSlug]?.name ?? value;
  if ((key === "izinTambahan" || key === "izinDicabut") && Array.isArray(value)) return value.length ? value.map((p) => PERMISSION_LABELS.get(String(p)) ?? String(p)).join(", ") : "tidak ada";
  if (key === "status" && typeof value === "string" && value in statusLabels) return statusLabels[value as OrderStatus];
  if (action === "stok.opname" && /^\d+$/.test(key)) return `${value} pcs`;
  if (MS_KEYS.has(key) && typeof value === "number") return `${value.toLocaleString("id-ID")} ms`;
  if (TIME_KEYS.has(key) && typeof value === "string" && !Number.isNaN(Date.parse(value))) return formatDateTimeWib(new Date(value));
  if (MONEY_KEYS.has(key) && typeof value === "number") return formatRupiah(value);
  if (typeof value === "boolean") return value ? "ya" : "tidak";
  if (typeof value === "string") return value || "kosong";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (Array.isArray(value)) return value.length ? value.map((x) => (isRecord(x) || Array.isArray(x) ? formatAuditValue("", x, names) : String(x))).join(", ") : "kosong";
  if (isRecord(value)) {
    // Harga per SKU di produk: { "SKU-1": { normal, jual } } menjadi "SKU-1: Rp 129.000 (normal Rp 149.000)".
    return Object.entries(value)
      .map(([k, v]) => {
        if (isRecord(v) && "jual" in v) return `${k}: ${formatRupiah(Number(v.jual))}${Number(v.normal) !== Number(v.jual) ? ` (normal ${formatRupiah(Number(v.normal))})` : ""}`;
        return `${auditKeyLabel(k)}: ${formatAuditValue(k, v, names, action)}`;
      })
      .join("; ");
  }
  return String(value);
}

export type AuditDiffView = { key: string; label: string; before?: string; after?: string };

// Beda sebelum dan sesudah siap tampil: hanya kunci yang berubah, dengan label dan nilai yang sudah diterjemahkan.
export function auditDiffView(action: string, before: unknown, after: unknown, names: AuditNames = EMPTY_NAMES): AuditDiffView[] {
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({
      key: k,
      label: action === "stok.opname" && /^\d+$/.test(k) ? nameOr(names.variants, k, "Varian") : auditKeyLabel(k),
      before: k in b ? formatAuditValue(k, b[k], names, action) : undefined,
      after: k in a ? formatAuditValue(k, a[k], names, action) : undefined,
    }));
}

// Objek log: id staf dan pelanggan menjadi nama; nomor pesanan, referensi stok, dan slug tetap apa adanya.
export function auditObjectLabel(objectType: string, objectId: string, names: AuditNames = EMPTY_NAMES) {
  if (objectType === "staf" && asId(objectId) != null) return names.staff.get(asId(objectId)!) ?? objectId;
  if (objectType === "pelanggan" && asId(objectId) != null) return names.customers.get(asId(objectId)!) ?? objectId;
  return objectId;
}
