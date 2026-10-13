import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";

export default function NotFound() {
  return (
    <section className="container-rona flex flex-col items-center py-20 text-center">
      <div className="w-40">
        <ProductArt packaging="sheet_mask" shade="#F4DCDF" brandColor="#B8475D" brandName="Rona" title="Ilustrasi halaman tidak ditemukan" />
      </div>
      <h1 className="mt-6 font-serif text-3xl font-medium text-kopi">Halaman ini belum ada</h1>
      <p className="mt-3 max-w-md text-abu-hangat">
        Mungkin tautannya salah, atau fiturnya belum dibangun di fase ini. Kamu bisa kembali ke beranda dulu.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Ke beranda</Link>
      </Button>
    </section>
  );
}
