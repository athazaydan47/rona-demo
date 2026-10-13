// Kelola akun staf (izin staf.kelola, bawaan hanya Owner). Saat DEMO_MODE, akun demo terkunci supaya pengunjung
// tidak mengunci pengunjung berikutnya: tidak bisa dinonaktifkan, diganti kata sandinya, atau diubah peran dan izinnya.
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/db-types";
import { writeAudit } from "./audit";
import { normalizeEmail, revokeAllStaffSessions } from "./auth";
import { hashPassword, validateNewPassword } from "./password";
import { can, isPermissionKey, isRoleSlug, ROLE_TEMPLATES, type RoleSlug, type StaffPrincipal } from "./permissions";

export const DEMO_STAFF_EMAILS = ["owner@rona.demo", "admin@rona.demo", "dinoyo@rona.demo", "gudang@rona.demo"] as const;
export const DEMO_QUICK_LOGIN: { email: (typeof DEMO_STAFF_EMAILS)[number]; label: string; role: RoleSlug }[] = [
  { email: "owner@rona.demo", label: "Owner", role: "owner" },
  { email: "admin@rona.demo", label: "Admin Online", role: "admin_online" },
  { email: "dinoyo@rona.demo", label: "Staf Cabang Dinoyo", role: "staf_cabang" },
  { email: "gudang@rona.demo", label: "Gudang", role: "gudang" },
];
export const isDemoStaffEmail = (email: string) => (DEMO_STAFF_EMAILS as readonly string[]).includes(normalizeEmail(email));

export type StaffListItem = { id: number; name: string; email: string; roleSlug: RoleSlug; roleName: string; isActive: boolean; lastLoginAt: Date | null; locationIds: number[]; grants: string[]; revokes: string[]; isDemo: boolean };

export async function listStaff(db: AnyDb): Promise<StaffListItem[]> {
  const rows = await db
    .select({ id: schema.staff.id, name: schema.staff.name, email: schema.staff.email, isActive: schema.staff.isActive, lastLoginAt: schema.staff.lastLoginAt, roleSlug: schema.roles.slug, roleName: schema.roles.name })
    .from(schema.staff)
    .innerJoin(schema.roles, eq(schema.staff.roleId, schema.roles.id))
    .orderBy(asc(schema.staff.id));
  const ids = rows.map((r) => r.id);
  const [perms, locs] = ids.length
    ? await Promise.all([
        db.select().from(schema.permissions).where(inArray(schema.permissions.staffId, ids)),
        db.select().from(schema.staffLocations).where(inArray(schema.staffLocations.staffId, ids)),
      ])
    : [[], []];
  return rows
    .filter((r) => isRoleSlug(r.roleSlug))
    .map((r) => ({
      ...r,
      roleSlug: r.roleSlug as RoleSlug,
      locationIds: locs.filter((l) => l.staffId === r.id).map((l) => l.locationId).sort((a, b) => a - b),
      grants: perms.filter((p) => p.staffId === r.id && p.allowed).map((p) => p.key),
      revokes: perms.filter((p) => p.staffId === r.id && !p.allowed).map((p) => p.key),
      isDemo: isDemoStaffEmail(r.email),
    }));
}

export type StaffInput = { name: string; email: string; roleSlug: string; locationIds: number[]; grants: string[]; revokes: string[]; password?: string };
export type StaffResult = { ok: true; id: number } | { ok: false; message: string; field?: string };

const DEMO_LOCKED = "Akun demo tidak bisa diubah saat mode demo, supaya pengunjung berikutnya tetap bisa masuk. Buat akun baru untuk mencoba.";

