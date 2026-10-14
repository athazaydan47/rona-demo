import type { Metadata } from "next";
import { HelpPage, HelpSections } from "@/components/layout/help-page";
import { SYARAT } from "@/lib/content/bantuan";

export const metadata: Metadata = { title: "Syarat dan ketentuan", description: "Syarat memakai Rona Beauty (toko demo): akun, harga dan promo, pesanan dan pembayaran, retur, serta konten dan AI." };

export default function SyaratPage() {
  return (
    <HelpPage eyebrow="Kebijakan" title="Syarat dan ketentuan" intro="Ringkas dan jujur: ini aturan main saat kamu memakai Rona Beauty." current="/kebijakan/syarat">
      <HelpSections sections={SYARAT} />
    </HelpPage>
  );
}
