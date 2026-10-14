import type { Metadata } from "next";
import { FaqAccordion } from "@/components/layout/faq-accordion";
import { HelpPage } from "@/components/layout/help-page";
import { FAQ } from "@/lib/content/bantuan";

export const metadata: Metadata = { title: "Pertanyaan umum", description: "Jawaban singkat seputar shade, stok, Ambil di Toko, pengiriman, pembayaran, retur, dan fitur AI di Rona Beauty." };

export default function FaqPage() {
  return (
    <HelpPage title="Pertanyaan umum" intro="Yang paling sering ditanyakan. Belum ketemu jawabannya? Tanya Rona Advisor atau hubungi kami." current="/faq">
      <FaqAccordion items={FAQ} />
    </HelpPage>
  );
}
