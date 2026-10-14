// Katalog, promo, dan pengaturan admin terhadap database lokal: izin per peran, aturan simpan produk, slot admin menang,
// dan pengaturan yang mengubah hasil. Semua data uji dibersihkan di akhir.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbUrl, integration } from "@/test/integration";
import { loadLiveFlash } from "@/lib/orders/pricing-loader";
import { loadSettings } from "@/lib/settings/db";
import { loadPrincipal } from "./auth";
import type { StaffPrincipal } from "./permissions";
import { deleteProduct, duplicateProduct, getProductForEdit, saveProduct, setProductStatus, type ProductInput } from "./products";
import { createFlashSlot, saveFlashItem, saveVoucher, setVoucherActive } from "./promo";
import { saveSettings } from "./settings";
import { lowStockThreshold } from "./stock";
import { deleteCategory, saveCategory } from "./taxonomy";

const DAY = 86_400_000;

describe.skipIf(!dbUrl)("katalog, promo, dan pengaturan admin (integrasi)", () => {
  const t = integration();
  const { db, schema, eq, inArray } = t;
  let owner: StaffPrincipal;
  let adminOnline: StaffPrincipal;
  let gudang: StaffPrincipal;
  let cabang: StaffPrincipal;
  let brandId = 0;
  let leafId = 0;
  let rootId = 0;
  const productIds: number[] = [];
  const slotIds: number[] = [];
  const voucherIds: number[] = [];
  const categoryIds: number[] = [];
  const autoDisabled: number[] = [];
  const tag = `uji${Date.now().toString(36)}`;
  let settingsBefore: Awaited<ReturnType<typeof loadSettings>>;

  const principal = async (email: string) => {
    const [s] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email));
    return (await loadPrincipal(db, s.id))!;
  };
  const input = (over: Partial<ProductInput> = {}): ProductInput => ({
    name: `Produk Uji ${tag}`,
    slug: `produk-uji-${tag}`,
    brandId,
    categoryId: leafId,
    packaging: "lip_tint",
    status: "aktif",
    variants: [
      { shadeName: "Merah Bata", hex: "#B5523B", undertone: "warm", depth: 4, sku: `UJI-${tag.toUpperCase()}-01`, weightGram: 30, normalPrice: 99_000, salePrice: 89_000, isActive: true },
      { shadeName: "Mawar", hex: "#C7697A", undertone: "cool", depth: 3, sku: `UJI-${tag.toUpperCase()}-02`, weightGram: 30, normalPrice: 99_000, salePrice: 99_000, isActive: true },
    ],
    ...over,
  });

  beforeAll(async () => {
    [owner, adminOnline, gudang, cabang] = await Promise.all(["owner@rona.demo", "admin@rona.demo", "gudang@rona.demo", "dinoyo@rona.demo"].map(principal));
    const [b] = await db.select({ id: schema.brands.id }).from(schema.brands).limit(1);
    brandId = b.id;
    const [leaf] = await db.select({ id: schema.categories.id, parentId: schema.categories.parentId }).from(schema.categories).where(t.isNotNull(schema.categories.parentId)).limit(1);
    leafId = leaf.id;
    rootId = leaf.parentId!;
    settingsBefore = await loadSettings(db);
  });

  afterAll(async () => {
    if (productIds.length) {
      const vids = (await db.select({ id: schema.variants.id }).from(schema.variants).where(inArray(schema.variants.productId, productIds))).map((v) => v.id);
      if (vids.length) {
        await db.delete(schema.flashSaleItems).where(inArray(schema.flashSaleItems.variantId, vids));
        await db.delete(schema.stockMovements).where(inArray(schema.stockMovements.variantId, vids));
        await db.delete(schema.inventory).where(inArray(schema.inventory.variantId, vids));
      }
      await db.delete(schema.products).where(inArray(schema.products.id, productIds));
    }
    if (slotIds.length) {
      await db.delete(schema.flashSaleItems).where(inArray(schema.flashSaleItems.flashSaleId, slotIds));
      await db.delete(schema.flashSales).where(inArray(schema.flashSales.id, slotIds));
    }
    // Slot otomatis yang dinonaktifkan uji ini diaktifkan kembali.
    if (autoDisabled.length) await db.update(schema.flashSales).set({ isActive: true }).where(inArray(schema.flashSales.id, autoDisabled));
    if (voucherIds.length) await db.delete(schema.vouchers).where(inArray(schema.vouchers.id, voucherIds));
    if (categoryIds.length) await db.delete(schema.categories).where(inArray(schema.categories.id, categoryIds));
    await saveSettings(db, owner, settingsBefore);
    await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.staffId, [owner.id, adminOnline.id]));
    await t.cleanup();
  });

  it("izin halaman baru: Gudang dan Staf Cabang ditolak, Admin Online boleh katalog dan promo tapi bukan pengaturan", async () => {
    for (const s of [gudang, cabang]) {
      expect((await saveProduct(db, s, input(), null)).ok).toBe(false);
      expect((await saveCategory(db, s, { name: `Kategori ${tag}`, parentId: rootId })).ok).toBe(false);
      expect((await createFlashSlot(db, s, { name: "X", startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + 3_600_000) })).ok).toBe(false);
      expect((await saveSettings(db, s, settingsBefore)).ok).toBe(false);
      expect((await duplicateProduct(db, s, 1)).ok).toBe(false);
    }
    const r = await saveSettings(db, adminOnline, { ...settingsBefore, lowStock: 9 });
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/izin/) });
  });

  it("Admin Online membuat produk 2 shade: baris stok 0 di semua lokasi, SKU unik, harga jual tidak di atas normal", async () => {
    const r = await saveProduct(db, adminOnline, input(), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    productIds.push(r.id);
    const found = (await getProductForEdit(db, r.id))!;
    expect(found.variants).toHaveLength(2);
    const inv = await db.select().from(schema.inventory).where(inArray(schema.inventory.variantId, found.variants.map((v) => v.id)));
    const locations = await db.select({ id: schema.locations.id }).from(schema.locations);
    expect(inv).toHaveLength(2 * locations.length);
    expect(inv.every((i) => i.onHand === 0 && i.reserved === 0)).toBe(true);

    // SKU dipakai produk lain: ditolak.
    const [other] = await db.select({ sku: schema.variants.sku }).from(schema.variants).where(t.sql`${schema.variants.productId} <> ${r.id}`).limit(1);
    const dup = await saveProduct(db, adminOnline, input({ slug: `produk-uji-${tag}-b`, name: `Produk Uji B ${tag}`, variants: [{ ...input().variants[0], sku: other.sku }] }), null);
    expect(dup).toMatchObject({ ok: false, message: expect.stringMatching(/SKU/) });
    const pricey = await saveProduct(db, adminOnline, input({ variants: [{ ...input().variants[0], salePrice: 120_000 }] }), r.id);
    expect(pricey.ok).toBe(false);

    // Perubahan harga dan status tercatat di log dengan data sebelum dan sesudah.
    await saveProduct(db, adminOnline, input({ variants: [{ ...input().variants[0], id: found.variants[0].id, salePrice: 79_000 }, { ...input().variants[1], id: found.variants[1].id }] }), r.id);
    await setProductStatus(db, adminOnline, r.id, "arsip");
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.objectId, `produk-uji-${tag}`));
    expect(logs.some((l) => JSON.stringify(l.after).includes("79000"))).toBe(true);
    expect(logs.some((l) => JSON.stringify(l.after).includes("arsip"))).toBe(true);
  });

  it("produk yang sudah pernah dipesan tidak bisa dihapus, hanya diarsipkan; duplikat menjadi draf", async () => {
    const [ordered] = await db.selectDistinct({ productId: schema.variants.productId }).from(schema.orderItems).innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id)).limit(1);
    const del = await deleteProduct(db, owner, ordered.productId);
    expect(del).toMatchObject({ ok: false, message: expect.stringMatching(/Arsipkan/) });
    const copy = await duplicateProduct(db, adminOnline, ordered.productId);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    productIds.push(copy.id);
    const c = (await getProductForEdit(db, copy.id))!;
    expect(c.product.status).toBe("draf");
    expect(c.product.slug).toMatch(/-salinan/);
    // Produk tanpa pesanan boleh dihapus.
    expect((await deleteProduct(db, adminOnline, copy.id)).ok).toBe(true);
    productIds.splice(productIds.indexOf(copy.id), 1);
  });

  it("kategori: nama mirip diperingatkan, Tetap simpan tetap bisa; kategori berisi produk tidak bisa dihapus", async () => {
    // Induk yang masih punya ruang (kurang dari 8 sub kategori).
    const [roomy] = (await db.execute(t.sql`select parent_id as id from categories where parent_id is not null group by parent_id having count(*) < 8 order by parent_id limit 1`)) as unknown as { id: number }[];
    const [existing] = await db.select({ name: schema.categories.name }).from(schema.categories).where(eq(schema.categories.parentId, roomy.id)).limit(1);
    const typo = existing.name.length > 4 ? existing.name.slice(0, -2) + existing.name.slice(-1) + existing.name.slice(-2, -1) : `${existing.name}x`;
    const warn = await saveCategory(db, adminOnline, { name: typo, parentId: roomy.id });
    expect(warn.ok).toBe(false);
    if (!warn.ok) expect(warn.similar?.map((h) => h.name)).toContain(existing.name);
    const forced = await saveCategory(db, adminOnline, { name: typo, parentId: roomy.id, force: true });
    expect(forced.ok ? "ok" : forced.message).toBe("ok");
    if (forced.ok && forced.id) categoryIds.push(forced.id);
    const del = await deleteCategory(db, adminOnline, leafId);
    expect(del).toMatchObject({ ok: false, message: expect.stringMatching(/produk/i) });
  });

  it("slot admin menang: slot otomatis yang bertabrakan dinonaktifkan dan harga flash admin yang dipakai", async () => {
    const [auto] = await db.select().from(schema.flashSales).where(t.and(eq(schema.flashSales.source, "otomatis"), eq(schema.flashSales.isActive, true), t.sql`${schema.flashSales.startsAt} > now()`)).orderBy(schema.flashSales.startsAt).limit(1);
    expect(auto).toBeTruthy();
    const [autoItem] = await db.select().from(schema.flashSaleItems).where(eq(schema.flashSaleItems.flashSaleId, auto.id)).limit(1);
    const slot = await createFlashSlot(db, owner, { name: "Flash Uji Admin", startsAt: auto.startsAt, endsAt: auto.endsAt });
    expect(slot.ok).toBe(true);
    if (!slot.ok) return;
    slotIds.push(slot.id!);
    const [after] = await db.select({ isActive: schema.flashSales.isActive }).from(schema.flashSales).where(eq(schema.flashSales.id, auto.id));
    expect(after.isActive).toBe(false);
    autoDisabled.push(auto.id);
    // Slot admin kedua yang bertabrakan ditolak.
    expect((await createFlashSlot(db, owner, { name: "Flash Uji Dobel", startsAt: auto.startsAt, endsAt: auto.endsAt })).ok).toBe(false);

    const [v] = await db.select().from(schema.variants).where(eq(schema.variants.id, autoItem.variantId));
    const price = autoItem.flashPrice - 1000;
    const item = await saveFlashItem(db, owner, { slotId: slot.id!, variantId: v.id, flashPrice: price, quota: 5, maxPerCustomer: 1 });
    expect(item.ok).toBe(true);
    // Saat slot berjalan, harga flash dari slot admin yang terbaca. Slot otomatis diaktifkan lagi untuk menguji urutan.
    await db.update(schema.flashSales).set({ isActive: true }).where(eq(schema.flashSales.id, auto.id));
    const live = await loadLiveFlash(db, [v.id], { customerId: null, phone: null }, new Date(auto.startsAt.getTime() + 60_000));
    expect(live.get(v.id)?.flashPrice).toBe(price);

    // Harga flash harus di bawah harga efektif.
    const bad = await saveFlashItem(db, owner, { slotId: slot.id!, variantId: v.id, flashPrice: v.salePrice, quota: 5, maxPerCustomer: 1 });
    expect(bad).toMatchObject({ ok: false, message: expect.stringMatching(/harga efektif/) });
  });

  it("slot yang sedang berjalan butuh konfirmasi sebelum diubah, dan perubahannya dicatat", async () => {
    // Jendela jauh di depan supaya tidak bertabrakan dengan slot lain; jam uji diatur lewat opsi now.
    const start = new Date(Math.ceil((Date.now() + 20 * DAY) / 3_600_000) * 3_600_000);
    const now = new Date(start.getTime() - 60_000);
    const slot = await createFlashSlot(db, owner, { name: "Flash Uji Jalan", startsAt: start, endsAt: new Date(start.getTime() + 3_600_000) }, { now });
    expect(slot.ok ? "ok" : slot.message).toBe("ok");
    if (!slot.ok) return;
    slotIds.push(slot.id!);
    const [v] = await db.select().from(schema.variants).where(eq(schema.variants.id, (await getProductForEdit(db, productIds[0]))!.variants[0].id));
    const later = new Date(start.getTime() + 5 * 60_000);
    const first = await saveFlashItem(db, owner, { slotId: slot.id!, variantId: v.id, flashPrice: 50_000, quota: 3, maxPerCustomer: 1 }, { now: later });
    expect(first).toMatchObject({ ok: false, needsConfirm: true });
    const confirmed = await saveFlashItem(db, owner, { slotId: slot.id!, variantId: v.id, flashPrice: 50_000, quota: 3, maxPerCustomer: 1, confirmRunning: true }, { now: later });
    expect(confirmed.ok).toBe(true);
    // Stok online 0, jadi ada peringatan kuota.
    if (confirmed.ok) expect(confirmed.warnings?.[0]).toMatch(/stok online/);
    const [log] = await db.select().from(schema.auditLogs).where(t.and(eq(schema.auditLogs.action, "promo.flash_item"), eq(schema.auditLogs.objectId, String(slot.id))));
    expect(log.summary).toMatch(/sedang berjalan/);
  });

  it("voucher: kode unik, nonaktif tanpa menghapus riwayat", async () => {
    const code = `UJI${tag.toUpperCase()}`.slice(0, 20);
    const form = { code, title: "Voucher uji", type: "nominal" as const, value: 10_000, minSpend: 50_000, startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY), quota: 10, quotaPerCustomer: 1, stackWithFlash: false, isActive: true };
    const r = await saveVoucher(db, adminOnline, form, null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    voucherIds.push(r.id!);
    expect((await saveVoucher(db, adminOnline, form, null)).ok).toBe(false);
    expect((await setVoucherActive(db, adminOnline, r.id!, false)).ok).toBe(true);
    const [v] = await db.select().from(schema.vouchers).where(eq(schema.vouchers.id, r.id!));
    expect(v.isActive).toBe(false);
  });

  it("pengaturan: ambang stok menipis dan gratis ongkir tersimpan, dicatat, dan terbaca logika", async () => {
    const r = await saveSettings(db, owner, { ...settingsBefore, lowStock: 12, freeShipping: { ...settingsBefore.freeShipping, threshold: 99_000 } });
    expect(r).toMatchObject({ ok: true, changed: 2 });
    expect(await lowStockThreshold(db)).toBe(12);
    expect((await loadSettings(db)).freeShipping.threshold).toBe(99_000);
    const bad = await saveSettings(db, owner, { ...settingsBefore, cutoff: { ...settingsBefore.cutoff, ship: "31.00" } });
    expect(bad.ok).toBe(false);
    const [log] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "pengaturan.ubah")).orderBy(t.sql`${schema.auditLogs.id} desc`).limit(1);
    expect(log.before).toMatchObject({ "stok.ambangMenipis": settingsBefore.lowStock });
    expect(log.after).toMatchObject({ "stok.ambangMenipis": 12, "ongkir.gratisMinimal": 99_000 });
  });
});
