"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { CART_COOKIE, ORDERS_COOKIE } from "@/lib/cart/cookie";
import { findCartByToken, viewCart, type CartView } from "@/lib/cart/service";
import { now } from "@/lib/clock";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { availabilityByVariant } from "@/lib/inventory";
import { buildPricingLines, loadVoucher } from "@/lib/orders/pricing-loader";
import { normalizePhone } from "@/lib/orders/rules";
import { placeOrder, WAREHOUSE_SLUG, type PaymentMethod } from "@/lib/orders/service";
import { priceCart, type PricedCart } from "@/lib/pricing/cart";
import { locationFlags } from "@/lib/product/availability";
import { regionName, zoneForRegency } from "@/lib/regions";
import { couriers, etaLabel, type CourierCode, type Zone } from "@/lib/shipping";
import { siteUrl } from "@/lib/site";

export type CourierOption = { code: CourierCode; name: string; service: string; cost: number; payable: number; etaLabel: string; shipsToday: boolean };
export type PickupOption = { slug: string; name: string; district: string; address: string; hoursLabel: string; enough: boolean; readyLabel: string };

export type CheckoutQuote = {
  cart: CartView | null;
  pricing: PricedCart | null;
  couriers: CourierOption[];
  pickup: PickupOption[];
  warehouseShort: string[]; // produk yang stok gudangnya kurang untuk pengiriman
  zone: Zone | null;
};

