import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Akunmu" };

export default function Page() {
  return <ComingSoon title="Akunmu" description="Masuk dengan nomor WhatsApp, wishlist, poin, dan profil kulit menyusul." phase="fase 5" packaging="perfume_bottle" shade="#E8F0DE" brandColor="#7A4E8C" brandName="Arunika" />;
}
