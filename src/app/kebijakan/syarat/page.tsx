import type { Metadata } from "next";
import { HelpPage, HelpSections } from "@/components/layout/help-page";
import { SYARAT } from "@/lib/content/bantuan";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Syarat dan ketentuan", description: `Syarat memakai ${MEREK.namaLengkap} (toko demo): akun, harga dan promo, pesanan dan pembayaran, retur, serta konten dan AI.` };

export default function SyaratPage() {
  return (
    <HelpPage eyebrow="Kebijakan" title="Syarat dan ketentuan" intro={`Ringkas dan jujur: ini aturan main saat kamu memakai ${MEREK.namaLengkap}.`} current="/kebijakan/syarat">
      <HelpSections sections={SYARAT} />
    </HelpPage>
  );
}
