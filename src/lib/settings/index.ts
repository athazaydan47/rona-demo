// Pengaturan toko: bentuk data, nilai bawaan (sama dengan aturan di BRIEF), dan normalisasi dari tabel settings.
// Murni, tanpa database, supaya logika harga, ongkir, dan cut-off bisa diuji dengan pengaturan apa pun.
import type { CourierCode, Zone } from "@/lib/shipping";

export type PaymentMethodKey = "qris" | "va_bca" | "va_bni" | "va_bri" | "va_mandiri" | "bayar_di_toko";
export const PAYMENT_METHOD_KEYS: PaymentMethodKey[] = ["qris", "va_bca", "va_bni", "va_bri", "va_mandiri", "bayar_di_toko"];
export const SHIPPING_COURIERS: Exclude<CourierCode, "ambil_di_toko">[] = ["jne_reg", "jne_yes", "jnt_ez", "sicepat_reg", "instan"];
export const ZONES: Zone[] = ["dalam_kota", "jatim", "jawa", "luar_jawa"];

export type CourierRates = Record<Exclude<CourierCode, "ambil_di_toko">, Record<Zone, number | null>>;

export type StoreSettings = {
  profile: { name: string; tagline: string; whatsapp: string; email: string; address: string; city: string };
  cutoff: { ship: string; pickup: string; sundayOff: boolean }; // "15.00" WIB
  instant: { open: number; close: number }; // jam WIB, Senin sampai Sabtu
  couriers: { active: CourierCode[]; rates: CourierRates };
  payments: PaymentMethodKey[];
  lowStock: number;
  freeShipping: { threshold: number; cap: number };
  promoBar: string[];
  seedVersion: number;
  saran: SuggestionSettings;
  gaya: StyleGuide;
};

// Saran transfer stok dan flash sale (Fase 7B). Cabang dianggap akan habis bila stoknya cukup kurang dari kurangHari;
// lokasi lain dianggap berlebih bila cukup lebih dari lebihHari. Diskon flash sale yang diusulkan dalam batas persen.
export type SuggestionSettings = { kurangHari: number; lebihHari: number; flashDiskonMin: number; flashDiskonMaks: number };

// Panduan gaya bahasa toko: acuan semua tulisan AI (deskripsi produk, SEO, balasan ulasan, Kabar Harian).
// Bagian dari kesiapan reskin: bisa diubah per klien di Pengaturan.
export type StyleGuide = {
  nada: string;
  sapaan: string;
  kataDipakai: string[];
  kataDihindari: string[];
  panjang: { ringkas: number; manfaat: number; kandungan: number; caraPakai: number; metaJudul: number; metaDeskripsi: number }; // karakter
  contohProduk: string[]; // slug produk dengan deskripsi terbaik, 2 sampai 3
};

export const DEFAULT_SUGGESTIONS: SuggestionSettings = { kurangHari: 7, lebihHari: 30, flashDiskonMin: 15, flashDiskonMaks: 30 };
export const DEFAULT_STYLE: StyleGuide = {
  nada: "Hangat, singkat, dan jujur, seperti teman yang paham kosmetik. Kalimat pendek, tanpa istilah berlebihan.",
  sapaan: "kamu",
  kataDipakai: ["lembap", "ringan", "nyaman", "tahan lama", "cocok untuk", "terasa"],
  kataDihindari: ["menyembuhkan", "mengobati", "dijamin", "100%", "ajaib", "instan", "permanen", "terbaik di dunia", "kak", "sis"],
  panjang: { ringkas: 160, manfaat: 450, kandungan: 350, caraPakai: 300, metaJudul: 60, metaDeskripsi: 155 },
  contohProduk: ["kirana-lab-niacinamide-10-serum", "pualam-velvet-matte-cushion-spf-50", "lumi-velvet-matte-lipstick"],
};

export const DEFAULT_RATES: CourierRates = {
  jne_reg: { dalam_kota: 9000, jatim: 13000, jawa: 20000, luar_jawa: 34000 },
  jne_yes: { dalam_kota: 16000, jatim: 24000, jawa: 36000, luar_jawa: 58000 },
  jnt_ez: { dalam_kota: 8000, jatim: 12000, jawa: 19000, luar_jawa: 32000 },
  sicepat_reg: { dalam_kota: 8500, jatim: 12500, jawa: 19500, luar_jawa: 33000 },
  instan: { dalam_kota: 15000, jatim: null, jawa: null, luar_jawa: null },
};

