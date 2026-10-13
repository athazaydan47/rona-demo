import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Toko kami" };

export default function Page() {
  return <ComingSoon title="Toko kami" description="Tiga cabang di Malang dengan peta, jam buka, dan tombol rute. Stok per cabang sudah bisa dilihat lewat filter katalog." phase="fase 3" packaging="cream_jar" shade="#DAB085" brandColor="#B98A6A" brandName="Pualam" />;
}
