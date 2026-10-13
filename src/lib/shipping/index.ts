// Modul ongkir murni untuk demo. Tabel zona dari BRIEF; nanti diganti adapter API ongkir sungguhan.

export type Zone = "dalam_kota" | "jatim" | "jawa" | "luar_jawa";

export const zoneLabels: Record<Zone, string> = {
  dalam_kota: "Dalam kota Malang",
  jatim: "Jawa Timur",
  jawa: "Jawa lainnya",
  luar_jawa: "Luar Jawa",
};

export type City = { slug: string; name: string; province: string; zone: Zone };

// Daftar ringkas untuk estimasi cepat di halaman produk. Data wilayah lengkap hadir di Fase 4.
export const quickCities: City[] = [
  { slug: "kota-malang", name: "Kota Malang", province: "Jawa Timur", zone: "dalam_kota" },
  { slug: "kab-malang", name: "Kab. Malang", province: "Jawa Timur", zone: "jatim" },
  { slug: "kota-batu", name: "Kota Batu", province: "Jawa Timur", zone: "jatim" },
  { slug: "surabaya", name: "Surabaya", province: "Jawa Timur", zone: "jatim" },
  { slug: "sidoarjo", name: "Sidoarjo", province: "Jawa Timur", zone: "jatim" },
  { slug: "kediri", name: "Kediri", province: "Jawa Timur", zone: "jatim" },
  { slug: "jember", name: "Jember", province: "Jawa Timur", zone: "jatim" },
  { slug: "jakarta", name: "Jakarta", province: "DKI Jakarta", zone: "jawa" },
  { slug: "bandung", name: "Bandung", province: "Jawa Barat", zone: "jawa" },
  { slug: "semarang", name: "Semarang", province: "Jawa Tengah", zone: "jawa" },
  { slug: "yogyakarta", name: "Yogyakarta", province: "DI Yogyakarta", zone: "jawa" },
  { slug: "solo", name: "Solo", province: "Jawa Tengah", zone: "jawa" },
  { slug: "denpasar", name: "Denpasar", province: "Bali", zone: "luar_jawa" },
  { slug: "medan", name: "Medan", province: "Sumatera Utara", zone: "luar_jawa" },
  { slug: "makassar", name: "Makassar", province: "Sulawesi Selatan", zone: "luar_jawa" },
  { slug: "balikpapan", name: "Balikpapan", province: "Kalimantan Timur", zone: "luar_jawa" },
];

export type CourierCode = "jne_reg" | "jne_yes" | "jnt_ez" | "sicepat_reg" | "instan" | "ambil_di_toko";

export type Courier = {
  code: CourierCode;
  name: string;
  service: string;
  // Tarif per kg per zona; null berarti kurir tidak melayani zona itu.
  ratePerKg: Record<Zone, number | null>;
  // Estimasi tiba per zona dalam hari (min, maks); [0, 0] berarti hari yang sama.
  eta: Record<Zone, [number, number] | null>;
};

export const couriers: Courier[] = [
  {
    code: "jne_reg",
    name: "JNE",
    service: "REG",
    ratePerKg: { dalam_kota: 9000, jatim: 13000, jawa: 20000, luar_jawa: 34000 },
    eta: { dalam_kota: [1, 2], jatim: [2, 3], jawa: [2, 4], luar_jawa: [3, 6] },
  },
  {
    code: "jne_yes",
    name: "JNE",
    service: "YES",
    ratePerKg: { dalam_kota: 16000, jatim: 24000, jawa: 36000, luar_jawa: 58000 },
    eta: { dalam_kota: [1, 1], jatim: [1, 1], jawa: [1, 2], luar_jawa: [2, 3] },
  },
  {
    code: "jnt_ez",
    name: "J&T",
    service: "EZ",
    ratePerKg: { dalam_kota: 8000, jatim: 12000, jawa: 19000, luar_jawa: 32000 },
    eta: { dalam_kota: [1, 2], jatim: [2, 3], jawa: [2, 4], luar_jawa: [3, 6] },
  },
  {
    code: "sicepat_reg",
    name: "SiCepat",
    service: "REG",
    ratePerKg: { dalam_kota: 8500, jatim: 12500, jawa: 19500, luar_jawa: 33000 },
    eta: { dalam_kota: [1, 2], jatim: [1, 3], jawa: [2, 3], luar_jawa: [3, 5] },
  },
  {
    code: "instan",
    name: "Kurir Instan",
    service: "Same day",
    ratePerKg: { dalam_kota: 15000, jatim: null, jawa: null, luar_jawa: null },
    eta: { dalam_kota: [0, 0], jatim: null, jawa: null, luar_jawa: null },
  },
  {
    code: "ambil_di_toko",
    name: "Ambil di Toko",
    service: "Gratis",
    ratePerKg: { dalam_kota: 0, jatim: 0, jawa: 0, luar_jawa: 0 },
    eta: { dalam_kota: [0, 0], jatim: [0, 0], jawa: [0, 0], luar_jawa: [0, 0] },
  },
];

