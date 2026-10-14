// Mesin harga keranjang: fungsi murni. Server memanggilnya di keranjang, checkout, dan saat membuat pesanan.
// Semua angka bilangan bulat rupiah; persen dibulatkan ke bawah.
import { formatDateWib, formatRupiah } from "@/lib/format";
import type { PricingRules } from "@/lib/settings";
import { billableKg, couriers, type CourierCode, type Zone } from "@/lib/shipping";
import { effectivePrice, type PriceSource } from "./index";

// Nilai bawaan; nilai sebenarnya dibaca dari pengaturan toko (rules) bila diberikan.
export const FREE_SHIPPING_THRESHOLD = 150_000;
export const FREE_SHIPPING_CAP = 20_000;
export const POINTS_MAX_RATIO = 0.5;

export type FlashInput = {
  flashSaleItemId: number;
  flashPrice: number;
  quota: number;
  sold: number;
  maxPerCustomer: number;
  boughtByBuyer: number; // unit yang sudah dibeli pembeli ini di slot yang sama (pesanan belum batal)
  startsAt: Date;
  endsAt: Date;
};

export type PricingLineInput = {
  variantId: number;
  productId: number;
  brandId: number;
  categoryId: number; // sub kategori
  parentCategoryId: number | null;
  quantity: number;
  weightGram: number;
  normalPrice: number;
  salePrice: number;
  promoPrice?: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
  flash?: FlashInput | null;
};

export type VoucherType = "nominal" | "persen" | "ongkir";

export type VoucherInput = {
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  startsAt: Date;
  endsAt: Date;
  quota: number | null;
  used: number;
  quotaPerCustomer: number;
  usedByBuyer: number;
  scope: { brandIds?: number[]; categoryIds?: number[] };
  stackWithFlash: boolean;
  isActive: boolean;
};

export type ShippingInput = { method: "ambil" } | { method: "kirim"; courierCode: CourierCode; zone: Zone };

export type PriceCartInput = {
  lines: PricingLineInput[];
  now: Date;
  voucherCode?: string | null; // kode yang diketik pembeli
  voucher?: VoucherInput | null; // data voucher dari database bila kodenya ditemukan
  points?: { requested: number; balance: number } | null;
  shipping?: ShippingInput | null;
  rules?: Partial<PricingRules> | null; // dari pengaturan toko; kosong = aturan bawaan
};

export type PriceSegment = { quantity: number; unitPrice: number; source: PriceSource; flashSaleItemId: number | null };

export type PricedLine = {
  variantId: number;
  quantity: number;
  segments: PriceSegment[];
  normalPrice: number;
  lineTotal: number;
  lineNormalTotal: number;
  lineDiscount: number;
  weightGram: number;
  hasFlash: boolean;
  flashLimited: boolean; // sebagian unit tidak mendapat harga flash karena batas per pembeli atau kuota
};

export type VoucherReason =
  | "tidak_ditemukan"
  | "nonaktif"
  | "belum_mulai"
  | "kedaluwarsa"
  | "kuota_habis"
  | "kuota_pembeli_habis"
  | "tidak_berlaku_produk"
  | "tidak_bisa_flash"
  | "minimal_belanja"
  | "hanya_kirim";

export type VoucherResult = {
  code: string;
  applied: boolean;
  reason: VoucherReason | null;
  message: string;
  type: VoucherType | null;
  discount: number; // potongan subtotal
  shippingDiscount: number; // potongan ongkir dari voucher
  eligibleSubtotal: number;
};

export type ShippingResult = {
  method: "kirim" | "ambil";
  courierCode: CourierCode | null;
  zone: Zone | null;
  billableKg: number;
  cost: number;
  autoFreeDiscount: number;
  voucherDiscount: number;
  discount: number;
  payable: number;
};

export type PricedCart = {
  lines: PricedLine[];
  itemCount: number;
  weightGram: number;
  normalSubtotal: number;
  subtotal: number;
  productDiscount: number;
  voucher: VoucherResult | null;
  voucherDiscount: number;
  afterVoucher: number;
  freeShipping: { threshold: number; cap: number; qualifies: boolean; remaining: number };
  shipping: ShippingResult | null;
  points: { requested: number; used: number; cap: number };
  total: number;
};

export function flashIsLive(flash: FlashInput | null | undefined, now: Date): flash is FlashInput {
  return Boolean(flash && flash.startsAt.getTime() <= now.getTime() && flash.endsAt.getTime() > now.getTime());
}

// Unit yang boleh dibeli dengan harga flash: dibatasi batas per pembeli dan sisa kuota slot.
export function allowedFlashUnits(flash: FlashInput, quantity: number) {
  return Math.max(0, Math.min(quantity, flash.maxPerCustomer - flash.boughtByBuyer, flash.quota - flash.sold));
}

