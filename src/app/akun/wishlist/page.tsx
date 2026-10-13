import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { WishlistRemoveButton } from "@/components/account/wishlist-remove";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { wishlistIds } from "@/lib/account/wishlist";
import { fetchCatalogItems, toCardData } from "@/lib/catalog/catalog-queries";

export const metadata: Metadata = { title: "Wishlist" };

async function Wishlist() {
  await connection();
  const me = await requireCustomer("/akun/wishlist");
  const ids = await wishlistIds(db, me.customerId);
  // Harga efektif dan stok dibaca segar dari katalog (tanpa cache).
  const items = ids.length ? await fetchCatalogItems({ kind: "ids", ids }) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const products = ids.map((id) => byId.get(id)).filter((i) => i != null).map((i) => toCardData(i));
  if (products.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-garis bg-putih p-8 text-center">
        <p className="font-serif text-xl text-kopi">Wishlist-mu masih kosong</p>
        <p className="mt-1 text-sm text-abu-hangat">Ketuk ikon hati di halaman produk untuk menyimpannya di sini.</p>
        <Button asChild className="mt-4">
          <Link href="/c/semua">Jelajahi produk</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {products.map((p) => (
        <li key={p.id} className="flex flex-col">
          <ProductCard product={p} />
          <WishlistRemoveButton productId={p.id} name={p.name} />
        </li>
      ))}
    </ul>
  );
}

export default function WishlistPage() {
  return (
    <>
      <AccountPageHead title="Wishlist" description="Harga dan stok selalu yang terbaru." />
      <Suspense fallback={<AccountSkeleton />}>
        <Wishlist />
      </Suspense>
    </>
  );
}
