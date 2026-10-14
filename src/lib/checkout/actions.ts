"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { createAddress, getAddress, MAX_ADDRESSES, listAddresses } from "@/lib/account/addresses";
import { currentCustomer } from "@/lib/auth/current";
import { ingatTokenPesanan } from "@/lib/orders/token-cookie";
import { resolveCart } from "@/lib/cart/current";
import { viewCart, type CartView } from "@/lib/cart/service";
import { now } from "@/lib/clock";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";
import { availabilityByVariant } from "@/lib/inventory";
import { buildPricingLines, loadVoucher } from "@/lib/orders/pricing-loader";
import { normalizePhone } from "@/lib/orders/rules";
import { placeOrder, WAREHOUSE_SLUG, type PaymentMethod } from "@/lib/orders/service";
import { priceCart, type PricedCart } from "@/lib/pricing/cart";
import { pricingRules, type PaymentMethodKey, pickupAktif } from "@/lib/settings";
import { getStoreSettings } from "@/lib/settings/load";
import { locationFlags } from "@/lib/product/availability";
import { regionName, zoneForRegency } from "@/lib/regions";
import { couriers, etaLabel, instantAvailability, type CourierCode, type Zone } from "@/lib/shipping";
import { siteUrl } from "@/lib/site";
import { scheduleEmailDispatch } from "@/lib/email/schedule";
import { fiturAktif } from "@/config/fitur";
import { BATAS, clientIp, hashKey, limitByKey } from "@/lib/security/rate-limit";
import { catatVoucherSalah, PESAN_VOUCHER_TERBATAS, voucherTerblokir } from "./voucher-guard";

export type CourierOption = { code: CourierCode; name: string; service: string; cost: number; payable: number; etaLabel: string; shipsToday: boolean; disabledNote: string | null };
export type PickupOption = { slug: string; name: string; district: string; address: string; hoursLabel: string; enough: boolean; readyLabel: string };

export type CheckoutQuote = {
  cart: CartView | null;
  pricing: PricedCart | null;
  couriers: CourierOption[];
  pickup: PickupOption[];
  warehouseShort: string[]; // produk yang stok gudangnya kurang untuk pengiriman
  zone: Zone | null;
  payments: PaymentMethodKey[]; // metode bayar aktif dari pengaturan toko
  pickupEnabled: boolean;
  points: { balance: number; usable: number } | null; // hanya untuk pembeli yang masuk
};

const quoteSchema = z.object({
  method: z.enum(["kirim", "ambil"]),
  regencyCode: z.string().max(10).optional().nullable(),
  courierCode: z.enum(["jne_reg", "jne_yes", "jnt_ez", "sicepat_reg", "instan"]).optional().nullable(),
  voucherCode: z.string().max(40).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  usePoints: z.boolean().optional(),
});

async function cartFromCookie() {
  return resolveCart(false);
}

