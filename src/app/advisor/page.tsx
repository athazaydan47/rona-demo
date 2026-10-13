import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Rona Advisor" };

export default function Page() {
  return <ComingSoon title="Rona Advisor" description="Asisten yang hanya merekomendasikan produk yang benar-benar ada di katalog dan stoknya tersedia." phase="fase 7" packaging="serum_dropper" shade="#D9EBE7" brandColor="#2F5D62" brandName="Kirana Lab" />;
}
