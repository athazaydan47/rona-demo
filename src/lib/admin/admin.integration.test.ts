// Panel admin terhadap database lokal: login staf, tabrakan status, transfer, opname, stok masuk, dan IDOR Staf Cabang.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { requestRestockFor } from "@/lib/account/restock";
import { attemptStaffLogin, createStaffSession, LOGIN_FAILED, loadPrincipal, readStaffSession } from "./auth";
import { labelData } from "./labels";
import { changeOrderStatus, listAdminOrders } from "./orders";
import { hashPassword } from "./password";
import type { StaffPrincipal } from "./permissions";
import { createStaff, resetStaffPassword, setStaffActive, updateStaff } from "./staff";
import { receiveStock, stockMatrix, submitOpname, transferStock } from "./stock";

const secret = "rahasia-uji-staf-1234567890";
const MIN = 60_000;

describe.skipIf(!dbUrl)("panel admin (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, inArray } = t;
  const emails: string[] = [];
  const staffIds: number[] = [];
  const refs: string[] = [];
  let owner: StaffPrincipal;
  let dinoyoStaff: StaffPrincipal;
  let gudangStaff: StaffPrincipal;
  let ids = { gudang: 0, dinoyo: 0, sawojajar: 0 };
  let v1 = 0;
  let v2 = 0;

  const principalByEmail = async (email: string) => {
    const [s] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email));
    return (await loadPrincipal(db, s.id))!;
  };

  beforeAll(async () => {
    owner = await principalByEmail("owner@rona.demo");
    dinoyoStaff = await principalByEmail("dinoyo@rona.demo");
    gudangStaff = await principalByEmail("gudang@rona.demo");
    ids = { gudang: await t.location("gudang-online"), dinoyo: await t.location("dinoyo"), sawojajar: await t.location("sawojajar") };
    v1 = (await t.variant("dayu-gel-pencil-liner")).id;
    v2 = (await t.variant("surya-shield-body-lotion-spf-30")).id;
    for (const v of [v1, v2]) for (const l of Object.values(ids)) await t.setStock(v, l, 20);
  });

  afterAll(async () => {
    const all = [...refs, ...t.orders];
    if (all.length) {
      await db.delete(schema.stockMovements).where(inArray(schema.stockMovements.reference, all));
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.objectId, all));
    }
    if (emails.length) {
      await db.delete(schema.staffLoginAttempts).where(inArray(schema.staffLoginAttempts.email, emails));
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.objectId, emails));
    }
    if (staffIds.length) {
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.staffId, staffIds));
      await db.delete(schema.staff).where(inArray(schema.staff.id, staffIds));
    }
    await t.cleanup();
  });

  async function newStaff(role: "owner" | "staf_cabang" | "gudang" | "admin_online", locationIds: number[] = []) {
    const email = `uji-${Math.random().toString(36).slice(2, 10)}@rona.test`;
    emails.push(email);
    const r = await createStaff(db, owner, { name: "Staf Uji", email, roleSlug: role, locationIds, grants: [], revokes: [], password: "kata-sandi-uji-123" });
    if (!r.ok) throw new Error(r.message);
    staffIds.push(r.id);
    return { id: r.id, email };
  }

  describe("login staf", () => {
    it("5 kali gagal mengunci sementara 15 menit, pesan tidak membocorkan email terdaftar", async () => {
      const s = await newStaff("gudang");
      const T0 = new Date("2026-10-14T02:00:00Z");
      const ghost = `uji-hantu-${Date.now()}@rona.test`;
      emails.push(ghost);
      for (let i = 0; i < 5; i++) {
        const a = await attemptStaffLogin(db, { email: s.email, password: "salah", secret, now: new Date(T0.getTime() + i * 1000) });
        const b = await attemptStaffLogin(db, { email: ghost, password: "salah", secret, now: new Date(T0.getTime() + i * 1000) });
        expect(a).toEqual({ ok: false, message: LOGIN_FAILED });
        expect(b).toEqual(a);
      }
      const locked = await attemptStaffLogin(db, { email: s.email, password: "kata-sandi-uji-123", secret, now: new Date(T0.getTime() + 10_000) });
      expect(locked).toMatchObject({ ok: false, locked: true });
      const lockedGhost = await attemptStaffLogin(db, { email: ghost, password: "x", secret, now: new Date(T0.getTime() + 10_000) });
      expect(lockedGhost).toMatchObject({ ok: false, locked: true });
      const later = await attemptStaffLogin(db, { email: s.email, password: "kata-sandi-uji-123", secret, now: new Date(T0.getTime() + 16 * MIN) });
      expect(later.ok).toBe(true);
      // Keberhasilan mengosongkan hitungan gagal.
      const again = await attemptStaffLogin(db, { email: s.email, password: "salah", secret, now: new Date(T0.getTime() + 17 * MIN) });
      expect(again).toEqual({ ok: false, message: LOGIN_FAILED });
      const logs = await db.select({ action: schema.auditLogs.action }).from(schema.auditLogs).where(eq(schema.auditLogs.objectId, s.email));
      expect(logs.filter((l) => l.action === "staf.masuk_gagal").length).toBeGreaterThanOrEqual(5);
    });

    it("batas per IP berlaku lintas email", async () => {
      const T0 = new Date("2026-10-14T05:00:00Z");
      const ip = `10.9.${Math.floor(Math.random() * 250)}.1`;
      for (let i = 0; i < 20; i++) {
        const e = `uji-ip-${i}-${Date.now()}@rona.test`;
        emails.push(e);
        await attemptStaffLogin(db, { email: e, password: "x", ip, secret, now: new Date(T0.getTime() + i * 1000) });
      }
      const e = `uji-ip-akhir-${Date.now()}@rona.test`;
      emails.push(e);
      expect(await attemptStaffLogin(db, { email: e, password: "x", ip, secret, now: new Date(T0.getTime() + 30_000) })).toMatchObject({ locked: true });
    });

    it("sesi 12 jam, dan menonaktifkan akun mencabut sesinya", async () => {
      const s = await newStaff("gudang");
      const T0 = new Date();
      const sess = await createStaffSession(db, s.id, T0);
      expect(await readStaffSession(db, sess.token, new Date(T0.getTime() + 11 * 60 * MIN))).toMatchObject({ id: s.id });
      expect(await readStaffSession(db, sess.token, new Date(T0.getTime() + 12 * 60 * MIN + 1000))).toBeNull();
      const sess2 = await createStaffSession(db, s.id, T0);
      expect((await setStaffActive(db, owner, s.id, false, { demoMode: false })).ok).toBe(true);
      expect(await readStaffSession(db, sess2.token, new Date(T0.getTime() + MIN))).toBeNull();
      expect(await attemptStaffLogin(db, { email: s.email, password: "kata-sandi-uji-123", secret, now: new Date(T0.getTime() + 2 * MIN) })).toMatchObject({ ok: false });
    });

    it("akun demo terkunci saat mode demo; staf biasa bisa diubah", async () => {
      const demoOwner = await principalByEmail("owner@rona.demo");
      expect(await setStaffActive(db, owner, dinoyoStaff.id, false, { demoMode: true })).toMatchObject({ ok: false });
      expect(await resetStaffPassword(db, owner, dinoyoStaff.id, "sandi-baru-123456", { demoMode: true })).toMatchObject({ ok: false });
      expect(await updateStaff(db, owner, demoOwner.id, { name: "Owner Demo", email: "owner@rona.demo", roleSlug: "gudang", locationIds: [], grants: [], revokes: [] }, { demoMode: true })).toMatchObject({ ok: false });
      const s = await newStaff("staf_cabang", [ids.dinoyo]);
      expect(await updateStaff(db, owner, s.id, { name: "Staf Uji Dua", email: s.email, roleSlug: "staf_cabang", locationIds: [ids.sawojajar], grants: ["stok.masuk"], revokes: ["stok.opname"] }, { demoMode: true })).toMatchObject({ ok: true });
      const p = (await loadPrincipal(db, s.id))!;
      expect(p).toMatchObject({ locationIds: [ids.sawojajar], grants: ["stok.masuk"], revokes: ["stok.opname"] });
      expect(await createStaff(db, owner, { name: "Tanpa Lokasi", email: `uji-x-${Date.now()}@rona.test`, roleSlug: "staf_cabang", locationIds: [], grants: [], revokes: [], password: "kata-sandi-uji-123" })).toMatchObject({ ok: false, field: "locations" });
      expect(await createStaff(db, dinoyoStaff, { name: "Ilegal", email: `uji-y-${Date.now()}@rona.test`, roleSlug: "owner", locationIds: [], grants: [], revokes: [], password: "kata-sandi-uji-123" })).toMatchObject({ ok: false });
      expect(await hashPassword("abc")).not.toContain("abc");
    });
  });

  describe("pesanan", () => {
    it("perubahan dengan status asal yang sudah berubah ditolak; dua staf bersamaan hanya satu menang", async () => {
      const c = await t.customer();
      const o = await t.order({ items: [{ variantId: v1, quantity: 1 }], buyer: { name: c.name, phone: c.phone, customerId: c.id } });
      await t.pay(o.orderId);
      const [a, b] = await Promise.all([
        changeOrderStatus(db, owner, { number: o.number, from: "dibayar", to: "diproses" }),
        changeOrderStatus(db, owner, { number: o.number, from: "dibayar", to: "diproses" }),
      ]);
      expect([a, b].filter((r) => r.ok)).toHaveLength(1);
      expect([a, b].find((r) => !r.ok)).toMatchObject({ code: "tabrakan", message: expect.stringContaining("baru saja diubah oleh staf lain") });
      expect(await changeOrderStatus(db, owner, { number: o.number, from: "dibayar", to: "dibatalkan", reason: "uji" })).toMatchObject({ ok: false, code: "tabrakan" });
      expect(await changeOrderStatus(db, owner, { number: o.number, from: "diproses", to: "dikirim" })).toMatchObject({ ok: false, code: "isian" });
      expect(await changeOrderStatus(db, owner, { number: o.number, from: "diproses", to: "dikirim", trackingNumber: "JNE0012345678", courierName: "JNE" })).toMatchObject({ ok: true });
      const [ship] = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, o.orderId));
      expect(ship).toMatchObject({ trackingNumber: "JNE0012345678", courier: "JNE" });
      const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.objectId, o.number));
      expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["pesanan.status"]));
    });

    it("IDOR: Staf Dinoyo tidak bisa melihat atau mengubah pesanan lokasi lain", async () => {
      const c = await t.customer();
      const online = await t.order({ items: [{ variantId: v1, quantity: 1 }], buyer: { name: c.name, phone: c.phone, customerId: c.id } });
      await t.pay(online.orderId);
      const atStore = await t.order({ items: [{ variantId: v2, quantity: 1 }], buyer: { name: c.name, phone: c.phone }, over: { method: "ambil", address: null, zone: null, courierCode: null, pickupLocationSlug: "dinoyo", paymentMethod: "bayar_di_toko" } });
      expect(await changeOrderStatus(db, dinoyoStaff, { number: online.number, from: "dibayar", to: "diproses" })).toMatchObject({ ok: false, code: "tidak_ditemukan" });
      const list = await listAdminOrders(db, dinoyoStaff, { pageSize: 200 });
      expect(list.rows.every((r) => r.locationId === ids.dinoyo)).toBe(true);
      expect(list.rows.some((r) => r.number === atStore.number)).toBe(true);
      expect((await labelData(db, dinoyoStaff, [online.number, atStore.number])).denied).toEqual([online.number]);
      // Aksi Staf Cabang di lokasinya: Bayar di Toko lunas dan diambil dalam satu aksi.
      expect(await changeOrderStatus(db, dinoyoStaff, { number: atStore.number, from: "menunggu_pembayaran", to: "selesai" })).toMatchObject({ ok: true, status: "selesai" });
      const history = await db.select({ to: schema.orderStatusHistory.toStatus }).from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, atStore.orderId)).orderBy(schema.orderStatusHistory.id);
      expect(history.map((h) => h.to)).toEqual(["menunggu_pembayaran", "dibayar", "selesai"]);
      // Staf Cabang tidak punya izin batal.
      expect(await changeOrderStatus(db, dinoyoStaff, { number: atStore.number, from: "selesai", to: "diretur", reason: "uji" })).toMatchObject({ ok: true });
    });
  });

  describe("stok", () => {
    it("transfer berhasil: dua gerakan dengan referensi sama, stok pindah", async () => {
      const [g0, s0] = [await t.stock(v1, ids.gudang), await t.stock(v1, ids.sawojajar)];
      const r = await transferStock(db, gudangStaff, { fromId: ids.gudang, toId: ids.sawojajar, lines: [{ variantId: v1, quantity: 3 }, { variantId: v1, quantity: 2 }] });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      refs.push(r.reference);
      expect(await t.stock(v1, ids.gudang)).toMatchObject({ onHand: g0.onHand - 5 });
      expect(await t.stock(v1, ids.sawojajar)).toMatchObject({ onHand: s0.onHand + 5 });
      const mv = await db.select().from(schema.stockMovements).where(eq(schema.stockMovements.reference, r.reference));
      expect(mv.map((m) => [m.type, m.quantity]).sort()).toEqual([["transfer", -5], ["transfer", 5]].sort());
    });

    it("transfer ditolak bila stok kurang (atomik, tidak ada baris yang setengah jalan) atau lokasi sama", async () => {
      const before = [await t.stock(v1, ids.gudang), await t.stock(v2, ids.gudang)];
      const r = await transferStock(db, gudangStaff, { fromId: ids.gudang, toId: ids.dinoyo, lines: [{ variantId: v1, quantity: 1 }, { variantId: v2, quantity: 999 }] });
      expect(r).toMatchObject({ ok: false, issues: [{ variantId: v2 }] });
      expect([await t.stock(v1, ids.gudang), await t.stock(v2, ids.gudang)]).toEqual(before);
      expect(await transferStock(db, gudangStaff, { fromId: ids.gudang, toId: ids.gudang, lines: [{ variantId: v1, quantity: 1 }] })).toMatchObject({ ok: false, message: expect.stringContaining("tidak boleh sama") });
      expect(await transferStock(db, dinoyoStaff, { fromId: ids.gudang, toId: ids.dinoyo, lines: [{ variantId: v1, quantity: 1 }] })).toMatchObject({ ok: false });
    });

    it("opname menulis selisih dan menolak hitungan di bawah jumlah dipesan", async () => {
      await t.setStock(v2, ids.dinoyo, 10);
      const ok = await submitOpname(db, dinoyoStaff, { locationId: ids.dinoyo, counts: [{ variantId: v2, counted: 7 }] });
      expect(ok).toMatchObject({ ok: true, preview: { totalDiff: -3 } });
      if (ok.ok) refs.push(ok.reference);
      expect(await t.stock(v2, ids.dinoyo)).toMatchObject({ onHand: 7 });
      await db.update(schema.inventory).set({ reserved: 5 }).where(t.and(eq(schema.inventory.variantId, v2), eq(schema.inventory.locationId, ids.dinoyo)));
      const bad = await submitOpname(db, dinoyoStaff, { locationId: ids.dinoyo, counts: [{ variantId: v2, counted: 4 }] });
      expect(bad).toMatchObject({ ok: false, message: expect.stringContaining("dipesan") });
      expect(await t.stock(v2, ids.dinoyo)).toMatchObject({ onHand: 7, reserved: 5 });
      await db.update(schema.inventory).set({ reserved: 0 }).where(t.and(eq(schema.inventory.variantId, v2), eq(schema.inventory.locationId, ids.dinoyo)));
      // IDOR: Staf Dinoyo tidak bisa opname atau melihat stok lokasi lain.
      expect(await submitOpname(db, dinoyoStaff, { locationId: ids.sawojajar, counts: [{ variantId: v2, counted: 1 }] })).toMatchObject({ ok: false });
      const m = await stockMatrix(db, dinoyoStaff, { q: "Body Lotion" });
      expect(m.locations.map((l) => l.id)).toEqual([ids.dinoyo]);
    });

    it("stok masuk ke Gudang Online memicu Kabari aku", async () => {
      await t.setStock(v2, ids.gudang, 0);
      const c = await t.customer();
      await requestRestockFor(db, { customerId: c.id, phone: c.phone }, v2);
      expect(await receiveStock(db, dinoyoStaff, { locationId: ids.gudang, lines: [{ variantId: v2, quantity: 5 }] })).toMatchObject({ ok: false });
      const r = await receiveStock(db, gudangStaff, { locationId: ids.gudang, lines: [{ variantId: v2, quantity: 5 }], reference: `SJ-UJI-${Date.now()}` });
      expect(r.ok).toBe(true);
      if (r.ok) refs.push(r.reference);
      const n = await db.select().from(schema.notifications).where(t.and(eq(schema.notifications.customerId, c.id), eq(schema.notifications.kind, "stok_kembali")));
      expect(n).toHaveLength(1);
      expect(await t.stock(v2, ids.gudang)).toMatchObject({ onHand: 5 });
    });
  });
});
