import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Kuis Kulit" };

export default function Page() {
  return <ComingSoon title="Kuis Kulit" description="Enam pertanyaan bergambar untuk tahu jenis kulit, undertone, dan rutinitas yang pas untukmu." phase="fase 7" packaging="sheet_mask" shade="#BFD8EE" brandColor="#5B8DB8" brandName="Embun" />;
}
