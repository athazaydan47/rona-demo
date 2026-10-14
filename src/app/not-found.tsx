import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { SearchBox } from "@/components/layout/search-box";
import { Button } from "@/components/ui/button";

const POPULAR = [
  { href: "/c/makeup-wajah", label: "Makeup wajah" },
  { href: "/c/bibir", label: "Bibir" },
  { href: "/c/skincare", label: "Skincare" },
  { href: "/c/sun-care", label: "Sun care" },
  { href: "/flash-sale", label: "Flash sale" },
];

// Halaman 404 Rona: pencarian, kategori populer, dan jalan kembali. Dipakai juga oleh not-found produk.
export default function NotFound() {
  return (
    <section className="container-rona flex flex-col items-center py-16 text-center md:py-24">
      <div className="w-36">
        <ProductArt packaging="sheet_mask" shade="#F4DCDF" brandColor="#B8475D" brandName="Rona" title="Ilustrasi halaman tidak ditemukan" priority />
      </div>
      <p className="mt-6 text-xs font-semibold tracking-wide text-rona uppercase">404</p>
      <h1 className="mt-1 font-serif text-3xl font-medium text-kopi md:text-4xl">Halaman ini belum ada</h1>
      <p className="mt-3 max-w-md text-abu-hangat">Mungkin tautannya salah ketik atau sudah dipindah. Cari yang kamu mau, atau mulai dari kategori populer.</p>
      <SearchBox className="mt-6 w-full max-w-md" />
      <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Kategori populer">
        {POPULAR.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="inline-flex h-9 items-center rounded-pill border border-garis bg-putih px-3.5 text-sm font-medium text-kopi hover:border-rona/40">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="ghost" className="mt-6">
        <Link href="/">
          Ke beranda <ArrowRight />
        </Link>
      </Button>
    </section>
  );
}
