import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { db } from "@/db/client";
import { quoteCheckoutAction } from "@/lib/checkout/actions";
import { listAddresses, MAX_ADDRESSES } from "@/lib/account/addresses";
import { currentCustomer } from "@/lib/auth/current";
import { resolveCart } from "@/lib/cart/current";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function CheckoutContent() {
  await connection();
  const [cart, me] = await Promise.all([resolveCart(false), currentCustomer()]);
  const voucher = cart?.voucherCode ?? null;
  const addresses = me ? await listAddresses(db, me.customerId) : [];
  const primary = addresses.find((a) => a.isPrimary && a.regencyCode) ?? addresses.find((a) => a.regencyCode);
  const initial = await quoteCheckoutAction({ method: "kirim", voucherCode: voucher, regencyCode: primary?.regencyCode ?? null });
  const account = me
    ? {
        name: me.name,
        phone: me.phone,
        email: me.email,
        canSaveMore: addresses.length < MAX_ADDRESSES,
        addresses: addresses.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, street: a.street, district: a.district, city: a.city, province: a.province, postalCode: a.postalCode, provinceCode: a.provinceCode, regencyCode: a.regencyCode, districtCode: a.districtCode, lat: a.lat, lng: a.lng, isPrimary: a.isPrimary })),
      }
    : null;
  return <CheckoutFlow initial={initial} initialVoucher={voucher} account={account} />;
}

export default function CheckoutPage() {
  return (
    <section className="container-rona py-6 md:py-8">
      <Breadcrumb items={[{ label: "Keranjang", href: "/keranjang" }, { label: "Checkout" }]} className="mb-3" />
      <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">Checkout</h1>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]" aria-busy>
              <div className="h-96 animate-pulse rounded-card bg-garis/50" />
              <div className="hidden h-96 animate-pulse rounded-card bg-garis/50 lg:block" />
            </div>
          }
        >
          <CheckoutContent />
        </Suspense>
      </div>
    </section>
  );
}
