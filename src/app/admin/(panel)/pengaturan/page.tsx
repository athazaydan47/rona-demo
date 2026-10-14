import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { LocationsEditor, SettingsForm } from "@/components/admin/settings-form";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { listLocations } from "@/lib/admin/settings";
import { env } from "@/lib/env";
import { loadSettings } from "@/lib/settings/db";

export const metadata: Metadata = { title: "Pengaturan" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/pengaturan");
  if (!can(me, "pengaturan.kelola")) return <Denied />;
  const [settings, locations] = await Promise.all([loadSettings(db), listLocations(db)]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SettingsForm initial={settings} demoMode={env.demoMode} />
      <div>
        <h2 className="mb-3 font-serif text-xl">Cabang</h2>
        <LocationsEditor key={locations.map((l) => l.updatedAt?.toISOString()).join()} locations={locations.map((l) => ({ id: l.id, slug: l.slug, name: l.name, type: l.type, address: l.address, district: l.district, city: l.city, phone: l.phone, lat: l.lat, lng: l.lng, openingHours: l.openingHours, closedDates: l.closedDates ?? [], canPickup: l.canPickup }))} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Pengaturan" description="Logika toko (ongkir, cut-off, stok menipis) langsung membaca nilai di sini." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content />
      </Suspense>
    </>
  );
}
