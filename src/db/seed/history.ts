// Riwayat penjualan 90 hari yang realistis dan deterministik untuk demo. Fungsi murni: menerima katalog yang sudah
// disisipkan seed (id nyata), waktu reset, dan RNG, lalu mengembalikan baris siap disisipkan massal.
// Harga dihitung dengan mesin harga yang sama (priceCart); stok, poin, kuota flash, dan voucher dicatat konsisten.
import type { OpeningHours, OrderAddressSnapshot, OrderPricingSnapshot, ShipmentEvent, SkinProfile } from "../schema";
import { toWibParts, wibDate } from "../../lib/format";
import { formatOrderNumber, orderPeriod, paymentDeadline } from "../../lib/orders/rules";
import { courierLabel, expiryReason, qrPayload, vaNumber, type PaymentMethod } from "../../lib/orders/service";
import { earnedPoints, pointKeys } from "../../lib/points";
import { priceCart, type FlashInput, type PricingLineInput, type VoucherInput } from "../../lib/pricing/cart";
import { roundToPromo } from "../../lib/pricing";
import { DEFAULT_SETTINGS, pricingRules } from "../../lib/settings";
import { instantAvailability, type CourierCode, type Zone } from "../../lib/shipping";
import type { Rng } from "./random";

export const HISTORY_DAYS = 90;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

export type HistoryVariant = {
  id: number;
  productId: number;
  brandId: number;
  categoryId: number;
  parentCategoryId: number | null;
  productName: string;
  shadeName: string;
  brandName: string;
  weightGram: number;
  normalPrice: number;
  salePrice: number;
  promoPrice: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  popularity: number;
};
export type HistoryLocation = { id: number; slug: string; type: "gudang" | "toko"; name: string; openingHours: OpeningHours | null };
export type HistoryVoucher = Omit<VoucherInput, "used" | "usedByBuyer"> & { id: number };
export type HistoryInput = {
  now: Date;
  variants: HistoryVariant[];
  locations: HistoryLocation[];
  vouchers: HistoryVoucher[];
  flashPool: number[]; // variant id kandidat flash sale (produk terlaris)
  finalStock: Map<string, number>; // "variantId:locationId" -> stok fisik akhir
  flashSlotsToday: number; // hari terakhir sampai hari ini; slot hari ini ikut riwayat
};

