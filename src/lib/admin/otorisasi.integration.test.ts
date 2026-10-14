// Audit otorisasi otomatis (Fase 8B): setiap server action admin dan pembeli, serta route handler admin, dipanggil
// tanpa sesi dan dengan staf tanpa izin. Semuanya harus menolak (ok false, null, 401 atau 403, atau dialihkan) dan
// database tidak boleh berubah. Daftar aksi diambil dari ekspor modul, jadi aksi baru otomatis ikut diuji.
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StaffPrincipal } from "@/lib/admin/permissions";
import { ROLE_TEMPLATES } from "@/lib/admin/permissions";
import { dbUrl, integration } from "@/test/integration";

const sesi = vi.hoisted(() => ({ staff: null as StaffPrincipal | null, customer: null as { customerId: number } | null }));

vi.mock("@/lib/admin/current", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin/current")>()),
  currentStaff: async () => sesi.staff,
  requireStaff: async (path: string) => {
    if (!sesi.staff) throw new Error(`REDIRECT /admin/masuk?kembali=${path}`);
    return sesi.staff;
  },
}));
vi.mock("@/lib/auth/current", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/current")>()), currentCustomer: async () => sesi.customer }));
vi.mock("next/cache", () => ({ revalidateTag: () => {}, updateTag: () => {}, revalidatePath: () => {}, cacheTag: () => {}, cacheLife: () => {}, refresh: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, has: () => false }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT ${u}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {}, connection: async () => {} }));

// Aksi publik atau milik semua staf yang masuk; diuji terpisah di bawah atau di uji modulnya.
const PUBLIK = new Set(["staffLoginAction", "demoStaffLoginAction", "demoResetInfoAction"]);
// Boleh untuk semua staf yang masuk (tanpa izin khusus); hasilnya disaring izin.
const SEMUA_STAF = new Set(["staffLogoutAction", "dashboardAction", "adminSearchAction"]);

const MODUL_ADMIN = {
  "admin/actions": () => import("./actions"),
  "admin/ai-actions": () => import("./ai-actions"),
  "admin/catalog-actions": () => import("./catalog-actions"),
  "admin/kabar-actions": () => import("./kabar-actions"),
  "admin/moderation-actions": () => import("./moderation-actions"),
};
const MODUL_PEMBELI = {
  "account/actions": () => import("@/lib/account/actions"),
};
const AKSI_PEMBELI_AUTH = ["setNameAction", "logoutAllAction", "accountStatusAction", "requestPhoneChangeOtpAction", "verifyPhoneChangeAction"];

// Argumen tiruan: objek kosong, angka id yang ada di seed, dan FormData kosong. Aksi wajib menolak sebelum memakainya.
const ARGS: unknown[][] = [[], [{}], [1], [1, {}], [{ id: 1 }, 1, "x"], [new FormData()], [{}, new FormData()]];

const tanpaIzin = (): StaffPrincipal => ({ id: 1, name: "Tanpa Izin", email: "tanpa-izin@uji.invalid", roleSlug: "staf_cabang", isActive: true, grants: [], revokes: [...ROLE_TEMPLATES.staf_cabang.permissions], locationIds: [2] });

function ditolak(r: unknown) {
  if (r == null) return true;
  if (typeof r === "object" && !Array.isArray(r) && Object.keys(r as object).length === 0) return true; // hasil kosong, tanpa data
  if (typeof r === "object" && r && "loggedIn" in r && (r as { loggedIn: unknown }).loggedIn === false) return true; // status tamu tanpa data
  if (typeof r === "object" && r && "ok" in r) return (r as { ok: unknown }).ok === false;
  if (typeof r === "object" && r && "error" in r) return Boolean((r as { error?: unknown }).error);
  if (Array.isArray(r)) return r.length === 0;
  return false;
}