async function validate(db: AnyDb, input: StaffInput, selfId?: number): Promise<{ ok: true; role: RoleSlug; email: string; name: string; locationIds: number[]; grants: string[]; revokes: string[] } | { ok: false; message: string; field?: string }> {
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return { ok: false, message: "Nama 2 sampai 60 huruf.", field: "name" };
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Email tidak valid.", field: "email" };
  if (!isRoleSlug(input.roleSlug)) return { ok: false, message: "Pilih peran.", field: "role" };
  const role = input.roleSlug;
  const [dup] = await db.select({ id: schema.staff.id }).from(schema.staff).where(selfId ? and(eq(schema.staff.email, email), ne(schema.staff.id, selfId)) : eq(schema.staff.email, email)).limit(1);
  if (dup) return { ok: false, message: "Email ini sudah dipakai akun lain.", field: "email" };
  const locIds = [...new Set((input.locationIds ?? []).filter((n) => Number.isInteger(n)))];
  if (locIds.length) {
    const found = await db.select({ id: schema.locations.id }).from(schema.locations).where(inArray(schema.locations.id, locIds));
    if (found.length !== locIds.length) return { ok: false, message: "Ada lokasi yang tidak dikenal.", field: "locations" };
  }
  if (ROLE_TEMPLATES[role].needsLocation && locIds.length === 0) return { ok: false, message: "Staf Cabang wajib mengampu minimal satu lokasi.", field: "locations" };
  const template = new Set<string>(ROLE_TEMPLATES[role].permissions);
  // Izin tambahan hanya yang di luar templat; pencabutan hanya yang ada di templat.
  const grants = [...new Set((input.grants ?? []).filter((k) => isPermissionKey(k) && !template.has(k)))];
  const revokes = [...new Set((input.revokes ?? []).filter((k) => isPermissionKey(k) && template.has(k)))];
  return { ok: true, role, email, name, locationIds: role === "owner" ? [] : locIds, grants, revokes };
}

async function roleId(db: AnyDb, slug: RoleSlug) {
  const [r] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.slug, slug)).limit(1);
  if (r) return r.id;
  const [created] = await db.insert(schema.roles).values({ slug, name: ROLE_TEMPLATES[slug].name, description: ROLE_TEMPLATES[slug].description, defaultPermissions: [...ROLE_TEMPLATES[slug].permissions] }).returning({ id: schema.roles.id });
  return created.id;
}

async function writeAccess(tx: AnyDb, staffId: number, v: { locationIds: number[]; grants: string[]; revokes: string[] }) {
  await tx.delete(schema.staffLocations).where(eq(schema.staffLocations.staffId, staffId));
  if (v.locationIds.length) await tx.insert(schema.staffLocations).values(v.locationIds.map((locationId) => ({ staffId, locationId })));
  await tx.delete(schema.permissions).where(eq(schema.permissions.staffId, staffId));
  const perms = [...v.grants.map((key) => ({ staffId, key, allowed: true })), ...v.revokes.map((key) => ({ staffId, key, allowed: false }))];
  if (perms.length) await tx.insert(schema.permissions).values(perms);
}

export async function createStaff(db: AnyDb, actor: StaffPrincipal, input: StaffInput, opts: { now?: Date } = {}): Promise<StaffResult> {
  if (!can(actor, "staf.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola staf." };
  const v = await validate(db, input);
  if (!v.ok) return v;
  const pwError = validateNewPassword(input.password ?? "");
  if (pwError) return { ok: false, message: pwError, field: "password" };
  const passwordHash = await hashPassword(input.password!);
  const at = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.staff).values({ name: v.name, email: v.email, passwordHash, roleId: await roleId(tx, v.role), locationId: v.locationIds[0] ?? null, isActive: true, createdAt: at }).returning({ id: schema.staff.id });
    await writeAccess(tx, row.id, v);
    await writeAudit(tx, { staff: actor, action: "staf.tambah", objectType: "staf", objectId: row.id, summary: `Tambah ${v.name} (${ROLE_TEMPLATES[v.role].name})`, after: { nama: v.name, email: v.email, peran: v.role, lokasi: v.locationIds, izinTambahan: v.grants, izinDicabut: v.revokes }, at });
    return { ok: true as const, id: row.id };
  });
}