// Penawaran checkout: ringkasan harga terbaru, kurir untuk zona tujuan, dan cabang yang stoknya cukup.
export async function quoteCheckoutAction(raw: z.input<typeof quoteSchema>): Promise<CheckoutQuote> {
  const input = quoteSchema.parse(raw);
  const ipKey = hashKey(clientIp(await headers()));
  const b = BATAS.ongkirPerIp;
  if (!limitByKey(`ongkir:${ipKey}`, b.limit, b.windowMs)) throw new Error("Terlalu sering menghitung ulang. Tunggu sebentar, ya.");
  const [cart, me] = await Promise.all([cartFromCookie(), currentCustomer()]);
  const settings = await getStoreSettings();
  const empty: CheckoutQuote = { cart: null, pricing: null, couriers: [], pickup: [], warehouseShort: [], zone: null, points: null, payments: settings.payments, pickupEnabled: pickupAktif(settings) };
  if (!cart) return empty;
  await ensureFlashSaleSlots(db);
  const at = now();
  // Pembeli yang masuk dikenali dari sesi (batas flash sale dan voucher per pembeli), bukan dari isian.
  const buyer = me ? { customerId: me.customerId, phone: me.phone } : { customerId: null, phone: input.phone ? normalizePhone(input.phone) : null };
  const view = await viewCart(db, cart.id, { now: at, voucherOverride: input.voucherCode ?? null, buyer, settings });
  if (view.lines.length === 0) return { ...empty, cart: view };
  const items = view.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  const kodeVoucher = input.voucherCode?.trim() || null;
  const terblokir = kodeVoucher ? await voucherTerblokir(db, ipKey, at) : false;
  const [{ lines }, voucher, stock, locations] = await Promise.all([
    buildPricingLines(db, items, buyer, at),
    terblokir ? null : loadVoucher(db, input.voucherCode, buyer),
    availabilityByVariant(db, items.map((i) => i.variantId)),
    db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).orderBy(schema.locations.sortOrder),
  ]);
  const zone = input.method === "kirim" && input.regencyCode ? zoneForRegency(input.regencyCode) : null;
  const points = me ? { requested: input.usePoints ? me.points : 0, balance: me.points } : null;
  const rules = pricingRules(settings);
  const priceFor = (shipping: Parameters<typeof priceCart>[0]["shipping"]) => priceCart({ lines, now: at, voucherCode: input.voucherCode, voucher, shipping, points, rules });

  const warehouse = locations.find((l) => l.slug === WAREHOUSE_SLUG);
  const warehouseFlags = warehouse ? locationFlags(warehouse, at, settings.cutoff) : null;
  const warehouseShort = warehouse ? view.lines.filter((l) => (stock.get(l.variantId)?.get(warehouse.id) ?? 0) < l.quantity).map((l) => (l.showShade ? `${l.productName} (${l.shadeName})` : l.productName)) : [];

  const courierOptions: CourierOption[] = [];
  if (zone) {
    for (const c of couriers) {
      if (c.code === "ambil_di_toko" || !settings.couriers.active.includes(c.code) || settings.couriers.rates[c.code]?.[zone] == null || !c.eta[zone]) continue;
      const p = priceFor({ method: "kirim", courierCode: c.code, zone });
      const [a, b] = c.eta[zone]!;
      const instant = c.code === "instan" ? instantAvailability(at, settings.instant) : null;
      courierOptions.push({
        code: c.code,
        name: c.name,
        service: c.service,
        cost: p.shipping?.cost ?? 0,
        payable: p.shipping?.payable ?? 0,
        etaLabel: etaLabel(a, b),
        shipsToday: c.code === "instan" ? Boolean(instant?.available) : Boolean(warehouseFlags?.shipsToday),
        disabledNote: instant && !instant.available ? instant.note : null,
      });
    }
    courierOptions.sort((x, y) => x.payable - y.payable || x.cost - y.cost);
  }

  const pickup: PickupOption[] = locations
    .filter((l) => l.canPickup && pickupAktif(settings))
    .map((l) => {
      const enough = view.lines.every((line) => (stock.get(line.variantId)?.get(l.id) ?? 0) >= line.quantity);
      const f = locationFlags(l, at, settings.cutoff);
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
  else if (zone && input.courierCode && courierOptions.some((c) => c.code === input.courierCode && !c.disabledNote)) pricing = priceFor({ method: "kirim", courierCode: input.courierCode, zone });
  else pricing = priceFor(null);

  if (kodeVoucher && !terblokir && !voucher) await catatVoucherSalah(db, ipKey, kodeVoucher, at);
  if (terblokir && pricing.voucher) pricing = { ...pricing, voucher: { ...pricing.voucher, message: PESAN_VOUCHER_TERBATAS } };

  const pointsInfo = me && fiturAktif("poin") ? { balance: me.points, usable: Math.min(me.points, pricing.points.cap) } : null;
  return { cart: view, pricing, couriers: courierOptions, pickup, warehouseShort, zone, points: pointsInfo, payments: settings.payments, pickupEnabled: pickupAktif(settings) };
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
  addressId: z.number().int().positive().nullable().optional(), // alamat tersimpan (pembeli yang masuk)
  saveAddress: z.boolean().optional(),
  addressLabel: z.string().max(30).optional(),
  usePoints: z.boolean().optional(),
  expectedTotal: z.number().int().nonnegative(),
});

