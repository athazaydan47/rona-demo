// Seed data demo deterministik, tanpa efek samping saat diimpor (dipakai CLI dan reset harian demo di runtime).
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import { brandSeed } from "./brands";
import { categorySeed } from "./categories";
import { articleSeed, bannerSeed, roleSeed, settingsSeed, staffSeed, voucherSeed } from "./content";
import { locationSeed } from "./locations";
import { productSeed } from "./products";
import { createRng } from "./random";
import { reviewTemplatesFor, reviewerNames, skinTypesForReview } from "./reviews";
import { detailTemplate, kindText } from "./text";
import { slugify } from "../../lib/utils";
import { roundToPromo } from "../../lib/pricing";
import { toWibParts, wibDate } from "../../lib/format";
import type { AnyDb } from "../../lib/db-types";
import { hashPassword } from "../../lib/admin/password";
import { seedDemoBuyer } from "./demo-buyer";
import { SEED_VERSION } from "./version";
import { generateHistory, HISTORY_DAYS, type HistoryVariant } from "./history";
import { insertHistory } from "./history-insert";
import { SETTING_KEYS } from "../../lib/settings";

const SEED = 20261013;
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD ?? "demo1234";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function brandCode(slug: string) {
  return slug
    .split("-")
    .map((s) => s.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 4);
}

export type SeedSummary = { brands: number; categories: number; locations: number; products: number; variants: number; inventory: number; reviews: number; demoOrders: number; historyOrders: number; historyCustomers: number };

export { SEED_VERSION };

