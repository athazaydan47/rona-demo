import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Keranjang" };

export default function Page() {
  return <ComingSoon title="Keranjang" description="Produk yang kamu tambahkan sudah tersimpan di perangkat ini. Halaman keranjang, voucher, dan checkout 3 langkah menyusul." phase="fase 4" packaging="lip_tint" shade="#E2654A" brandColor="#C2416B" brandName="Lumi" />;
}