export const WEIGHT_TOLERANCE_GRAM = 300;

// Berat tagih dalam kg: dibulatkan ke atas per kg setelah toleransi 300 gram, minimal 1 kg.
export function billableKg(totalGram: number) {
  if (totalGram <= 0) return 1;
  const kg = Math.ceil((totalGram - WEIGHT_TOLERANCE_GRAM) / 1000);
  return Math.max(1, kg);
}

export type ShippingQuote = {
  code: CourierCode;
  name: string;
  service: string;
  cost: number;
  etaMin: number;
  etaMax: number;
  etaLabel: string;
};

export function etaLabel(min: number, max: number) {
  if (min === 0 && max === 0) return "Hari ini";
  if (min === max) return `${min} hari`;
  return `${min} sampai ${max} hari`;
}

export function findCity(slug: string | null | undefined) {
  return quickCities.find((c) => c.slug === slug) ?? null;
}

// Semua opsi kurir yang melayani kota tujuan, diurutkan dari termurah. Ambil di toko tidak ikut.
export function quoteShipping(input: { totalGram: number; citySlug: string; includePickup?: boolean }): ShippingQuote[] {
  const city = findCity(input.citySlug);
  if (!city) return [];
  const kg = billableKg(input.totalGram);
  const quotes: ShippingQuote[] = [];
  for (const c of couriers) {
    if (c.code === "ambil_di_toko" && !input.includePickup) continue;
    const rate = c.ratePerKg[city.zone];
    const eta = c.eta[city.zone];
    if (rate == null || eta == null) continue;
    quotes.push({ code: c.code, name: c.name, service: c.service, cost: rate * kg, etaMin: eta[0], etaMax: eta[1], etaLabel: etaLabel(eta[0], eta[1]) });
  }
  return quotes.sort((a, b) => a.cost - b.cost || a.etaMax - b.etaMax);
}

export function cheapestAndFastest(quotes: ShippingQuote[]) {
  if (quotes.length === 0) return { cheapest: null, fastest: null };
  const cheapest = quotes[0];
  const fastest = [...quotes].sort((a, b) => a.etaMax - b.etaMax || a.etaMin - b.etaMin || a.cost - b.cost)[0];
  return { cheapest, fastest };
}

// Antarmuka adapter supaya nanti tinggal disambung ke API ongkir sungguhan tanpa mengubah checkout.
export interface ShippingAdapter {
  quote(input: { totalGram: number; citySlug: string }): Promise<ShippingQuote[]>;
}

export const demoShippingAdapter: ShippingAdapter = {
  async quote(input) {
    return quoteShipping(input);
  },
};

// Kurir instan hanya beroperasi Senin sampai Sabtu pukul 08.00 sampai 17.00 WIB.
export const INSTANT_OPEN_HOUR = 8;
export const INSTANT_CLOSE_HOUR = 17;

export type InstantAvailability = { available: boolean; note: string | null };

export function instantAvailability(now: Date): InstantAvailability {
  // Waktu WIB tanpa bergantung zona waktu mesin (UTC+7, tanpa DST).
  const w = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = w.getUTCDay(); // 0 Minggu sampai 6 Sabtu
  const minutes = w.getUTCHours() * 60 + w.getUTCMinutes();
  const open = INSTANT_OPEN_HOUR * 60;
  const close = INSTANT_CLOSE_HOUR * 60;
  const workday = day >= 1 && day <= 6;
  if (workday && minutes >= open && minutes < close) return { available: true, note: null };
  const at = `pukul ${String(INSTANT_OPEN_HOUR).padStart(2, "0")}.00`;
  if (workday && minutes < open) return { available: false, note: `Tersedia lagi hari ini ${at}` };
  // Setelah tutup: hari kerja berikutnya. Sabtu malam dan Minggu lompat ke Senin.
  if (day === 6) return { available: false, note: `Tersedia lagi Senin ${at}` };
  return { available: false, note: `Tersedia lagi besok ${at}` };
}
