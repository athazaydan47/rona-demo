import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { db } from "@/db/client";
import { quoteCheckoutAction } from "@/lib/checkout/actions";
import { CART_COOKIE } from "@/lib/cart/cookie";
import { findCartByToken } from "@/lib/cart/service";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function CheckoutContent() {
  await connection();
  const cart = await findCartByToken(db, (await cookies()).get(CART_COOKIE)?.value);
  const voucher = cart?.voucherCode ?? null;
  const initial = await quoteCheckoutAction({ method: "kirim", voucherCode: voucher });
  return <CheckoutFlow initial={initial} initialVoucher={voucher} />;
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