export type GenCustomer = { name: string; phone: string; email: string | null; registeredAt: Date; lastLoginAt: Date | null; points: number; address: OrderAddressSnapshot | null; skinProfile: SkinProfile | null };
export type GenFlashSale = { name: string; startsAt: Date; endsAt: Date };
export type GenFlashItem = { sale: number; variantId: number; flashPrice: number; quota: number; sold: number; maxPerCustomer: number };
export type GenOrder = {
  number: string;
  customer: number | null; // indeks GenCustomer
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  method: "kirim" | "ambil";
  locationId: number;
  shippingAddress: OrderAddressSnapshot | null;
  courier: string;
  service: string;
  shippingCost: number;
  shippingDiscount: number;
  subtotal: number;
  productDiscount: number;
  voucherDiscount: number;
  discount: number;
  pricing: OrderPricingSnapshot;
  voucherCode: string | null;
  pointsUsed: number;
  total: number;
  status: "menunggu_pembayaran" | "dibayar" | "diproses" | "dikirim" | "siap_diambil" | "selesai" | "dibatalkan" | "diretur";
  expiresAt: Date;
  note: string;
  cancelReason: string | null;
  accessToken: string;
  paidAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type GenItem = { order: number; variantId: number; productName: string; shadeName: string; brandName: string; unitPrice: number; normalPrice: number; quantity: number; priceSource: "flash" | "promo" | "normal"; flashItem: number | null; weightGram: number };
export type GenPayment = { order: number; method: PaymentMethod; vaNumber: string | null; qrPayload: string | null; amount: number; status: "menunggu" | "lunas" | "kedaluwarsa" | "batal"; idempotencyKey: string; expiresAt: Date; paidAt: Date | null; createdAt: Date };
export type GenHistory = { order: number; fromStatus: GenOrder["status"] | null; toStatus: GenOrder["status"]; actor: string; reason: string | null; createdAt: Date };
export type GenShipment = { order: number; courier: string; service: string; trackingNumber: string; status: string; history: ShipmentEvent[]; createdAt: Date; updatedAt: Date };
export type GenMovement = { variantId: number; locationId: number; type: "masuk" | "keluar" | "pesan" | "lepas"; quantity: number; reference: string; note: string; actor: string; createdAt: Date };
export type GenLedger = { customer: number; amount: number; reason: string; reference: string; key: string; createdAt: Date };
export type GenRedemption = { voucherId: number; customer: number | null; guestPhone: string; order: number; discount: number; redeemedAt: Date };

export type HistoryOutput = {
  customers: GenCustomer[];
  flashSales: GenFlashSale[];
  flashItems: GenFlashItem[];
  orders: GenOrder[];
  items: GenItem[];
  payments: GenPayment[];
  history: GenHistory[];
  shipments: GenShipment[];
  movements: GenMovement[]; // termasuk stok awal (masuk) di hari pertama
  ledger: GenLedger[];
  redemptions: GenRedemption[];
  voucherUsed: Map<number, number>;
  soldByProduct: Map<number, number>;
  reserved: Map<string, number>; // "variantId:locationId" -> dipesan (pesanan menunggu pembayaran)
  counters: Map<string, number>; // periode YYMM -> urutan terakhir
};

const FIRST = ["Ayu", "Bunga", "Citra", "Dewi", "Eka", "Fitri", "Gita", "Hana", "Indah", "Jihan", "Kirana", "Laras", "Maya", "Nadia", "Oktavia", "Putri", "Rara", "Salsa", "Tiara", "Utami", "Vina", "Wulan", "Yuni", "Zahra", "Anisa", "Bella", "Dinda", "Farah", "Intan", "Mega", "Nabila", "Rina", "Sekar", "Tasya", "Dimas", "Raka", "Bayu", "Fajar", "Galih", "Rizky"];
const LAST = ["Lestari", "Pratiwi", "Wulandari", "Saputri", "Anggraini", "Rahmawati", "Permatasari", "Kusuma", "Maharani", "Puspita", "Handayani", "Safitri", "Novitasari", "Ramadhani", "Fitriani", "Hapsari", "Kartika", "Purnama", "Setiawan", "Nugroho", "Santoso", "Wijaya", "Hidayat", "Siregar", "Nasution", "Simanjuntak", "Utomo", "Prasetyo", "Halim", "Gunawan"];

const ZONE_PLACES: Record<Zone, { province: string; city: string; districts: string[]; postal: string }[]> = {
  dalam_kota: [{ province: "Jawa Timur", city: "Kota Malang", districts: ["Lowokwaru", "Klojen", "Blimbing", "Sukun", "Kedungkandang"], postal: "651" }],
  jatim: [
    { province: "Jawa Timur", city: "Kota Surabaya", districts: ["Gubeng", "Tegalsari", "Wonokromo", "Rungkut"], postal: "602" },
    { province: "Jawa Timur", city: "Kabupaten Sidoarjo", districts: ["Sidoarjo", "Waru", "Taman"], postal: "612" },
    { province: "Jawa Timur", city: "Kota Batu", districts: ["Batu", "Junrejo"], postal: "653" },
    { province: "Jawa Timur", city: "Kabupaten Malang", districts: ["Singosari", "Lawang", "Kepanjen"], postal: "651" },
  ],
  jawa: [
    { province: "DKI Jakarta", city: "Kota Jakarta Selatan", districts: ["Tebet", "Kebayoran Baru", "Pancoran"], postal: "121" },
    { province: "Jawa Barat", city: "Kota Bandung", districts: ["Coblong", "Sukajadi"], postal: "401" },
    { province: "DI Yogyakarta", city: "Kota Yogyakarta", districts: ["Gondokusuman", "Umbulharjo"], postal: "552" },
    { province: "Jawa Tengah", city: "Kota Semarang", districts: ["Tembalang", "Banyumanik"], postal: "502" },
  ],
  luar_jawa: [
    { province: "Bali", city: "Kota Denpasar", districts: ["Denpasar Barat", "Denpasar Selatan"], postal: "801" },
    { province: "Sulawesi Selatan", city: "Kota Makassar", districts: ["Panakkukang", "Tamalate"], postal: "902" },
    { province: "Kalimantan Timur", city: "Kota Balikpapan", districts: ["Balikpapan Kota", "Balikpapan Selatan"], postal: "761" },
  ],
};
const STREETS = ["Jl. Melati", "Jl. Kenanga", "Jl. Cempaka", "Jl. Flamboyan", "Jl. Anggrek", "Jl. Mawar", "Jl. Dahlia", "Jl. Teratai", "Jl. Bougenville", "Jl. Seruni"];
const NOTES = ["", "", "", "", "", "Tolong dibungkus rapi ya, untuk kado.", "Titip di pos satpam bila tidak ada orang.", "Mohon cek shade sebelum dikirim, terima kasih."];
const HOUR_WEIGHTS = [0.2, 0.1, 0.05, 0.05, 0.05, 0.2, 0.5, 1, 1.4, 1.6, 1.7, 1.8, 3.2, 3.2, 1.9, 1.7, 1.6, 1.8, 2, 2.2, 3.4, 3.4, 1.6, 0.6];
const SLOTS = [
  { name: "Flash Sale Siang", start: 12, end: 14 },
  { name: "Flash Sale Malam", start: 20, end: 22 },
] as const;

function weighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = rng.next() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

const hex = (rng: Rng, n: number) => Array.from({ length: n }, () => Math.floor(rng.next() * 16).toString(16)).join("");
const key = (v: number, l: number) => `${v}:${l}`;

export function generateHistory(input: HistoryInput, rng: Rng): HistoryOutput {
  const { now } = input;
  const rules = pricingRules(DEFAULT_SETTINGS);
  const gudang = input.locations.find((l) => l.type === "gudang")!;
  const stores = input.locations.filter((l) => l.type === "toko");
  const today = toWibParts(now);
  const dayStart = (d: number) => {
    const p = toWibParts(new Date(wibDate(today.year, today.month, today.day, 12).getTime() - d * DAY));
    return wibDate(p.year, p.month, p.day);
  };
  const historyStart = dayStart(HISTORY_DAYS - 1);

  // Pelanggan fiktif (nomor 0800, bukan awalan seluler sungguhan), masing-masing dengan alamat rumah tetap dan
  // sebagian dengan profil kulit. Kuota pesanan 90 hari: 10 tanpa pesanan, sebagian besar 1 sampai 3, pelanggan setia
  // 3 sampai 8, dan sedikit yang 9 sampai 15.
  const homes: { zone: Zone; place: (typeof ZONE_PLACES)[Zone][number]; district: string; postal: string; street: string }[] = [];
  const customers: GenCustomer[] = Array.from({ length: 150 }, (_, i) => {
    const first = rng.pick(FIRST);
    const last = rng.pick(LAST);
    const zone = weighted(rng, ["dalam_kota", "jatim", "jawa", "luar_jawa"] as Zone[], (z) => ({ dalam_kota: 4, jatim: 3, jawa: 2, luar_jawa: 1 })[z]);
    const place = rng.pick(ZONE_PLACES[zone]);
    homes.push({ zone, place, district: rng.pick(place.districts), postal: `${place.postal}${rng.int(10, 99)}`, street: `${rng.pick(STREETS)} No. ${rng.int(1, 120)}, RT ${rng.int(1, 9)} RW ${rng.int(1, 9)} (fiktif)` });
    return {
      name: `${first} ${last}`,
      phone: `08001${String(1_000_000 + i).slice(-7)}`,
      email: rng.chance(0.45) ? `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@contoh.demo" : null,
      registeredAt: new Date(historyStart.getTime() - rng.int(5, 300) * DAY),
      lastLoginAt: null,
      points: 0,
      address: null,
      skinProfile: rng.chance(0.45) ? randomSkinProfile(rng, historyStart) : null,
    };
  });
  const quota = customers.map((_, i) => (i < 10 ? 0 : i < 95 ? rng.int(1, 3) : i < 137 ? rng.int(3, 8) : rng.int(9, 15)));

  // Slot flash sale riwayat sampai hari ini (pola sama dengan slot otomatis: produk terlaris bergiliran).
  const flashSales: GenFlashSale[] = [];
  const flashItems: GenFlashItem[] = [];
  const slotIndex: { sale: number; startsAt: Date; endsAt: Date; items: number[] }[] = [];
  const pool = input.flashPool;
  const variantById = new Map(input.variants.map((v) => [v.id, v]));
  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const start = dayStart(d);
    const p = toWibParts(start);
    for (const [si, slot] of SLOTS.entries()) {
      const sale = flashSales.length;
      const s = { name: slot.name, startsAt: wibDate(p.year, p.month, p.day, slot.start), endsAt: wibDate(p.year, p.month, p.day, slot.end) };
      flashSales.push(s);
      const offset = (((HISTORY_DAYS - d) * 2 + si) * 6) % Math.max(1, pool.length - 6);
      const picks = pool.slice(offset, offset + 6);
      const ids: number[] = [];
      for (const variantId of picks) {
        const v = variantById.get(variantId)!;
        ids.push(flashItems.length);
        flashItems.push({ sale, variantId, flashPrice: roundToPromo(v.salePrice * 0.78), quota: rng.int(20, 40), sold: 0, maxPerCustomer: 2 });
      }
      slotIndex.push({ sale, startsAt: s.startsAt, endsAt: s.endsAt, items: ids });
    }
  }

  // Pilih varian: bobot popularitas produk, shade seragam di dalam produk.
  const byProduct = new Map<number, HistoryVariant[]>();
  for (const v of input.variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  const productList = [...byProduct.keys()];
  const popularity = new Map(input.variants.map((v) => [v.productId, v.popularity]));

  const orders: GenOrder[] = [];
  const items: GenItem[] = [];
  const payments: GenPayment[] = [];
  const history: GenHistory[] = [];
  const shipments: GenShipment[] = [];
  const movements: GenMovement[] = [];
  const ledger: GenLedger[] = [];
  const redemptions: GenRedemption[] = [];
  const voucherUsed = new Map<number, number>();
  const voucherByBuyer = new Map<string, number>();
  const soldByProduct = new Map<number, number>();
  const reserved = new Map<string, number>();
  const counters = new Map<string, number>();
  const flashBought = new Map<string, number>(); // "item|telepon" -> unit
  const balances = customers.map(() => 0);
  const pointEvents: { at: Date; apply: () => void }[] = [];
  const flushPoints = (until: Date) => {
    pointEvents.sort((a, b) => a.at.getTime() - b.at.getTime());
    while (pointEvents.length && pointEvents[0].at.getTime() <= until.getTime()) pointEvents.shift()!.apply();
  };

  // Waktu pesanan per hari: 8 sampai 25, lebih ramai akhir pekan dan sekitar gajian, sepi malam hari.
  const times: Date[] = [];
  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const start = dayStart(d);
    const p = toWibParts(start);
    const weekend = p.weekday === 0 || p.weekday === 6;
    const payday = p.day >= 25 || p.day <= 5;
    let n = rng.int(8, 17) + (weekend ? rng.int(3, 6) : 0);
    if (payday) n = Math.round(n * 1.25);
    n = Math.min(25, Math.max(8, n));
    for (let i = 0; i < n; i++) {
      const hour = weighted(rng, HOUR_WEIGHTS.map((_, h) => h), (h) => HOUR_WEIGHTS[h]);
      const t = new Date(start.getTime() + hour * HOUR + rng.int(0, 59) * MIN + rng.int(0, 59) * 1000);
      if (t.getTime() < now.getTime() - 2 * MIN) times.push(t);
    }
  }
  times.sort((a, b) => a.getTime() - b.getTime());

  const staffFor = (loc: HistoryLocation) => (loc.type === "gudang" ? "Admin Online Demo" : loc.slug === "dinoyo" ? "Staf Dinoyo Demo" : `Staf ${loc.name.replace("Rona ", "")}`);

  for (const [ti, t] of times.entries()) {
    flushPoints(t);
    // Pesanan pelanggan terdaftar tersebar merata sampai kuota habis; sisanya tamu (sekitar 55 persen).
    const remainingQuota = quota.reduce((a, b) => a + b, 0);
    const registered = remainingQuota > 0 && rng.next() < remainingQuota / (times.length - ti);
    const cIdx = registered ? weighted(rng, customers.map((_, i) => i).filter((i) => quota[i] > 0), (i) => quota[i]) : null;
    const c = cIdx != null ? customers[cIdx] : null;
    const guestFirst = rng.pick(FIRST);
    const name = c ? c.name : `${guestFirst} ${rng.pick(LAST)}`;
    const phone = c ? c.phone : `08002${String(rng.int(0, 9_999_999)).padStart(7, "0")}`;
    const email = c ? c.email : rng.chance(0.2) ? `${guestFirst.toLowerCase()}${rng.int(10, 99)}@contoh.demo` : null;
    const method: "kirim" | "ambil" = rng.chance(0.7) ? "kirim" : "ambil";
    const location = method === "kirim" ? gudang : weighted(rng, stores, (s) => (s.slug === "dinoyo" ? 4 : s.slug === "soekarno-hatta" ? 3.5 : 2.5));

    // Saat slot flash berjalan, pesanan lebih sering berisi produk flash (lonjakan).
    const slot = slotIndex.find((s) => s.startsAt.getTime() <= t.getTime() && s.endsAt.getTime() > t.getTime());
    const lineCount = weighted(rng, [1, 2, 3], (n) => (n === 1 ? 5 : n === 2 ? 3.5 : 1.5));
    const picked = new Map<number, number>();
    for (let li = 0; li < lineCount; li++) {
      let variantId: number;
      if (slot && li === 0 && rng.chance(0.7)) variantId = flashItems[rng.pick(slot.items)].variantId;
      else {
        const productId = weighted(rng, productList, (pid) => Math.pow(popularity.get(pid) ?? 1, 1.6));
        variantId = rng.pick(byProduct.get(productId)!).id;
      }
      picked.set(variantId, (picked.get(variantId) ?? 0) + (rng.chance(0.25) ? 2 : 1));
    }

    const lines: PricingLineInput[] = [...picked.entries()].map(([variantId, quantity]) => {
      const v = variantById.get(variantId)!;
      let flash: FlashInput | null = null;
      if (slot) {
        const itemIdx = slot.items.find((i) => flashItems[i].variantId === variantId);
        if (itemIdx != null) {
          const f = flashItems[itemIdx];
          flash = { flashSaleItemId: itemIdx, flashPrice: f.flashPrice, quota: f.quota, sold: f.sold, maxPerCustomer: f.maxPerCustomer, boughtByBuyer: flashBought.get(`${itemIdx}|${phone}`) ?? 0, startsAt: slot.startsAt, endsAt: slot.endsAt };
        }
      }
      return { variantId, productId: v.productId, brandId: v.brandId, categoryId: v.categoryId, parentCategoryId: v.parentCategoryId, quantity, weightGram: v.weightGram, normalPrice: v.normalPrice, salePrice: v.salePrice, promoPrice: v.promoPrice, promoStartsAt: v.promoStartsAt, promoEndsAt: v.promoEndsAt, flash };
    });

    // Pengiriman.
    let zone: Zone | null = null;
    let courierCode: CourierCode = "ambil_di_toko";
    let address: OrderAddressSnapshot | null = null;
    if (method === "kirim") {
      zone = cIdx != null ? homes[cIdx].zone : weighted(rng, ["dalam_kota", "jatim", "jawa", "luar_jawa"] as Zone[], (z) => ({ dalam_kota: 4, jatim: 3, jawa: 2, luar_jawa: 1 })[z]);
      const options: CourierCode[] = ["jne_reg", "jnt_ez", "sicepat_reg", "jne_yes"];
      if (zone === "dalam_kota" && instantAvailability(t).available) options.push("instan");
      courierCode = weighted(rng, options, (o) => (o === "jne_reg" ? 4 : o === "jnt_ez" ? 3 : o === "sicepat_reg" ? 3 : o === "instan" ? 1.5 : 1));
      if (cIdx != null) {
        // Pelanggan terdaftar selalu mengirim ke alamat rumahnya, yang juga tersimpan di akunnya.
        const h = homes[cIdx];
        address = { recipient: name, phone, province: h.place.province, city: h.place.city, district: h.district, postalCode: h.postal, street: h.street };
      } else {
        const place = rng.pick(ZONE_PLACES[zone]);
        address = { recipient: name, phone, province: place.province, city: place.city, district: rng.pick(place.districts), postalCode: `${place.postal}${rng.int(10, 99)}`, street: `${rng.pick(STREETS)} No. ${rng.int(1, 120)}, RT ${rng.int(1, 9)} RW ${rng.int(1, 9)} (fiktif)` };
      }
    }
    const shipping = method === "kirim" ? { method: "kirim" as const, courierCode, zone: zone! } : { method: "ambil" as const };

    // Pembayaran.
    const paymentMethod: PaymentMethod = method === "ambil" && rng.chance(0.35) ? "bayar_di_toko" : weighted(rng, ["qris", "va_bca", "va_bri", "va_bni", "va_mandiri"] as PaymentMethod[], (m) => (m === "qris" ? 4.5 : m === "va_bca" ? 2 : m === "va_mandiri" ? 1.3 : m === "va_bri" ? 1.2 : 1));

    // Voucher (sebagian kecil) dan poin (pelanggan dengan saldo).
    let voucher: HistoryVoucher | null = null;
    if (input.vouchers.length && rng.chance(0.14)) voucher = rng.pick(input.vouchers);
    const buyerKey = c ? `c${cIdx}` : `g${phone}`;
    const voucherInput = voucher ? { ...voucher, used: voucherUsed.get(voucher.id) ?? 0, usedByBuyer: voucherByBuyer.get(`${voucher.id}|${buyerKey}`) ?? 0 } : null;
    const requestPoints = cIdx != null && balances[cIdx] >= 1000 && rng.chance(0.35) ? balances[cIdx] : 0;
    const price = (withVoucher: boolean) =>
      priceCart({ lines, now: t, voucherCode: withVoucher ? voucher!.code : null, voucher: withVoucher ? voucherInput : null, shipping, points: cIdx != null ? { requested: requestPoints, balance: balances[cIdx] } : null, rules });
    let pricing = price(Boolean(voucher));
    if (voucher && !pricing.voucher?.applied) {
      voucher = null;
      pricing = price(false);
    }
    if (method === "kirim" && (pricing.shipping?.cost ?? 0) === 0) continue;

    // Status dan waktu kejadian. Kejadian setelah waktu reset tidak terjadi (pesanan masih aktif).
    const expiresAt = paymentDeadline({ paymentMethod, now: t, openingHours: location.openingHours });
    const payAtStore = paymentMethod === "bayar_di_toko";
    const r = rng.next();
    const expire = r < 0.05;
    const cancelAfterPaid = !expire && r < 0.07;
    const events: { to: GenOrder["status"]; at: Date; actor: string; reason: string | null }[] = [];
    let paidAt: Date | null = null;
    if (expire) {
      events.push({ to: "dibatalkan", at: payAtStore ? expiresAt : new Date(t.getTime() + 15 * MIN), actor: "sistem", reason: expiryReason(paymentMethod) });
    } else if (payAtStore) {
      paidAt = new Date(t.getTime() + rng.int(60, 20 * 60) * MIN);
      if (paidAt.getTime() >= expiresAt.getTime()) paidAt = new Date(expiresAt.getTime() - rng.int(30, 120) * MIN);
      events.push({ to: "dibayar", at: paidAt, actor: staffFor(location), reason: "Dibayar di kasir" });
      events.push({ to: "selesai", at: new Date(paidAt.getTime() + 1000), actor: staffFor(location), reason: "Sudah diambil pembeli" });
    } else {
      paidAt = new Date(t.getTime() + rng.int(1, 12) * MIN);
      events.push({ to: "dibayar", at: paidAt, actor: "sistem pembayaran", reason: null });
      if (cancelAfterPaid) events.push({ to: "dibatalkan", at: new Date(paidAt.getTime() + rng.int(30, 300) * MIN), actor: "Admin Online Demo", reason: "Pembeli minta batal lewat WhatsApp" });
      else if (method === "kirim") {
        // Dua hari terakhir: sebagian pesanan belum sempat diproses, supaya papan pesanan dan "Perlu tindakan" hidup.
        const recent = t.getTime() > now.getTime() - 2 * DAY && rng.chance(0.6);
        const proc = new Date(paidAt.getTime() + (recent ? rng.int(6, 30) * HOUR : rng.int(30, 180) * MIN));
        const sent = new Date(proc.getTime() + (recent ? rng.int(3, 12) * HOUR : rng.int(60, 360) * MIN));
        const auto = rng.chance(0.35);
        const done = auto ? new Date(sent.getTime() + 3 * DAY + rng.int(0, 600) * MIN) : new Date(sent.getTime() + rng.int(18, 60) * HOUR);
        events.push({ to: "diproses", at: proc, actor: "Admin Online Demo", reason: null }, { to: "dikirim", at: sent, actor: "Admin Online Demo", reason: null }, { to: "selesai", at: done, actor: auto ? "sistem" : "pembeli", reason: auto ? "Otomatis selesai 3 hari setelah dikirim" : "Pembeli mengonfirmasi pesanan diterima" });
      } else {
        const slowStore = t.getTime() > now.getTime() - DAY && rng.chance(0.5);
        const proc = new Date(paidAt.getTime() + (slowStore ? rng.int(3, 20) * HOUR : rng.int(15, 60) * MIN));
        const ready = new Date(proc.getTime() + rng.int(30, 120) * MIN);
        // Sebagian kecil pesanan siap diambil belum juga diambil lebih dari 3 hari.
        const late = t.getTime() > now.getTime() - 6 * DAY && rng.chance(0.15);
        const taken = new Date(ready.getTime() + (late ? rng.int(4, 6) * DAY : rng.int(2, 40) * HOUR));
        events.push({ to: "diproses", at: proc, actor: staffFor(location), reason: null }, { to: "siap_diambil", at: ready, actor: staffFor(location), reason: null }, { to: "selesai", at: taken, actor: staffFor(location), reason: "Sudah diambil pembeli" });
      }
      const last = events[events.length - 1];
      if (last.to === "selesai" && rng.chance(0.025)) events.push({ to: "diretur", at: new Date(last.at.getTime() + rng.int(1, 4) * DAY), actor: "Admin Online Demo", reason: "Retur disetujui: produk rusak saat diterima" });
    }
    const happened = events.filter((e) => e.at.getTime() <= now.getTime());
    const status: GenOrder["status"] = happened.length ? happened[happened.length - 1].to : "menunggu_pembayaran";
    const cancelled = status === "dibatalkan";
    const wasPaid = happened.some((e) => e.to === "dibayar");

    // Pesanan yang masih menunggu pembayaran memesan stok: hanya bila stok akhir cukup.
    if (status === "menunggu_pembayaran") {
      const enough = pricing.lines.every((pl) => (reserved.get(key(pl.variantId, location.id)) ?? 0) + pl.quantity <= (input.finalStock.get(key(pl.variantId, location.id)) ?? 0));
      if (!enough) continue;
    }

    // Nomor pesanan berurutan per bulan WIB.
    const period = orderPeriod(t);
    const seq = (counters.get(period) ?? 0) + 1;
    counters.set(period, seq);
    const number = formatOrderNumber(period, seq);
    const oi = orders.length;
    const snapshot: OrderPricingSnapshot = {
      normalSubtotal: pricing.normalSubtotal,
      subtotal: pricing.subtotal,
      productDiscount: pricing.productDiscount,
      voucherCode: pricing.voucher?.applied ? pricing.voucher.code : null,
      voucherDiscount: pricing.voucherDiscount,
      shippingCost: pricing.shipping?.cost ?? 0,
      shippingDiscount: pricing.shipping?.discount ?? 0,
      pointsUsed: pricing.points.used,
      total: pricing.total,
      weightGram: pricing.weightGram,
      billableKg: pricing.shipping?.billableKg ?? 0,
    };
    const completedAt = happened.find((e) => e.to === "selesai")?.at ?? null;
    const updatedAt = happened.length ? happened[happened.length - 1].at : t;
    if (cIdx != null) {
      quota[cIdx] -= 1;
      if (address && !customers[cIdx].address) customers[cIdx].address = address;
    }
    orders.push({
      number,
      customer: cIdx,
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      method,
      locationId: location.id,
      shippingAddress: address,
      courier: method === "kirim" ? courierCode : "ambil_di_toko",
      service: method === "kirim" ? courierLabel(courierCode) : location.name,
      shippingCost: snapshot.shippingCost,
      shippingDiscount: snapshot.shippingDiscount,
      subtotal: pricing.subtotal,
      productDiscount: pricing.productDiscount,
      voucherDiscount: pricing.voucherDiscount,
      discount: pricing.voucherDiscount + snapshot.shippingDiscount,
      pricing: snapshot,
      voucherCode: snapshot.voucherCode,
      pointsUsed: pricing.points.used,
      total: pricing.total,
      status,
      expiresAt,
      note: rng.pick(NOTES),
      cancelReason: cancelled ? (happened.find((e) => e.to === "dibatalkan")?.reason ?? "Dibatalkan") : null,
      accessToken: hex(rng, 32),
      paidAt: wasPaid ? paidAt : null,
      completedAt,
      createdAt: t,
      updatedAt,
    });

    // Item per segmen harga (flash dan biasa), sama dengan placeOrder.
    for (const [idx, pl] of pricing.lines.entries()) {
      const v = variantById.get(pl.variantId)!;
      for (const s of pl.segments) items.push({ order: oi, variantId: pl.variantId, productName: v.productName, shadeName: v.shadeName, brandName: v.brandName, unitPrice: s.unitPrice, normalPrice: lines[idx].normalPrice, quantity: s.quantity, priceSource: s.source, flashItem: s.flashSaleItemId, weightGram: v.weightGram });
    }

    payments.push({
      order: oi,
      method: paymentMethod,
      vaNumber: vaNumber(paymentMethod, seq, phone),
      qrPayload: paymentMethod === "qris" ? qrPayload(number, pricing.total) : null,
      amount: pricing.total,
      status: status === "menunggu_pembayaran" ? "menunggu" : !wasPaid ? "kedaluwarsa" : cancelled ? "batal" : "lunas",
      idempotencyKey: `pay_${number}_${hex(rng, 12)}`,
      expiresAt,
      paidAt: wasPaid ? paidAt : null,
      createdAt: t,
    });

    history.push({ order: oi, fromStatus: null, toStatus: "menunggu_pembayaran", actor: "pembeli", reason: null, createdAt: t });
    let prev: GenOrder["status"] = "menunggu_pembayaran";
    for (const e of happened) {
      history.push({ order: oi, fromStatus: prev, toStatus: e.to, actor: e.actor, reason: e.reason, createdAt: e.at });
      prev = e.to;
    }

    const sentEvent = happened.find((e) => e.to === "dikirim");
    if (sentEvent) {
      const resi = `${courierLabel(courierCode).slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}${number.replace(/\D/g, "").slice(-8)}${String(oi + 1).padStart(4, "0")}`;
      const doneAt = happened.find((e) => e.to === "selesai")?.at;
      shipments.push({
        order: oi,
        courier: courierLabel(courierCode),
        service: courierLabel(courierCode),
        trackingNumber: resi,
        status: doneAt ? "terkirim" : "dalam_perjalanan",
        history: [{ at: sentEvent.at.toISOString(), status: "Paket diserahkan ke kurir" }, ...(doneAt ? [{ at: doneAt.toISOString(), status: "Paket diterima" }] : [])],
        createdAt: sentEvent.at,
        updatedAt: doneAt ?? sentEvent.at,
      });
    }

    // Stok: dipesan saat dibuat; keluar saat dibayar; dilepas bila batal sebelum bayar; masuk lagi bila batal setelah bayar.
    const cancelEvent = happened.find((e) => e.to === "dibatalkan");
    for (const pl of pricing.lines) {
      const k = key(pl.variantId, location.id);
      const base = { variantId: pl.variantId, locationId: location.id, reference: number };
      movements.push({ ...base, type: "pesan", quantity: -pl.quantity, note: "Dipesan pembeli", actor: "sistem", createdAt: t });
      if (wasPaid) movements.push({ ...base, type: "keluar", quantity: -pl.quantity, note: "Pesanan dibayar", actor: payAtStore ? staffFor(location) : "sistem pembayaran", createdAt: paidAt! });
      if (cancelEvent && !wasPaid) movements.push({ ...base, type: "lepas", quantity: pl.quantity, note: cancelEvent.reason ?? "Pesanan dibatalkan", actor: "sistem", createdAt: cancelEvent.at });
      if (cancelEvent && wasPaid) movements.push({ ...base, type: "masuk", quantity: pl.quantity, note: "Dikembalikan karena pesanan dibatalkan", actor: cancelEvent.actor, createdAt: cancelEvent.at });
      if (status === "menunggu_pembayaran") reserved.set(k, (reserved.get(k) ?? 0) + pl.quantity);
      if (wasPaid) soldByProduct.set(variantById.get(pl.variantId)!.productId, (soldByProduct.get(variantById.get(pl.variantId)!.productId) ?? 0) + pl.quantity);
    }

    // Kuota flash dan voucher: terpakai kecuali pesanan batal.
    if (!cancelled) {
      for (const pl of pricing.lines)
        for (const s of pl.segments)
          if (s.flashSaleItemId != null) {
            flashItems[s.flashSaleItemId].sold += s.quantity;
            flashBought.set(`${s.flashSaleItemId}|${phone}`, (flashBought.get(`${s.flashSaleItemId}|${phone}`) ?? 0) + s.quantity);
          }
      if (voucher && pricing.voucher?.applied) {
        voucherUsed.set(voucher.id, (voucherUsed.get(voucher.id) ?? 0) + 1);
        voucherByBuyer.set(`${voucher.id}|${buyerKey}`, (voucherByBuyer.get(`${voucher.id}|${buyerKey}`) ?? 0) + 1);
        redemptions.push({ voucherId: voucher.id, customer: cIdx, guestPhone: phone, order: oi, discount: pricing.voucherDiscount + (pricing.voucher.shippingDiscount ?? 0), redeemedAt: t });
      }
    }

    // Poin: tukar saat dibuat, kembali bila batal, dapat saat Selesai, tarik saat Diretur (tanpa saldo negatif).
    if (cIdx != null) {
      const used = pricing.points.used;
      if (used > 0) {
        balances[cIdx] -= used;
        ledger.push({ customer: cIdx, amount: -used, reason: `Ditukar untuk pesanan ${number}`, reference: number, key: pointKeys.redeem(number), createdAt: t });
        if (cancelEvent) pointEvents.push({ at: cancelEvent.at, apply: () => { balances[cIdx] += used; ledger.push({ customer: cIdx, amount: used, reason: `Dikembalikan karena pesanan ${number} dibatalkan`, reference: number, key: pointKeys.refundRedeem(number), createdAt: cancelEvent.at }); } });
      }
      const done = happened.find((e) => e.to === "selesai");
      const earned = earnedPoints({ subtotal: pricing.subtotal, voucherDiscount: pricing.voucherDiscount, pointsUsed: used });
      if (done && earned > 0) {
        pointEvents.push({ at: done.at, apply: () => { balances[cIdx] += earned; ledger.push({ customer: cIdx, amount: earned, reason: `Poin dari pesanan ${number}`, reference: number, key: pointKeys.earn(number), createdAt: done.at }); } });
        const ret = happened.find((e) => e.to === "diretur");
        if (ret) {
          pointEvents.push({
            at: ret.at,
            apply: () => {
              const take = Math.min(earned, balances[cIdx]);
              balances[cIdx] -= take;
              ledger.push({ customer: cIdx, amount: -take, reason: take < earned ? `Ditarik karena pesanan ${number} diretur (saldo tidak cukup: ditarik ${take} dari ${earned} poin)` : `Ditarik karena pesanan ${number} diretur`, reference: number, key: pointKeys.clawback(number), createdAt: ret.at });
            },
          });
        }
      }
      if (!c!.lastLoginAt || c!.lastLoginAt.getTime() < t.getTime()) c!.lastLoginAt = t;
      if (c!.registeredAt.getTime() > t.getTime()) c!.registeredAt = new Date(t.getTime() - rng.int(1, 30) * DAY);
    }
  }
  flushPoints(now);
  customers.forEach((c, i) => (c.points = balances[i]));

  // Stok awal sebagai gerakan masuk di hari pertama: stok akhir dikurangi seluruh perubahan fisik dari pesanan.
  const physical = new Map<string, number>();
  for (const m of movements) if (m.type === "keluar" || m.type === "masuk") physical.set(key(m.variantId, m.locationId), (physical.get(key(m.variantId, m.locationId)) ?? 0) + m.quantity);
  const initialAt = new Date(historyStart.getTime() + 7 * HOUR);
  const initial: GenMovement[] = [];
  for (const [k, final] of input.finalStock) {
    const qty = final - (physical.get(k) ?? 0);
    if (qty <= 0) continue;
    const [variantId, locationId] = k.split(":").map(Number);
    initial.push({ variantId, locationId, type: "masuk", quantity: qty, reference: "STOK-AWAL", note: "Stok awal demo", actor: "Gudang Demo", createdAt: initialAt });
  }

  return { customers, flashSales, flashItems, orders, items, payments, history, shipments, movements: [...initial, ...movements], ledger, redemptions, voucherUsed, soldByProduct, reserved, counters };
}

const SKIN_TYPES = ["normal", "kering", "berminyak", "kombinasi", "sensitif"] as const;
const SKIN_CONCERNS = ["jerawat", "kusam", "pori", "penuaan", "dehidrasi"] as const;

// Profil kulit acak untuk sebagian pelanggan riwayat (bentuk sama dengan formulir akun dan kuis).
function randomSkinProfile(rng: Rng, at: Date): SkinProfile {
  const concerns = SKIN_CONCERNS.filter(() => rng.chance(0.3)).slice(0, 2);
  return {
    skinType: rng.pick([...SKIN_TYPES]),
    concerns: [...concerns],
    sensitivity: rng.pick(["rendah", "sedang", "tinggi"] as const),
    undertone: rng.pick(["warm", "neutral", "cool"] as const),
    depth: rng.int(2, 5),
    budget: rng.pick([75_000, 150_000, 250_000]),
    source: rng.chance(0.5) ? "kuis" : "formulir",
    updatedAt: at.toISOString(),
  };
}