export function priceLine(line: PricingLineInput, now: Date): PricedLine {
  const qty = Math.max(0, Math.trunc(line.quantity));
  const fallback = effectivePrice(
    { normalPrice: line.normalPrice, salePrice: line.salePrice, promoPrice: line.promoPrice, promoStartsAt: line.promoStartsAt, promoEndsAt: line.promoEndsAt },
    now,
  );
  const segments: PriceSegment[] = [];
  let flashLimited = false;
  const flash = line.flash;
  if (flashIsLive(flash, now) && flash.flashPrice < fallback.price) {
    const flashQty = allowedFlashUnits(flash, qty);
    if (flashQty > 0) segments.push({ quantity: flashQty, unitPrice: flash.flashPrice, source: "flash", flashSaleItemId: flash.flashSaleItemId });
    if (flashQty < qty) flashLimited = true;
    if (qty - flashQty > 0) segments.push({ quantity: qty - flashQty, unitPrice: fallback.price, source: fallback.source, flashSaleItemId: null });
  } else if (qty > 0) {
    segments.push({ quantity: qty, unitPrice: fallback.price, source: fallback.source, flashSaleItemId: null });
  }
  const lineTotal = segments.reduce((n, s) => n + s.quantity * s.unitPrice, 0);
  const lineNormalTotal = line.normalPrice * qty;
  return {
    variantId: line.variantId,
    quantity: qty,
    segments,
    normalPrice: line.normalPrice,
    lineTotal,
    lineNormalTotal,
    lineDiscount: Math.max(0, lineNormalTotal - lineTotal),
    weightGram: line.weightGram * qty,
    hasFlash: segments.some((s) => s.source === "flash"),
    flashLimited,
  };
}

function lineInScope(line: PricingLineInput, scope: VoucherInput["scope"]) {
  const hasBrands = Boolean(scope.brandIds?.length);
  const hasCats = Boolean(scope.categoryIds?.length);
  if (!hasBrands && !hasCats) return true;
  if (hasBrands && scope.brandIds!.includes(line.brandId)) return true;
  if (hasCats && (scope.categoryIds!.includes(line.categoryId) || (line.parentCategoryId != null && scope.categoryIds!.includes(line.parentCategoryId)))) return true;
  return false;
}

const reject = (code: string, reason: VoucherReason, message: string, type: VoucherType | null = null, eligibleSubtotal = 0): VoucherResult => ({
  code,
  applied: false,
  reason,
  message,
  type,
  discount: 0,
  shippingDiscount: 0,
  eligibleSubtotal,
});

// Validasi voucher dan hitung potongan subtotal. Potongan ongkir dihitung setelah ongkir diketahui.
export function evaluateVoucher(input: { code: string; voucher: VoucherInput | null; lines: PricingLineInput[]; priced: PricedLine[]; now: Date; shipping: ShippingInput | null }): VoucherResult {
  const { code, voucher: v, now } = input;
  if (!v) return reject(code, "tidak_ditemukan", "Kode voucher tidak ditemukan. Cek lagi ejaannya ya.");
  if (!v.isActive) return reject(code, "nonaktif", "Voucher ini sedang tidak aktif.", v.type);
  if (now.getTime() < v.startsAt.getTime()) return reject(code, "belum_mulai", `Voucher ini baru berlaku mulai ${formatDateWib(v.startsAt)}.`, v.type);
  if (now.getTime() >= v.endsAt.getTime()) return reject(code, "kedaluwarsa", `Voucher ini sudah kedaluwarsa sejak ${formatDateWib(v.endsAt)}.`, v.type);
  if (v.quota != null && v.used >= v.quota) return reject(code, "kuota_habis", "Kuota voucher ini sudah habis.", v.type);
  if (v.usedByBuyer >= v.quotaPerCustomer) return reject(code, "kuota_pembeli_habis", "Kamu sudah memakai voucher ini sebanyak batas maksimal.", v.type);

  const eligible = input.lines.map((l, i) => ({ line: l, priced: input.priced[i] })).filter((x) => lineInScope(x.line, v.scope) && x.priced.quantity > 0);
  if (eligible.length === 0) return reject(code, "tidak_berlaku_produk", "Voucher ini tidak berlaku untuk produk di keranjangmu.", v.type);
  if (!v.stackWithFlash && eligible.some((x) => x.priced.hasFlash)) return reject(code, "tidak_bisa_flash", "Voucher ini tidak bisa digabung dengan produk flash sale.", v.type);
  const eligibleSubtotal = eligible.reduce((n, x) => n + x.priced.lineTotal, 0);
  if (eligibleSubtotal < v.minSpend) {
    return reject(code, "minimal_belanja", `Tambah ${formatRupiah(v.minSpend - eligibleSubtotal)} lagi untuk memakai voucher ini (minimal belanja ${formatRupiah(v.minSpend)}).`, v.type, eligibleSubtotal);
  }
  if (v.type === "ongkir" && input.shipping?.method === "ambil") {
    return reject(code, "hanya_kirim", "Voucher gratis ongkir hanya untuk pesanan yang dikirim.", v.type, eligibleSubtotal);
  }

  let discount = 0;
  if (v.type === "nominal") discount = Math.min(v.value, eligibleSubtotal);
  if (v.type === "persen") {
    discount = Math.floor((eligibleSubtotal * v.value) / 100);
    if (v.maxDiscount != null) discount = Math.min(discount, v.maxDiscount);
    discount = Math.min(discount, eligibleSubtotal);
  }
  const message =
    v.type === "ongkir"
      ? input.shipping?.method === "kirim"
        ? "Voucher gratis ongkir terpasang."
        : "Voucher terpasang. Potongan ongkir dihitung setelah kurir dipilih."
      : `Voucher terpasang, hemat ${formatRupiah(discount)}.`;
  return { code, applied: true, reason: null, message, type: v.type, discount: Math.max(0, discount), shippingDiscount: 0, eligibleSubtotal };
}

