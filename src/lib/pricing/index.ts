import { now as clockNow } from "@/lib/clock";

// Fungsi murni untuk harga. Semua angka bilangan bulat rupiah.

// Persen diskon dibulatkan ke bawah. 0 bila tidak ada diskon.
export function discountPercent(normalPrice: number, effectivePrice: number) {
  if (normalPrice <= 0 || effectivePrice >= normalPrice) return 0;
  return Math.floor(((normalPrice - effectivePrice) / normalPrice) * 100);
}

// Harga promo dibulatkan ke Rp 500 terdekat.
export function roundToPromo(price: number) {
  return Math.round(price / 500) * 500;
}

export type PriceSource = "flash" | "promo" | "normal";

export type VariantPriceInput = {
  normalPrice: number;
  salePrice: number;
  promoPrice?: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
  flashPrice?: number | null;
};

export type EffectivePrice = {
  price: number;
  normalPrice: number;
  source: PriceSource;
  percent: number;
};

// Urutan: Flash Sale, lalu Harga Promo (bila dalam periode), lalu Harga Jual.
export function effectivePrice(v: VariantPriceInput, now: Date = clockNow()): EffectivePrice {
  if (v.flashPrice != null && v.flashPrice > 0 && v.flashPrice < v.salePrice) {
    return {
      price: v.flashPrice,
      normalPrice: v.normalPrice,
      source: "flash",
      percent: discountPercent(v.normalPrice, v.flashPrice),
    };
  }
  const promoActive =
    v.promoPrice != null &&
    v.promoPrice > 0 &&
    v.promoPrice < v.salePrice &&
    (!v.promoStartsAt || v.promoStartsAt <= now) &&
    (!v.promoEndsAt || v.promoEndsAt > now);
  if (promoActive) {
    return {
      price: v.promoPrice as number,
      normalPrice: v.normalPrice,
      source: "promo",
      percent: discountPercent(v.normalPrice, v.promoPrice as number),
    };
  }
  return {
    price: v.salePrice,
    normalPrice: v.normalPrice,
    source: "normal",
    percent: discountPercent(v.normalPrice, v.salePrice),
  };
}

// Batas jumlah yang bisa dibeli: stok tersedia, dan saat flash sale juga batas per pembeli dan sisa kuota.
export function maxPurchasable(input: { available: number; isFlash?: boolean; maxPerCustomer?: number | null; quotaLeft?: number | null; hardCap?: number }) {
  const cap = input.hardCap ?? 10;
  let max = Math.max(0, Math.min(cap, input.available));
  if (input.isFlash) {
    if (input.maxPerCustomer != null) max = Math.min(max, Math.max(0, input.maxPerCustomer));
    if (input.quotaLeft != null) max = Math.min(max, Math.max(0, input.quotaLeft));
  }
  return max;
}
