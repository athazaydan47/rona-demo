import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { db, schema } from "@/db/client";
import { currentStaff } from "@/lib/admin/current";
import { ADMIN_NAV, MOBILE_PRIORITY } from "@/lib/admin/nav";
import { allLocations, can, ROLE_TEMPLATES } from "@/lib/admin/permissions";
import { aiTersedia } from "@/lib/ai";
import { env } from "@/lib/env";
import { inArray } from "drizzle-orm";

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const staff = await currentStaff();
  if (!staff) redirect("/admin/masuk");
  const items = ADMIN_NAV.filter((n) => n.permission == null || can(staff, n.permission)).map(({ key, href, label, soon }) => ({ key, href, label, soon }));
  const locs = allLocations(staff) ? [] : await db.select({ name: schema.locations.name }).from(schema.locations).where(inArray(schema.locations.id, staff.locationIds));
  const scope = allLocations(staff) ? "Semua lokasi" : locs.map((l) => l.name).join(", ");
  return (
    <AdminShell items={items} mobilePrimary={MOBILE_PRIORITY[staff.roleSlug]} staff={{ name: staff.name, roleName: ROLE_TEMPLATES[staff.roleSlug].name, scope }} demoMode={env.demoMode} assistantRole={aiTersedia("asistenAdmin") ? staff.roleSlug : null}>
      {children}
    </AdminShell>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-abu-hangat">Memuat panel admin...</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