export type PlaceOrderResponse =
  | { ok: true; number: string; token: string; paymentMethod: PaymentMethod }
  | { ok: false; message: string; field?: string; code?: string; pricing?: PricedCart };

export async function placeOrderAction(raw: z.input<typeof placeSchema>): Promise<PlaceOrderResponse> {
  scheduleEmailDispatch(); // kirim email dari outbox setelah respons
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Data belum lengkap.", field: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;
  if (!normalizePhone(d.phone)) return { ok: false, message: "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.", field: "phone" };
  const me = await currentCustomer();
  let address = null;
  let zone: Zone | null = null;
  // Alamat tersimpan dibaca ulang dari database milik pembeli ini; isian browser untuk alamat diabaikan.
  const saved = me && d.method === "kirim" && d.addressId ? await getAddress(db, me.customerId, d.addressId) : null;
  if (me && d.method === "kirim" && d.addressId && !saved) return { ok: false, message: "Alamat tersimpan tidak ditemukan. Pilih alamat lain.", field: "regencyCode" };
  if (saved) {
    zone = saved.regencyCode ? zoneForRegency(saved.regencyCode) : null;
    if (!zone) return { ok: false, message: "Alamat ini perlu dilengkapi kota atau kabupatennya. Ubah di Akun, Alamat.", field: "regencyCode" };
    address = {
      recipient: saved.recipient,
      phone: saved.phone,
      province: saved.province,
      city: saved.city,
      district: saved.district,
      postalCode: saved.postalCode,
      street: saved.street,
      ...(saved.lat != null && saved.lng != null ? { lat: saved.lat, lng: saved.lng } : {}),
    };
  } else if (d.method === "kirim") {
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
  const ipKey = hashKey(clientIp(await headers()));
  if (d.voucherCode && (await voucherTerblokir(db, ipKey))) return { ok: false, message: PESAN_VOUCHER_TERBATAS, code: "voucher", field: "voucherCode" };
  await ensureFlashSaleSlots(db);
  const result = await placeOrder(db, {
    cartId: cart.id,
    // Pembeli yang masuk: pemilik pesanan dan nomor kontak diambil dari sesi.
    buyer: me ? { name: d.name, phone: me.phone, email: d.email || me.email || null, customerId: me.customerId } : { name: d.name, phone: d.phone, email: d.email || null },
    pointsRequested: me && d.usePoints ? me.points : 0,
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
    settings: await getStoreSettings(),
  });
  if (!result.ok) {
    if (result.code === "voucher" && d.voucherCode) await catatVoucherSalah(db, ipKey, d.voucherCode);
    return { ok: false, message: result.message, code: result.code, pricing: result.pricing, field: result.code === "voucher" ? "voucherCode" : undefined };
  }

  // Opsi "simpan alamat ini": hanya untuk alamat baru, gagal diam-diam bila buku alamat penuh.
  if (me && !saved && d.method === "kirim" && d.saveAddress && d.provinceCode && d.regencyCode) {
    const count = (await listAddresses(db, me.customerId)).length;
    if (count < MAX_ADDRESSES) {
      await createAddress(db, me.customerId, {
        label: d.addressLabel || "Rumah",
        recipient: d.name,
        phone: d.phone,
        provinceCode: d.provinceCode,
        regencyCode: d.regencyCode,
        districtCode: d.districtCode ?? null,
        districtText: d.districtText ?? null,
        postalCode: d.postalCode ?? "",
        street: d.street ?? "",
        lat: d.lat ?? null,
        lng: d.lng ?? null,
      });
    }
  }

  // Simpan token pesanan di perangkat supaya tamu bisa membuka pesanannya lagi tanpa tautan.
  await ingatTokenPesanan(result.accessToken);
  return { ok: true, number: result.number, token: result.accessToken, paymentMethod: result.paymentMethod };
}
