import Link from "next/link";
import type { Packaging } from "@/db/schema/enums";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";

type Props = {
  title: string;
  description: string;
  phase: string; // misal "fase 7"
  packaging?: Packaging;
  shade?: string;
  brandColor?: string;
  brandName?: string;
};

// Halaman "segera hadir" bermerek untuk rute yang dibangun di fase berikutnya.
export function ComingSoon({ title, description, phase, packaging = "sheet_mask", shade = "#F4DCDF", brandColor = "#B8475D", brandName = "Rona" }: Props) {
  return (
    <section className="container-rona flex flex-col items-center py-16 text-center md:py-24">
      <div className="w-40">
        <ProductArt packaging={packaging} shade={shade} brandColor={brandColor} brandName={brandName} title={`Ilustrasi ${title}`} view="detail" />
      </div>
      <p className="mt-6 text-xs font-semibold tracking-wide text-rona uppercase">Segera hadir</p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-md text-abu-hangat">{description}</p>
      <p className="mt-1 text-xs text-abu-hangat">Dibangun di {phase} demo ini.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">Ke beranda</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/c/semua">Lihat katalog</Link>
        </Button>
      </div>
    </section>
  );
}