export function shippingCost(input: { courierCode: CourierCode; zone: Zone; weightGram: number }, rates?: PricingRules["rates"] | null) {
  if (input.courierCode === "ambil_di_toko") return 0;
  const c = couriers.find((x) => x.code === input.courierCode);
  const rate = rates ? rates[input.courierCode]?.[input.zone] : c?.ratePerKg[input.zone];
  if (rate == null) return null;
  return rate * billableKg(input.weightGram);
}

export function priceCart(input: PriceCartInput): PricedCart {
  const { now } = input;
  const threshold = input.rules?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const cap = input.rules?.freeShippingCap ?? FREE_SHIPPING_CAP;
  const priced = input.lines.map((l) => priceLine(l, now));
  const subtotal = priced.reduce((n, l) => n + l.lineTotal, 0);
  const normalSubtotal = priced.reduce((n, l) => n + l.lineNormalTotal, 0);
  const weightGram = priced.reduce((n, l) => n + l.weightGram, 0);
  const itemCount = priced.reduce((n, l) => n + l.quantity, 0);

  const code = input.voucherCode?.trim().toUpperCase() ?? "";
  const voucher = code ? evaluateVoucher({ code, voucher: input.voucher ?? null, lines: input.lines, priced, now, shipping: input.shipping ?? null }) : null;
  const voucherDiscount = voucher?.applied ? Math.min(voucher.discount, subtotal) : 0;
  const afterVoucher = subtotal - voucherDiscount;

  let shipping: ShippingResult | null = null;
  const s = input.shipping;
  if (s?.method === "ambil") {
    shipping = { method: "ambil", courierCode: "ambil_di_toko", zone: null, billableKg: 0, cost: 0, autoFreeDiscount: 0, voucherDiscount: 0, discount: 0, payable: 0 };
  } else if (s?.method === "kirim") {
    const cost = shippingCost({ courierCode: s.courierCode, zone: s.zone, weightGram }, input.rules?.rates) ?? 0;
    const autoFreeDiscount = s.courierCode !== "instan" && threshold > 0 && afterVoucher >= threshold ? Math.min(cost, cap) : 0;
    let voucherShip = 0;
    if (voucher?.applied && voucher.type === "ongkir" && input.voucher) {
      const cap = input.voucher.maxDiscount ?? input.voucher.value;
      voucherShip = Math.max(0, Math.min(cost - autoFreeDiscount, cap));
      voucher.shippingDiscount = voucherShip;
    }
    const discount = autoFreeDiscount + voucherShip;
    shipping = { method: "kirim", courierCode: s.courierCode, zone: s.zone, billableKg: billableKg(weightGram), cost, autoFreeDiscount, voucherDiscount: voucherShip, discount, payable: cost - discount };
  }

  const pointsCap = Math.floor(afterVoucher * POINTS_MAX_RATIO);
  const requested = Math.max(0, Math.trunc(input.points?.requested ?? 0));
  const pointsUsed = Math.max(0, Math.min(requested, input.points?.balance ?? 0, pointsCap));

  const total = Math.max(0, afterVoucher - pointsUsed + (shipping?.payable ?? 0));
  return {
    lines: priced,
    itemCount,
    weightGram,
    normalSubtotal,
    subtotal,
    productDiscount: Math.max(0, normalSubtotal - subtotal),
    voucher,
    voucherDiscount,
    afterVoucher,
    freeShipping: { threshold, cap, qualifies: threshold > 0 && afterVoucher >= threshold, remaining: Math.max(0, threshold - afterVoucher) },
    shipping,
    points: { requested, used: pointsUsed, cap: pointsCap },
    total,
  };
}
