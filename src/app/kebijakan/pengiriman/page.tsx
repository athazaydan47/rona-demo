import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage, HelpSections } from "@/components/layout/help-page";
import { Button } from "@/components/ui/button";
import { PENGIRIMAN } from "@/lib/content/bantuan";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Pengiriman", description: `Kurir, estimasi tiba, cut-off kirim hari ini, gratis ongkir, dan kemasan di ${MEREK.namaLengkap}.` };

export default function PengirimanPage() {
  return (
    <HelpPage eyebrow="Kebijakan" title="Pengiriman" intro="Dari Gudang Online di Malang ke seluruh Indonesia, atau ambil sendiri di cabang." current="/kebijakan/pengiriman">
      <HelpSections sections={PENGIRIMAN} />
      <Button asChild className="mt-8">
        <Link href="/cek-ongkir">Cek ongkir ke kotamu</Link>
      </Button>
    </HelpPage>
  );
}
