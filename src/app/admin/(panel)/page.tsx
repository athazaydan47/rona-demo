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
import { AlertTriangle } from "lucide-react";
import { bacaCronStatus, cronPeringatan } from "@/lib/cron-status";

export const metadata: Metadata = { title: "Dashboard" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin");
  const data = await dashboardData(db, me, now());
  // Peringatan cron harian hanya untuk Owner (pemegang izin pengaturan), Fase 8B.
  const cron = can(me, "pengaturan.kelola") ? await bacaCronStatus(db).catch(() => null) : null;
  const peringatan = cron ? cronPeringatan(cron.status, cron.patokan, new Date()) : null;
  return (
    <>
      <PageHead title={`Halo, ${me.name.split(" ")[0]}`} description={allLocations(me) ? "Ringkasan semua lokasi." : "Ringkasan lokasi yang kamu ampu."} />
      {peringatan ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-[#E8C9A0] bg-[#FBEEDC] px-4 py-3 text-sm text-peringatan-teks" role="alert" data-testid="peringatan-cron">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {peringatan.pesan} Panduan pemulihan ada di docs/OPERASIONAL.md.
          </span>
        </p>
      ) : null}
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