const quoteSchema = z.object({
  method: z.enum(["kirim", "ambil"]),
  regencyCode: z.string().max(10).optional().nullable(),
  courierCode: z.enum(["jne_reg", "jne_yes", "jnt_ez", "sicepat_reg", "instan"]).optional().nullable(),
  voucherCode: z.string().max(40).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

async function cartFromCookie() {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return findCartByToken(db, token);
}

// Penawaran checkout: ringkasan harga terbaru, kurir untuk zona tujuan, dan cabang yang stoknya cukup.
export async function quoteCheckoutAction(raw: z.input<typeof quoteSchema>): Promise<CheckoutQuote> {
  const input = quoteSchema.parse(raw);
  const cart = await cartFromCookie();
  const empty: CheckoutQuote = { cart: null, pricing: null, couriers: [], pickup: [], warehouseShort: [], zone: null };
  if (!cart) return empty;
  await ensureFlashSaleSlots(db);
  const at = now();
  const view = await viewCart(db, cart.id, { now: at, voucherOverride: input.voucherCode ?? null });
  if (view.lines.length === 0) return { ...empty, cart: view };
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const buyer = { customerId: null, phone };
  const items = view.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  const [{ lines }, voucher, stock, locations] = await Promise.all([
    buildPricingLines(db, items, buyer, at),
    loadVoucher(db, input.voucherCode, buyer),
    availabilityByVariant(db, items.map((i) => i.variantId)),
    db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(schema.locations.sortOrder),
  ]);
  const zone = input.method === "kirim" && input.regencyCode ? zoneForRegency(input.regencyCode) : null;
  const priceFor = (shipping: Parameters<typeof priceCart>[0]["shipping"]) => priceCart({ lines, now: at, voucherCode: input.voucherCode, voucher, shipping });

  const warehouse = locations.find((l) => l.slug === WAREHOUSE_SLUG);
  const warehouseFlags = warehouse ? locationFlags(warehouse, at) : null;
  const warehouseShort = warehouse ? view.lines.filter((l) => (stock.get(l.variantId)?.get(warehouse.id) ?? 0) < l.quantity).map((l) => (l.showShade ? `${l.productName} (${l.shadeName})` : l.productName)) : [];

  const courierOptions: CourierOption[] = [];
  if (zone) {
    for (const c of couriers) {
      if (c.code === "ambil_di_toko" || c.ratePerKg[zone] == null || !c.eta[zone]) continue;
      const p = priceFor({ method: "kirim", courierCode: c.code, zone });
      const [a, b] = c.eta[zone]!;
      courierOptions.push({ code: c.code, name: c.name, service: c.service, cost: p.shipping?.cost ?? 0, payable: p.shipping?.payable ?? 0, etaLabel: etaLabel(a, b), shipsToday: Boolean(warehouseFlags?.shipsToday) });
    }
    courierOptions.sort((x, y) => x.payable - y.payable || x.cost - y.cost);
  }

  const pickup: PickupOption[] = locations
    .filter((l) => l.canPickup)
    .map((l) => {
      const enough = view.lines.every((line) => (stock.get(line.variantId)?.get(l.id) ?? 0) >= line.quantity);
      const f = locationFlags(l, at);
      return {
        slug: l.slug,
        name: l.name,
        district: l.district,
        address: l.address,
        hoursLabel: l.hoursLabel,
        enough,
        readyLabel: f.pickupToday ? "Siap diambil hari ini, sekitar 2 jam setelah pesan" : f.openNow ? "Siap diambil besok saat toko buka" : "Siap diambil saat toko buka berikutnya",
      };
    });

  let pricing: PricedCart;
  if (input.method === "ambil") pricing = priceFor({ method: "ambil" });
  else if (zone && input.courierCode && courierOptions.some((c) => c.code === input.courierCode)) pricing = priceFor({ method: "kirim", courierCode: input.courierCode, zone });
  else pricing = priceFor(null);

  return { cart: view, pricing, couriers: courierOptions, pickup, warehouseShort, zone };
}

const placeSchema = z.object({
  name: z.string().trim().min(2, "Isi nama penerima.").max(80),
  phone: z.string().trim().min(8).max(20),
  email: z.union([z.literal(""), z.email("Email tidak valid.")]).optional(),
  method: z.enum(["kirim", "ambil"]),
  provinceCode: z.string().max(4).optional(),
  regencyCode: z.string().max(10).optional(),
  districtCode: z.string().max(14).optional(),
  districtText: z.string().max(80).optional(),
  postalCode: z.string().max(5).optional(),
  street: z.string().max(300).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  courierCode: z.enum(["jne_reg", "jne_yes", "jnt_ez", "sicepat_reg", "instan"]).nullable().optional(),
  pickupSlug: z.string().max(40).nullable().optional(),
  paymentMethod: z.enum(["qris", "va_bca", "va_bni", "va_bri", "va_mandiri", "bayar_di_toko"]),
  voucherCode: z.string().max(40).nullable().optional(),
  note: z.string().max(300).optional(),
  expectedTotal: z.number().int().nonnegative(),
});

export type PlaceOrderResponse =
  | { ok: true; number: string; token: string; paymentMethod: PaymentMethod }
  | { ok: false; message: string; field?: string; code?: string; pricing?: PricedCart };

export async function placeOrderAction(raw: z.input<typeof placeSchema>): Promise<PlaceOrderResponse> {
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Data belum lengkap.", field: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;
  if (!normalizePhone(d.phone)) return { ok: false, message: "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.", field: "phone" };
  let address = null;
  let zone: Zone | null = null;
  if (d.method === "kirim") {
    zone = d.regencyCode ? zoneForRegency(d.regencyCode) : null;
    const district = d.districtCode ? regionName(d.districtCode) : (d.districtText ?? "").trim();
    if (!d.provinceCode || !zone) return { ok: false, message: "Pilih provinsi dan kota atau kabupaten.", field: "regencyCode" };
    if (!district) return { ok: false, message: "Isi kecamatan.", field: "district" };
    if (!/^\d{5}$/.test(d.postalCode ?? "")) return { ok: false, message: "Kode pos harus 5 angka.", field: "postalCode" };
    if ((d.street ?? "").trim().length < 8) return { ok: false, message: "Tulis alamat lengkap: jalan, nomor rumah, RT/RW.", field: "street" };
    address = {
      recipient: d.name,
      phone: normalizePhone(d.phone)!,
      province: regionName(d.provinceCode),
      city: regionName(d.regencyCode!),
      district,
      postalCode: d.postalCode!,
      street: d.street!.trim(),
      ...(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : {}),
    };
  }
  const cart = await cartFromCookie();
  if (!cart) return { ok: false, message: "Keranjangmu kosong.", code: "keranjang_kosong" };
  await ensureFlashSaleSlots(db);
  const result = await placeOrder(db, {
    cartId: cart.id,
    buyer: { name: d.name, phone: d.phone, email: d.email || null },
    method: d.method,
    address,
    zone,
    courierCode: d.method === "kirim" ? (d.courierCode ?? null) : null,
    pickupLocationSlug: d.method === "ambil" ? (d.pickupSlug ?? null) : null,
    paymentMethod: d.paymentMethod,
    voucherCode: d.voucherCode || null,
    note: d.note,
    expectedTotal: d.expectedTotal,
    siteUrl: siteUrl(),
  });
  if (!result.ok) return { ok: false, message: result.message, code: result.code, pricing: result.pricing, field: result.code === "voucher" ? "voucherCode" : undefined };

  // Simpan token pesanan di perangkat supaya tamu bisa membuka pesanannya lagi tanpa tautan.
  const jar = await cookies();
  const prev = (jar.get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean).slice(-9);
  jar.set(ORDERS_COOKIE, [...prev, result.accessToken].join("."), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return { ok: true, number: result.number, token: result.accessToken, paymentMethod: result.paymentMethod };
}
