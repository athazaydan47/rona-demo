import type { Metadata } from "next";
import { HelpPage } from "@/components/layout/help-page";
import { OngkirChecker } from "@/components/store/ongkir-checker";
import { getStoreSettings } from "@/lib/settings/load";

export const metadata: Metadata = { title: "Cek ongkir", description: "Perkirakan ongkir dari Gudang Online Malang ke kotamu sebelum checkout." };

export default async function CekOngkirPage() {
  const settings = await getStoreSettings();
  return (
    <HelpPage title="Cek ongkir" intro="Perkirakan ongkir sebelum belanja. Tarifnya sama dengan yang dipakai di checkout, tinggal pilih kota dan berat kira-kira." current="/cek-ongkir">
      <OngkirChecker rates={settings.couriers.rates} active={settings.couriers.active} />
    </HelpPage>
  );
}
