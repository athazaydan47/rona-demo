import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CartPage } from "@/components/cart/cart-page";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { resolveCart } from "@/lib/cart/current";
import { viewCart } from "@/lib/cart/service";
import { now } from "@/lib/clock";
import { ensureFlashSaleSlots } from "@/lib/flash/ensure";

export const metadata: Metadata = { title: "Keranjang" };

async function CartContent() {
  await connection();
  const [cart, customer] = await Promise.all([resolveCart(false), currentCustomer()]);
  await ensureFlashSaleSlots(db);
  const view = cart ? await viewCart(db, cart.id, { now: now(), buyer: customer ? { customerId: customer.customerId, phone: customer.phone } : undefined }) : null;
  return <CartPage initial={view} />;
}

export default function KeranjangPage() {
  return (
    <section className="container-rona py-6 md:py-8">
      <Breadcrumb items={[{ label: "Keranjang" }]} className="mb-3" />
      <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">Keranjang</h1>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" aria-busy>
              <div className="h-72 animate-pulse rounded-card bg-garis/50" />
              <div className="h-72 animate-pulse rounded-card bg-garis/50" />
            </div>
          }
        >
          <CartContent />
        </Suspense>
      </div>
    </section>
  );
}
