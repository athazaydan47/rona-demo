import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { DashboardLive } from "@/components/admin/dashboard-live";
import { PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { dashboardData } from "@/lib/admin/dashboard";
import { allLocations, can } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { demoModeOn } from "@/lib/demo/reset";
import { SEED_VERSION } from "@/db/seed/version";
import { loadSettings } from "@/lib/settings/db";

export const metadata: Metadata = { title: "Dashboard" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin");
  const data = await dashboardData(db, me, now());
  return (
    <>
      <PageHead title={`Halo, ${me.name.split(" ")[0]}`} description={allLocations(me) ? "Ringkasan semua lokasi." : "Ringkasan lokasi yang kamu ampu."} />
      <DashboardLive initial={data} canReset={demoModeOn(process.env) && can(me, "demo.reset")} seedVersion={SEED_VERSION} installedVersion={(await loadSettings(db)).seedVersion} />
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Content />
    </Suspense>
  );
}
