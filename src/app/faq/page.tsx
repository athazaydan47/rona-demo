import type { Metadata } from "next";
import { FaqAccordion } from "@/components/layout/faq-accordion";
import { HelpPage } from "@/components/layout/help-page";
import { FAQ } from "@/lib/content/bantuan";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Pertanyaan umum", description: `Jawaban singkat seputar shade, stok, Ambil di Toko, pengiriman, pembayaran, retur, dan fitur AI di ${MEREK.namaLengkap}.` };

export default function FaqPage() {
  return (
    <HelpPage title="Pertanyaan umum" intro={`Yang paling sering ditanyakan. Belum ketemu jawabannya? Tanya ${MEREK.asisten.nama} atau hubungi kami.`} current="/faq">
      <FaqAccordion items={FAQ} />
    </HelpPage>
  );
}