export const DEFAULT_SETTINGS: StoreSettings = {
  profile: { name: "Rona Beauty", tagline: "Temukan rona terbaikmu.", whatsapp: "6281200000000", email: "halo@rona.demo", address: "Jl. Veteran No. 8 (fiktif)", city: "Malang" },
  cutoff: { ship: "15.00", pickup: "16.00", sundayOff: true },
  instant: { open: 8, close: 17 },
  couriers: { active: ["jne_reg", "jne_yes", "jnt_ez", "sicepat_reg", "instan", "ambil_di_toko"], rates: DEFAULT_RATES },
  payments: [...PAYMENT_METHOD_KEYS],
  lowStock: 5,
  freeShipping: { threshold: 150_000, cap: 20_000 },
  promoBar: [],
  seedVersion: 0,
  saran: DEFAULT_SUGGESTIONS,
  gaya: DEFAULT_STYLE,
};

// Kunci di tabel settings. Nilai lama dari seed Fase 1 (misal toko.cutoff {kirim, ambil}) tetap terbaca.
export const SETTING_KEYS = {
  profile: "toko.profil",
  cutoff: "toko.cutoff",
  instant: "kurir.instan",
  couriers: "kurir.aktif",
  rates: "ongkir.tarif",
  payments: "bayar.metode",
  lowStock: "stok.ambangMenipis",
  freeMin: "ongkir.gratisMinimal",
  freeCap: "ongkir.gratisMaks",
  promoBar: "promo.bar",
  seedVersion: "demo.versiSeed",
  saran: "ai.saran",
  gaya: "ai.gaya",
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, d: string, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const int = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : d;
};
export const isClock = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3])\.[0-5]\d$/.test(v);
export const clockMinutes = (s: string) => {
  const [h, m] = s.split(".").map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};

export function normalizeSettings(raw: Record<string, unknown>): StoreSettings {
  const d = DEFAULT_SETTINGS;
  const p = isObj(raw[SETTING_KEYS.profile]) ? (raw[SETTING_KEYS.profile] as Record<string, unknown>) : {};
  const c = isObj(raw[SETTING_KEYS.cutoff]) ? (raw[SETTING_KEYS.cutoff] as Record<string, unknown>) : {};
  const i = isObj(raw[SETTING_KEYS.instant]) ? (raw[SETTING_KEYS.instant] as Record<string, unknown>) : {};
  const ratesRaw = isObj(raw[SETTING_KEYS.rates]) ? (raw[SETTING_KEYS.rates] as Record<string, unknown>) : {};
  const rates = Object.fromEntries(
    SHIPPING_COURIERS.map((code) => {
      const r = isObj(ratesRaw[code]) ? (ratesRaw[code] as Record<string, unknown>) : {};
      return [code, Object.fromEntries(ZONES.map((z) => [z, z in r ? (r[z] === null ? null : int(r[z], d.couriers.rates[code][z] ?? 0, 0, 1_000_000)) : d.couriers.rates[code][z]]))];
    }),
  ) as CourierRates;
  const active = Array.isArray(raw[SETTING_KEYS.couriers]) ? (raw[SETTING_KEYS.couriers] as unknown[]).filter((x): x is CourierCode => typeof x === "string" && [...SHIPPING_COURIERS, "ambil_di_toko"].includes(x as CourierCode)) : d.couriers.active;
  const payments = Array.isArray(raw[SETTING_KEYS.payments]) ? (raw[SETTING_KEYS.payments] as unknown[]).filter((x): x is PaymentMethodKey => PAYMENT_METHOD_KEYS.includes(x as PaymentMethodKey)) : d.payments;
  const ship = c.ship ?? c.kirim;
  const pickup = c.pickup ?? c.ambil;
  const open = int(i.open, d.instant.open, 0, 23);
  const close = int(i.close, d.instant.close, 1, 24);
  return {
    profile: {
      name: str(p.name ?? p.nama, d.profile.name, 60),
      tagline: str(p.tagline, d.profile.tagline, 120),
      whatsapp: str(p.whatsapp, d.profile.whatsapp, 20).replace(/\D/g, "") || d.profile.whatsapp,
      email: str(p.email, d.profile.email, 120),
      address: str(p.address ?? p.alamat, d.profile.address, 200),
      city: str(p.city ?? p.kota, d.profile.city, 60),
    },
    cutoff: { ship: isClock(ship) ? ship : d.cutoff.ship, pickup: isClock(pickup) ? pickup : d.cutoff.pickup, sundayOff: typeof (c.sundayOff ?? c.liburMinggu) === "boolean" ? Boolean(c.sundayOff ?? c.liburMinggu) : d.cutoff.sundayOff },
    instant: open < close ? { open, close } : d.instant,
    couriers: { active: active.length ? active : d.couriers.active, rates },
    payments: payments.length ? payments : d.payments,
    lowStock: int(raw[SETTING_KEYS.lowStock], d.lowStock, 0, 1000),
    freeShipping: { threshold: int(raw[SETTING_KEYS.freeMin], d.freeShipping.threshold, 0, 100_000_000), cap: int(raw[SETTING_KEYS.freeCap], d.freeShipping.cap, 0, 10_000_000) },
    promoBar: Array.isArray(raw[SETTING_KEYS.promoBar]) ? (raw[SETTING_KEYS.promoBar] as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 80)).slice(0, 6) : d.promoBar,
    seedVersion: int(raw[SETTING_KEYS.seedVersion], 0, 0, 1_000_000),
    saran: normalizeSuggestions(raw[SETTING_KEYS.saran]),
    gaya: normalizeStyle(raw[SETTING_KEYS.gaya]),
  };
}

