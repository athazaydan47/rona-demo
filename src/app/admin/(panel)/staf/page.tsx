import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { StaffManager } from "@/components/admin/staff-manager";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can, ROLE_SLUGS, ROLE_TEMPLATES } from "@/lib/admin/permissions";
import { listStaff } from "@/lib/admin/staff";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Staf dan izin" };

async function Content() {
  await connection();
  const me = await requireStaff("/admin/staf");
  if (!can(me, "staf.kelola")) return <Denied message="Halaman Staf khusus Owner (izin kelola staf)." />;
  const [staff, locations] = await Promise.all([listStaff(db), db.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).orderBy(asc(schema.locations.sortOrder))]);
  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_SLUGS.map((r) => (
          <div key={r} className="rounded-xl border border-garis bg-putih p-3">
            <p className="text-sm font-semibold">{ROLE_TEMPLATES[r].name}</p>
            <p className="text-xs text-abu-hangat">{ROLE_TEMPLATES[r].description}</p>
            <p className="mt-1 text-[11px] text-abu-hangat">{ROLE_TEMPLATES[r].permissions.length} izin bawaan</p>
          </div>
        ))}
      </div>
      <StaffManager staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))} locations={locations} meId={me.id} demoMode={env.demoMode} />
    </>
  );
}

export default function StaffPage() {
  return (
    <>
      <PageHead title="Staf dan izin" description="Peran adalah templat izin. Owner bisa menambah atau mencabut izin per akun dan memilih lokasi yang diampu." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content />
      </Suspense>
    </>
  );
}