// Isi seluruh data demo ke database yang sudah dimigrasi dan kosong. Dipakai db:reset, db:seed, dan reset harian demo.
// Deterministik: semua nilai acak berasal dari RNG bersemai tetap; tanggal relatif terhadap `now`.
export async function seedAll(db: AnyDb, now: Date): Promise<SeedSummary> {
  const rng = createRng(SEED);
  const today = toWibParts(now);
  const daysAgo = (d: number, hour = 10) => new Date(now.getTime() - d * 86400000 - (10 - hour) * 3600000);
  {
    // 1. Merek
    const brandRows = await db
      .insert(schema.brands)
      .values(brandSeed.map((b, i) => ({ ...b, sortOrder: i })))
      .returning({ id: schema.brands.id, slug: schema.brands.slug, name: schema.brands.name, color: schema.brands.color });
    const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));

    // 2. Kategori (2 tingkat)
    const parentRows = await db
      .insert(schema.categories)
      .values(categorySeed.map((c, i) => ({ name: c.name, slug: c.slug, sortOrder: i, description: c.description })))
      .returning({ id: schema.categories.id, slug: schema.categories.slug, name: schema.categories.name });
    const parentBySlug = new Map(parentRows.map((p) => [p.slug, p]));
    const childValues = categorySeed.flatMap((c) =>
      c.children.map((name, i) => ({
        name,
        slug: slugify(name),
        parentId: parentBySlug.get(c.slug)!.id,
        sortOrder: i,
      })),
    );
    const childRows = await db
      .insert(schema.categories)
      .values(childValues)
      .returning({ id: schema.categories.id, name: schema.categories.name, parentId: schema.categories.parentId });
    const childByName = new Map(childRows.map((c) => [c.name, c]));
    const parentById = new Map(parentRows.map((p) => [p.id, p]));

    // 3. Lokasi
    const locationRows = await db
      .insert(schema.locations)
      .values(locationSeed)
      .returning({ id: schema.locations.id, slug: schema.locations.slug, type: schema.locations.type });
    const locationBySlug = new Map(locationRows.map((l) => [l.slug, l]));

    // 4. Produk dan varian
    const productIds: number[] = [];
    const variantRows: { id: number; productId: number; salePrice: number; shadeName: string }[] = [];
    const productMeta = new Map<number, { kind: (typeof productSeed)[number]["kind"]; popularity: number; slug: string }>();
    const productIdBySlugEarly = new Map<string, number>();
    const seenSlugs = new Set<string>();

    // Produk dan varian disisipkan massal (dua kueri) supaya reset di serverless cepat. Urutan pemanggilan RNG sama
    // dengan versi per baris sebelumnya, jadi data tetap identik.
    const productValues: (typeof schema.products.$inferInsert)[] = [];
    const pendingVariants: { slug: string; values: Omit<typeof schema.variants.$inferInsert, "productId">[] }[] = [];
    for (const [pi, p] of productSeed.entries()) {
      const brand = brandBySlug.get(p.brand);
      const child = childByName.get(p.category);
      if (!brand || !child) throw new Error(`Seed produk "${p.name}": merek atau sub kategori tidak ditemukan.`);
      const parent = parentById.get(child.parentId!)!;
      const slug = slugify(p.name);
      if (seenSlugs.has(slug)) throw new Error(`Slug produk ganda: ${slug}`);
      seenSlugs.add(slug);

      const text = kindText[p.kind];
      const searchText = [p.name, brand.name, child.name, parent.name, ...p.variants.map((v) => v.name), ...(p.active ?? [])].join(" ");
      // Jumlah terjual dihitung dari riwayat penjualan; panggilan RNG dipertahankan supaya urutan acak tetap.
      rng.int(15, 40);
      const soldCount = 0;
      const publishedAt = daysAgo(p.isNew ? rng.int(3, 20) : rng.int(30, 240));

      productValues.push({
        name: p.name,
        slug,
        brandId: brand.id,
        categoryId: child.id,
        shortDescription: p.short,
        benefits: p.benefits,
        ingredients: text.ingredients(p.active),
        howToUse: `${text.howToUse} ${detailTemplate(p.kind)}`,
        activeIngredients: p.active,
        skinTypes: p.skinTypes,
        skinConcerns: p.concerns ?? [],
        finish: p.finish ?? null,
        spf: p.spf ?? null,
        bpom: `NA18${(230000000 + pi * 1237).toString().padStart(9, "0")}`,
        netto: p.netto,
        packaging: p.packaging,
        status: "aktif",
        soldCount,
        isNew: p.isNew ?? false,
        isBestseller: p.isBestseller ?? false,
        searchText,
        seoTitle: `${p.name} | Rona Beauty`,
        seoDescription: p.short,
        publishedAt,
        createdAt: publishedAt,
      });

      // Sekitar 1 dari 8 produk punya harga promo aktif.
      const hasPromo = rng.chance(0.14);
      const code = brandCode(p.brand);
      pendingVariants.push({
        slug,
        values: p.variants.map((v, vi) => {
          const salePrice = p.salePrice + (v.priceDelta ?? 0);
          const normalPrice = p.normalPrice + (v.priceDelta ?? 0);
          const promoPrice = hasPromo ? roundToPromo(salePrice * 0.88) : null;
          return {
            shadeName: v.name,
            shadeSlug: slugify(v.name),
            hex: v.hex,
            undertone: v.undertone ?? null,
            depth: v.depth ?? null,
            sku: `${code}-${(pi + 1).toString().padStart(3, "0")}-${(vi + 1).toString().padStart(2, "0")}`,
            barcode: `899${(1000000000 + pi * 1000 + vi).toString()}`,
            weightGram: v.weightGram ?? p.weightGram,
            normalPrice,
            salePrice,
            promoPrice,
            promoStartsAt: hasPromo ? daysAgo(7) : null,
            promoEndsAt: hasPromo ? new Date(now.getTime() + 30 * 86400000) : null,
            isActive: true,
            sortOrder: vi,
          };
        }),
      });
    }
    const insertedProducts = (await db.insert(schema.products).values(productValues).returning({ id: schema.products.id, slug: schema.products.slug })).sort((a, b) => a.id - b.id);
    const productIdBySlugMap = new Map(insertedProducts.map((r) => [r.slug, r.id]));
    for (const [pi, p] of productSeed.entries()) {
      const id = productIdBySlugMap.get(slugify(p.name))!;
      productIds.push(id);
      productMeta.set(id, { kind: p.kind, popularity: p.popularity, slug: slugify(p.name) });
      productIdBySlugEarly.set(slugify(p.name), id);
      void pi;
    }
    const variantInsert = pendingVariants.flatMap((pv) => pv.values.map((v) => ({ ...v, productId: productIdBySlugMap.get(pv.slug)! })));
    const insertedVariants = (await db
      .insert(schema.variants)
      .values(variantInsert)
      .returning({ id: schema.variants.id, productId: schema.variants.productId, salePrice: schema.variants.salePrice, shadeName: schema.variants.shadeName })).sort((a, b) => a.id - b.id);
    variantRows.push(...insertedVariants);

    // 5. Stok akhir per varian per lokasi (disisipkan setelah riwayat penjualan, yang menulis stok awal di hari pertama).
    const inventoryValues: { variantId: number; locationId: number; onHand: number }[] = [];
    // Satu shade cushion Pualam Velvet Matte sengaja habis di semua lokasi untuk memamerkan "Kabari aku".
    const cushionId = productIdBySlugEarly.get("pualam-velvet-matte-cushion-spf-50");
    const soldOutVariant = variantRows.find((v) => v.productId === cushionId && v.shadeName === "10N Kayu Manis");
    for (const v of variantRows) {
      for (const loc of locationRows) {
        let onHand: number;
        const roll = rng.next();
        if (soldOutVariant && v.id === soldOutVariant.id) onHand = 0;
        else if (loc.type === "gudang") onHand = roll < 0.06 ? 0 : roll < 0.14 ? rng.int(1, 4) : rng.int(8, 60);
        else onHand = roll < 0.18 ? 0 : roll < 0.32 ? rng.int(1, 4) : rng.int(5, 18);
        inventoryValues.push({ variantId: v.id, locationId: loc.id, onHand });
      }
    }

    // 6. Ulasan demo
    const variantsByProduct = new Map<number, typeof variantRows>();
    for (const v of variantRows) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }
    const reviewValues: (typeof schema.reviews.$inferInsert)[] = [];
    const ratingAgg = new Map<number, { sum: number; count: number }>();
    for (const productId of productIds) {
      const meta = productMeta.get(productId)!;
      const n = meta.popularity >= 8 ? rng.int(3, 5) : meta.popularity >= 6 ? rng.int(1, 2) : rng.int(0, 1);
      const templates = reviewTemplatesFor(meta.kind);
      const pvariants = variantsByProduct.get(productId)!;
      for (let i = 0; i < n; i++) {
        const t = rng.pick(templates);
        const variant = rng.pick(pvariants);
        const skin = rng.pick(skinTypesForReview);
        const body = t.text.replace(/\{shade\}/g, variant.shadeName).replace(/\{skin\}/g, skin);
        reviewValues.push({
          productId,
          variantId: variant.id,
          authorName: rng.pick(reviewerNames),
          rating: t.rating,
          body,
          skinType: skin,
          isVerified: true,
          status: "tampil",
          storeReply: rng.chance(0.15) ? "Terima kasih sudah berbagi. Senang produknya cocok di kamu!" : null,
          createdAt: daysAgo(rng.int(1, 120), rng.int(8, 21)),
        });
        const agg = ratingAgg.get(productId) ?? { sum: 0, count: 0 };
        agg.sum += t.rating;
        agg.count += 1;
        ratingAgg.set(productId, agg);
      }
    }
    for (const part of chunk(reviewValues, 200)) await db.insert(schema.reviews).values(part);
    // Rating rata-rata dan jumlah ulasan per produk dalam satu kueri.
    const ratingRows = [...ratingAgg.entries()].map(([productId, agg]) => sql`(${productId}::int, ${Math.round((agg.sum / agg.count) * 10) / 10}::float8, ${agg.count}::int)`);
    if (ratingRows.length) {
      await db.execute(sql`update products set rating_avg = v.avg, review_count = v.cnt from (values ${sql.join(ratingRows, sql`, `)}) as v(id, avg, cnt) where products.id = v.id`);
    }

    // 7. Flash sale: slot 12.00 sampai 14.00 dan 20.00 sampai 22.00 WIB. Slot 90 hari terakhir sampai hari ini dibuat
    // bersama riwayat penjualan (kuota terjual sesuai pesanan); di sini slot 1 sampai 3 hari ke depan.
    const slots = [
      { name: "Flash Sale Siang", start: [12, 0], end: [14, 0] },
      { name: "Flash Sale Malam", start: [20, 0], end: [22, 0] },
    ] as const;
    const bestsellerVariants = variantRows.filter((v) => productMeta.get(v.productId)!.popularity >= 8);
    const flashPool = rng.shuffle(bestsellerVariants);
    const saleSpecs: { dayOffset: number; si: number; value: typeof schema.flashSales.$inferInsert }[] = [];
    for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
      const dayParts = toWibParts(new Date(now.getTime() + dayOffset * 86400000));
      for (const [si, slot] of slots.entries()) {
        saleSpecs.push({
          dayOffset,
          si,
          value: {
            name: slot.name,
            startsAt: wibDate(dayParts.year, dayParts.month, dayParts.day, slot.start[0], slot.start[1]),
            endsAt: wibDate(dayParts.year, dayParts.month, dayParts.day, slot.end[0], slot.end[1]),
            isActive: true,
            source: "otomatis",
          },
        });
      }
    }
    const saleRows = (await db.insert(schema.flashSales).values(saleSpecs.map((x) => x.value)).returning({ id: schema.flashSales.id })).sort((a, b) => a.id - b.id);
    const flashItems: (typeof schema.flashSaleItems.$inferInsert)[] = [];
    for (const [i, spec] of saleSpecs.entries()) {
      const offset = (((HISTORY_DAYS + spec.dayOffset) * 2 + spec.si) * 6) % Math.max(1, flashPool.length - 6);
      const picks = flashPool.slice(offset, offset + 6);
      for (const v of picks) flashItems.push({ flashSaleId: saleRows[i].id, variantId: v.id, flashPrice: roundToPromo(v.salePrice * 0.78), quota: rng.int(20, 40), sold: 0, maxPerCustomer: 2 });
    }
    await db.insert(schema.flashSaleItems).values(flashItems);

    // 8. Voucher
    // Berlaku sejak sebelum awal riwayat penjualan sampai 90 hari ke depan (relatif terhadap waktu reset).
    const monthStart = wibDate(today.year, today.month, today.day - 100);
    const voucherEnd = wibDate(today.year, today.month, today.day + 90);
    const voucherRows = await db.insert(schema.vouchers).values(
      voucherSeed.map((v) => {
        const scope: schema.VoucherScope = {};
        if ("brandSlugs" in v.scope && Array.isArray(v.scope.brandSlugs)) {
          scope.brandIds = v.scope.brandSlugs.map((s) => brandBySlug.get(s)!.id);
        }
        return {
          code: v.code,
          title: v.title,
          description: v.description,
          type: v.type,
          value: v.value,
          maxDiscount: v.maxDiscount,
          minSpend: v.minSpend,
          startsAt: monthStart,
          endsAt: voucherEnd,
          quota: v.quota,
          quotaPerCustomer: v.quotaPerCustomer,
          used: 0,
          scope,
          stackWithFlash: v.stackWithFlash,
          isActive: true,
        };
      }),
    ).returning();

    // 9. Artikel
    const productIdBySlug = new Map([...productMeta.entries()].map(([id, m]) => [m.slug, id]));
    await db.insert(schema.articles).values(
      articleSeed.map((a, i) => {
        const linked = a.products.map((slug) => {
          const id = productIdBySlug.get(slug);
          if (!id) throw new Error(`Artikel "${a.title}" menautkan produk yang tidak ada: ${slug}`);
          return id;
        });
        return {
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          body: a.body,
          author: a.author,
          coverImage: null,
          linkedProductIds: linked,
          publishedAt: daysAgo(10 + i * 9),
        };
      }),
    );

    // 10. Peran, staf, pengaturan, banner
    const roleRows = await db
      .insert(schema.roles)
      .values(roleSeed)
      .returning({ id: schema.roles.id, slug: schema.roles.slug });
    const roleBySlug = new Map(roleRows.map((r) => [r.slug, r.id]));
    // Kata sandi akun demo dari env DEMO_STAFF_PASSWORD, di-hash scrypt dengan salt acak per akun.
    const hashes = await Promise.all(staffSeed.map(() => hashPassword(DEMO_STAFF_PASSWORD)));
    const staffRows = await db
      .insert(schema.staff)
      .values(
        staffSeed.map((s, i) => ({
          name: s.name,
          email: s.email,
          passwordHash: hashes[i],
          roleId: roleBySlug.get(s.role)!,
          locationId: s.locations[0] ? locationBySlug.get(s.locations[0])!.id : null,
          isActive: true,
          createdAt: daysAgo(90 - i),
        })),
      )
      .returning({ id: schema.staff.id, email: schema.staff.email });
    const staffLocationValues = staffSeed.flatMap((s) => s.locations.map((slug) => ({ staffId: staffRows.find((r) => r.email === s.email)!.id, locationId: locationBySlug.get(slug)!.id })));
    if (staffLocationValues.length) await db.insert(schema.staffLocations).values(staffLocationValues);
    await db.insert(schema.settings).values(
      Object.entries({ ...settingsSeed, [SETTING_KEYS.seedVersion]: SEED_VERSION }).map(([key, value]) => ({ key, value: value as unknown as object })),
    );
    await db.insert(schema.banners).values(
      bannerSeed.map((b) => ({ ...b, position: "hero", isActive: true })),
    );

    // 10b. Riwayat penjualan 90 hari: pelanggan, pesanan, pembayaran, buku stok, poin, kuota flash, voucher.
    // Stok awal ditulis sebagai gerakan masuk di hari pertama supaya buku stok sama dengan stok fisik.
    const brandNameById = new Map(brandRows.map((b) => [b.id, b.name]));
    const historyVariants: HistoryVariant[] = insertedVariants.map((v, i) => {
      const spec = variantInsert[i];
      const pIdx = insertedProducts.findIndex((p) => p.id === v.productId);
      const pv = productValues[pIdx];
      const child = childRows.find((c) => c.id === pv.categoryId)!;
      return {
        id: v.id,
        productId: v.productId,
        brandId: pv.brandId,
        categoryId: pv.categoryId,
        parentCategoryId: child.parentId ?? null,
        productName: pv.name,
        shadeName: spec.shadeName,
        brandName: brandNameById.get(pv.brandId) ?? "",
        weightGram: spec.weightGram ?? 100,
        normalPrice: spec.normalPrice,
        salePrice: spec.salePrice,
        promoPrice: spec.promoPrice ?? null,
        promoStartsAt: spec.promoStartsAt ?? null,
        promoEndsAt: spec.promoEndsAt ?? null,
        popularity: productSeed[pIdx].popularity,
      };
    });
    const fullLocations = await db.select({ id: schema.locations.id, slug: schema.locations.slug, type: schema.locations.type, name: schema.locations.name, openingHours: schema.locations.openingHours }).from(schema.locations);
    const history = generateHistory(
      {
        now,
        variants: historyVariants,
        locations: fullLocations,
        vouchers: voucherRows.map((v) => ({ id: v.id, code: v.code, type: v.type, value: v.value, maxDiscount: v.maxDiscount, minSpend: v.minSpend, startsAt: v.startsAt, endsAt: v.endsAt, quota: v.quota, quotaPerCustomer: v.quotaPerCustomer, scope: v.scope ?? {}, stackWithFlash: v.stackWithFlash, isActive: v.isActive })),
        flashPool: flashPool.map((v) => v.id),
        finalStock: new Map(inventoryValues.map((i) => [`${i.variantId}:${i.locationId}`, i.onHand])),
        flashSlotsToday: 0,
      },
      createRng(SEED + 90),
    );
    const historySummary = await insertHistory(db, history, inventoryValues);

    // 11. Pembeli demo: alamat, pesanan di berbagai status, poin, wishlist, profil kulit, dan notifikasi.
    const demo = await seedDemoBuyer(db, now);

    return {
      brands: brandRows.length,
      categories: parentRows.length + childRows.length,
      locations: locationRows.length,
      products: productIds.length,
      variants: variantRows.length,
      inventory: inventoryValues.length,
      reviews: reviewValues.length,
      demoOrders: demo.orders.length + 1,
      historyOrders: historySummary.orders,
      historyCustomers: historySummary.customers,
    };
  }
}