export function normalizeSuggestions(v: unknown): SuggestionSettings {
  const d = DEFAULT_SUGGESTIONS;
  const o = isObj(v) ? v : {};
  const min = int(o.flashDiskonMin, d.flashDiskonMin, 1, 90);
  const max = int(o.flashDiskonMaks, d.flashDiskonMaks, 1, 90);
  return { kurangHari: int(o.kurangHari, d.kurangHari, 1, 60), lebihHari: int(o.lebihHari, d.lebihHari, 2, 365), flashDiskonMin: Math.min(min, max), flashDiskonMaks: Math.max(min, max) };
}

const words = (v: unknown, d: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 40)).slice(0, 30) : d);

export function normalizeStyle(v: unknown): StyleGuide {
  const d = DEFAULT_STYLE;
  const o = isObj(v) ? v : {};
  const p = isObj(o.panjang) ? o.panjang : {};
  return {
    nada: str(o.nada, d.nada, 400),
    sapaan: str(o.sapaan, d.sapaan, 20),
    kataDipakai: words(o.kataDipakai, d.kataDipakai),
    kataDihindari: words(o.kataDihindari, d.kataDihindari),
    panjang: {
      ringkas: int(p.ringkas, d.panjang.ringkas, 60, 300),
      manfaat: int(p.manfaat, d.panjang.manfaat, 100, 2000),
      kandungan: int(p.kandungan, d.panjang.kandungan, 100, 2000),
      caraPakai: int(p.caraPakai, d.panjang.caraPakai, 80, 2000),
      metaJudul: int(p.metaJudul, d.panjang.metaJudul, 30, 70),
      metaDeskripsi: int(p.metaDeskripsi, d.panjang.metaDeskripsi, 80, 170),
    },
    contohProduk: Array.isArray(o.contohProduk) ? o.contohProduk.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,120}$/.test(x)).slice(0, 3) : d.contohProduk,
  };
}

// Bentuk baris settings untuk disimpan (kebalikan normalizeSettings).
export function settingsRows(s: StoreSettings): Record<string, unknown> {
  return {
    [SETTING_KEYS.profile]: s.profile,
    [SETTING_KEYS.cutoff]: s.cutoff,
    [SETTING_KEYS.instant]: s.instant,
    [SETTING_KEYS.couriers]: s.couriers.active,
    [SETTING_KEYS.rates]: s.couriers.rates,
    [SETTING_KEYS.payments]: s.payments,
    [SETTING_KEYS.lowStock]: s.lowStock,
    [SETTING_KEYS.freeMin]: s.freeShipping.threshold,
    [SETTING_KEYS.freeCap]: s.freeShipping.cap,
    [SETTING_KEYS.promoBar]: s.promoBar,
    [SETTING_KEYS.saran]: s.saran,
    [SETTING_KEYS.gaya]: s.gaya,
  };
}

// Aturan yang dipakai mesin harga dan ongkir.
export type PricingRules = { freeShippingThreshold: number; freeShippingCap: number; rates: CourierRates; activeCouriers: CourierCode[] };
export const pricingRules = (s: StoreSettings = DEFAULT_SETTINGS): PricingRules => ({ freeShippingThreshold: s.freeShipping.threshold, freeShippingCap: s.freeShipping.cap, rates: s.couriers.rates, activeCouriers: s.couriers.active });