async function current(db: AnyDb, id: number) {
  return (await listStaff(db)).find((s) => s.id === id) ?? null;
}

export async function updateStaff(db: AnyDb, actor: StaffPrincipal, id: number, input: StaffInput, opts: { demoMode: boolean; now?: Date }): Promise<StaffResult> {
  if (!can(actor, "staf.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola staf." };
  const before = await current(db, id);
  if (!before) return { ok: false, message: "Akun tidak ditemukan." };
  if (opts.demoMode && before.isDemo) return { ok: false, message: DEMO_LOCKED };
  const v = await validate(db, input, id);
  if (!v.ok) return v;
  if (id === actor.id && (v.role !== actor.roleSlug || v.revokes.includes("staf.kelola"))) return { ok: false, message: "Kamu tidak bisa mengubah peran atau mencabut izin kelola staf dari akunmu sendiri." };
  const at = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.staff).set({ name: v.name, email: v.email, roleId: await roleId(tx, v.role), locationId: v.locationIds[0] ?? null }).where(eq(schema.staff.id, id));
    await writeAccess(tx, id, v);
    await writeAudit(tx, {
      staff: actor,
      action: "staf.ubah",
      objectType: "staf",
      objectId: id,
      summary: `Ubah ${v.name}`,
      before: { nama: before.name, email: before.email, peran: before.roleSlug, lokasi: before.locationIds, izinTambahan: before.grants, izinDicabut: before.revokes },
      after: { nama: v.name, email: v.email, peran: v.role, lokasi: v.locationIds, izinTambahan: v.grants, izinDicabut: v.revokes },
      at,
    });
  });
  return { ok: true, id };
}

export async function setStaffActive(db: AnyDb, actor: StaffPrincipal, id: number, active: boolean, opts: { demoMode: boolean; now?: Date }): Promise<StaffResult> {
  if (!can(actor, "staf.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola staf." };
  const before = await current(db, id);
  if (!before) return { ok: false, message: "Akun tidak ditemukan." };
  if (opts.demoMode && before.isDemo) return { ok: false, message: DEMO_LOCKED };
  if (id === actor.id && !active) return { ok: false, message: "Kamu tidak bisa menonaktifkan akunmu sendiri." };
  const at = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.staff).set({ isActive: active }).where(eq(schema.staff.id, id));
    // Menonaktifkan akun ikut mencabut semua sesi aktifnya.
    const revoked = active ? 0 : await revokeAllStaffSessions(tx, id, at);
    await writeAudit(tx, { staff: actor, action: active ? "staf.aktif" : "staf.nonaktif", objectType: "staf", objectId: id, summary: `${active ? "Aktifkan" : "Nonaktifkan"} ${before.name}${revoked ? `, ${revoked} sesi dicabut` : ""}`, before: { aktif: before.isActive }, after: { aktif: active }, at });
  });
  return { ok: true, id };
}

export async function resetStaffPassword(db: AnyDb, actor: StaffPrincipal, id: number, password: string, opts: { demoMode: boolean; now?: Date }): Promise<StaffResult> {
  if (!can(actor, "staf.kelola")) return { ok: false, message: "Kamu tidak punya izin mengelola staf." };
  const before = await current(db, id);
  if (!before) return { ok: false, message: "Akun tidak ditemukan." };
  if (opts.demoMode && before.isDemo) return { ok: false, message: DEMO_LOCKED };
  const pwError = validateNewPassword(password);
  if (pwError) return { ok: false, message: pwError, field: "password" };
  const at = opts.now ?? new Date();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(schema.staff).set({ passwordHash }).where(eq(schema.staff.id, id));
    const revoked = await revokeAllStaffSessions(tx, id, at);
    await writeAudit(tx, { staff: actor, action: "staf.sandi", objectType: "staf", objectId: id, summary: `Atur ulang kata sandi ${before.name}, ${revoked} sesi dicabut`, at });
  });
  return { ok: true, id };
}