describe.skipIf(!dbUrl)("audit otorisasi server action dan route admin", () => {
  const t = integration();
  const { db } = t;
  let sidik = "";

  async function sidikJari() {
    const rows = (await db.execute(sql`
      select concat_ws('|',
        (select count(*) from audit_logs), (select count(*) from products), (select count(*) from variants), (select count(*) from stock_movements),
        (select count(*) from flash_sales), (select count(*) from flash_sale_items), (select count(*) from vouchers), (select count(*) from banners),
        (select count(*) from categories), (select count(*) from brands), (select count(*) from staff), (select count(*) from staff_sessions),
        (select count(*) from notifications), (select count(*) from points_ledger), (select count(*) from addresses), (select count(*) from reviews where store_reply is not null),
        (select coalesce(max(updated_at)::text, '') from products), (select coalesce(max(updated_at)::text, '') from variants), (select coalesce(max(updated_at)::text, '') from orders),
        (select coalesce(max(updated_at)::text, '') from settings), (select coalesce(sum(on_hand), 0) from inventory), (select coalesce(sum(points), 0) from customers)
      ) as s`)) as unknown as { s: string }[];
    return rows[0].s;
  }

  beforeAll(async () => {
    sidik = await sidikJari();
  });
  afterAll(async () => {
    sesi.staff = null;
    sesi.customer = null;
    await t.cleanup();
  });

  async function panggilSemua(modul: Record<string, () => Promise<Record<string, unknown>>>, lewati: Set<string>) {
    const hasil: { nama: string; ok: boolean; contoh: string }[] = [];
    for (const [m, load] of Object.entries(modul)) {
      const mod = await load();
      for (const [nama, fn] of Object.entries(mod)) {
        if (typeof fn !== "function" || lewati.has(nama)) continue;
        for (const args of ARGS) {
          let r: unknown;
          let ok: boolean;
          try {
            r = await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
            ok = ditolak(r);
          } catch (e) {
            // Dialihkan ke halaman masuk atau galat validasi sebelum menyentuh data: tetap penolakan.
            ok = /REDIRECT|NOT_FOUND|tidak valid|invalid|Expected|Cannot read|is not iterable|undefined/i.test(e instanceof Error ? e.message : String(e));
            r = e instanceof Error ? e.message : e;
          }
          if (!ok) hasil.push({ nama: `${m}.${nama}(${args.length} arg)`, ok, contoh: JSON.stringify(r)?.slice(0, 120) ?? "" });
        }
      }
    }
    return hasil;
  }

  it("tanpa sesi staf: semua aksi admin menolak dan database tidak berubah", async () => {
    sesi.staff = null;
    const gagal = await panggilSemua(MODUL_ADMIN, PUBLIK);
    expect(gagal).toEqual([]);
    expect(await sidikJari()).toBe(sidik);
  }, 120_000);

  it("staf tanpa izin: semua aksi admin yang butuh izin menolak dan database tidak berubah", async () => {
    sesi.staff = tanpaIzin();
    const gagal = await panggilSemua(MODUL_ADMIN, new Set([...PUBLIK, ...SEMUA_STAF]));
    expect(gagal).toEqual([]);
    expect(await sidikJari()).toBe(sidik);
  }, 120_000);

  it("aksi yang boleh untuk semua staf tidak membocorkan data berizin", async () => {
    sesi.staff = tanpaIzin();
    const { dashboardAction, adminSearchAction } = await import("./actions");
    const d = (await dashboardAction()) as { revenue?: unknown } | null;
    expect(d?.revenue ?? null).toBeNull();
    const s = (await adminSearchAction("a")) as unknown;
    expect(JSON.stringify(s)).not.toMatch(/RONA-\d|"phone"|Rp/);
  });

  it("tanpa sesi pembeli: aksi akun menolak dan database tidak berubah", async () => {
    sesi.staff = null;
    sesi.customer = null;
    const gagal = await panggilSemua(MODUL_PEMBELI, new Set());
    const auth = await import("@/lib/auth/actions");
    for (const nama of AKSI_PEMBELI_AUTH) {
      const fn = (auth as Record<string, unknown>)[nama] as (...a: unknown[]) => Promise<unknown>;
      for (const args of ARGS) {
        const r = await fn(...args).catch((e: unknown) => ({ ok: false, thrown: String(e) }));
        if (!ditolak(r) && !(r && typeof r === "object" && "loggedIn" in r && (r as { loggedIn: boolean }).loggedIn === false)) gagal.push({ nama: `auth.${nama}`, ok: false, contoh: JSON.stringify(r).slice(0, 120) });
      }
    }
    expect(gagal).toEqual([]);
    expect(await sidikJari()).toBe(sidik);
  }, 120_000);

  it("route handler admin: 401 atau 403 tanpa sesi dan tanpa izin", async () => {
    // Asisten Admin terbuka untuk semua staf (tool disaring izin), jadi hanya diuji tanpa sesi.
    const semuaStaf = new Set(["/api/admin/asisten", "/api/admin/asisten/transkripsi"]);
    const routes: [string, () => Promise<Record<string, unknown>>, string][] = [
      ["/api/admin/asisten", () => import("@/app/api/admin/asisten/route"), "POST"],
      ["/api/admin/asisten/transkripsi", () => import("@/app/api/admin/asisten/transkripsi/route"), "POST"],
      ["/api/admin/daftar-ambil", () => import("@/app/api/admin/daftar-ambil/route"), "GET"],
      ["/api/admin/foto", () => import("@/app/api/admin/foto/route"), "POST"],
      ["/api/admin/label?nomor=X", () => import("@/app/api/admin/label/route"), "GET"],
      ["/api/admin/laporan/excel", () => import("@/app/api/admin/laporan/excel/route"), "GET"],
    ];
    for (const staff of [null, tanpaIzin()]) {
      sesi.staff = staff;
      for (const [path, load, method] of routes) {
        if (staff && semuaStaf.has(path)) continue;
        const mod = await load();
        const handler = mod[method] as (r: NextRequest) => Promise<Response>;
        const req = new NextRequest(`http://localhost:3000${path}`, { method, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
        const res = await handler(req);
        expect([401, 403, 404], `${method} ${path} (${staff ? "tanpa izin" : "tanpa sesi"}) menjawab ${res.status}`).toContain(res.status);
      }
    }
    expect(await sidikJari()).toBe(sidik);
  }, 60_000);
});
