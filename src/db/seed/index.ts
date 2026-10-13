import { config } from "dotenv";
config({ path: ".env.local" });

import { scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
import { assertResetAllowed, directUrl } from "../connection";
import type { AnyDb } from "../../lib/db-types";
import { seedDemoBuyer } from "./demo-buyer";

const SEED = 20261013;
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD ?? "demo1234";

function hashPassword(password: string) {
  // Salt tetap supaya seed deterministik. Fase 6 bisa mengganti dengan salt acak per akun.
  const salt = "rona-demo-salt";
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

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

export async function runSeed(url = directUrl()) {
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  const rng = createRng(SEED);
  const now = new Date();
  const today = toWibParts(now);
  const daysAgo = (d: number, hour = 10) => new Date(now.getTime() - d * 86400000 - (10 - hour) * 3600000);

  try {
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
      const soldCount = p.popularity * rng.int(15, 40);
      const publishedAt = daysAgo(p.isNew ? rng.int(3, 20) : rng.int(30, 240));

      const [product] = await db
        .insert(schema.products)
        .values({
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
        })
        .returning({ id: schema.products.id });
      productIds.push(product.id);
      productMeta.set(product.id, { kind: p.kind, popularity: p.popularity, slug });
      productIdBySlugEarly.set(slug, product.id);

      // Sekitar 1 dari 8 produk punya harga promo aktif.
      const hasPromo = rng.chance(0.14);
      const code = brandCode(p.brand);
      const variantValues = p.variants.map((v, vi) => {
        const salePrice = p.salePrice + (v.priceDelta ?? 0);
        const normalPrice = p.normalPrice + (v.priceDelta ?? 0);
        const promoPrice = hasPromo ? roundToPromo(salePrice * 0.88) : null;
        return {
          productId: product.id,
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
      });
      const inserted = await db
        .insert(schema.variants)
        .values(variantValues)
        .returning({ id: schema.variants.id, productId: schema.variants.productId, salePrice: schema.variants.salePrice, shadeName: schema.variants.shadeName });
      variantRows.push(...inserted);
    }

    // 5. Stok per varian per lokasi + buku stok awal
    const inventoryValues: (typeof schema.inventory.$inferInsert)[] = [];
    const movementValues: (typeof schema.stockMovements.$inferInsert)[] = [];
    // Satu shade cushion Pualam Velvet Matte sengaja habis di semua lokasi untuk memamerkan "Kabari aku".
    const cushionId = productIdBySlugEarly.get("pualam-velvet-matte-cushion-spf-50");
    const soldOutVariant = variantRows.find((v) => v.productId === cushionId && v.shadeName === "10N Kayu Manis");
    for (const v of variantRows) {
      for (const loc of locationRows) {
        let onHand: number;
        const roll = rng.next();
        if (soldOutVariant && v.id === soldOutVariant.id) onHand = 0;
        else
        if (loc.type === "gudang") {
          onHand = roll < 0.06 ? 0 : roll < 0.14 ? rng.int(1, 4) : rng.int(8, 60);
        } else {
          onHand = roll < 0.18 ? 0 : roll < 0.32 ? rng.int(1, 4) : rng.int(5, 18);
        }
        inventoryValues.push({ variantId: v.id, locationId: loc.id, onHand, reserved: 0 });
        if (onHand > 0) {
          movementValues.push({
            variantId: v.id,
            locationId: loc.id,
            type: "masuk",
            quantity: onHand,
            reference: "SEED-AWAL",
            note: "Stok awal demo",
            actor: "sistem",
            createdAt: daysAgo(rng.int(5, 40)),
          });
        }
      }
    }
    for (const part of chunk(inventoryValues, 500)) await db.insert(schema.inventory).values(part);
    for (const part of chunk(movementValues, 500)) await db.insert(schema.stockMovements).values(part);

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
    for (const [productId, agg] of ratingAgg) {
      await db
        .update(schema.products)
        .set({ ratingAvg: Math.round((agg.sum / agg.count) * 10) / 10, reviewCount: agg.count })
        .where(eq(schema.products.id, productId));
    }

    // 7. Flash sale: slot 12.00 sampai 14.00 dan 20.00 sampai 22.00 WIB, hari ini sampai 3 hari ke depan,
    // supaya selalu ada slot yang berjalan atau segera mulai kapan pun demo dibuka.
    const slots = [
      { name: "Flash Sale Siang", start: [12, 0], end: [14, 0] },
      { name: "Flash Sale Malam", start: [20, 0], end: [22, 0] },
    ] as const;
    const bestsellerVariants = variantRows.filter((v) => productMeta.get(v.productId)!.popularity >= 8);
    const flashPool = rng.shuffle(bestsellerVariants);
    for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
      const dayParts = toWibParts(new Date(now.getTime() + dayOffset * 86400000));
      for (const [si, slot] of slots.entries()) {
        const [sale] = await db
          .insert(schema.flashSales)
          .values({
            name: slot.name,
            startsAt: wibDate(dayParts.year, dayParts.month, dayParts.day, slot.start[0], slot.start[1]),
            endsAt: wibDate(dayParts.year, dayParts.month, dayParts.day, slot.end[0], slot.end[1]),
            isActive: true,
          })
          .returning({ id: schema.flashSales.id });
        const offset = ((dayOffset * 2 + si) * 6) % Math.max(1, flashPool.length - 6);
        const picks = flashPool.slice(offset, offset + 6);
        await db.insert(schema.flashSaleItems).values(
          picks.map((v) => {
            const quota = rng.int(20, 40);
            // Slot yang sudah lewat atau sedang berjalan punya penjualan, slot mendatang masih 0.
            const started = dayOffset === 0 && slot.start[0] <= today.hour;
            return {
              flashSaleId: sale.id,
              variantId: v.id,
              flashPrice: roundToPromo(v.salePrice * 0.78),
              quota,
              sold: started ? rng.int(2, Math.floor(quota * 0.6)) : 0,
              maxPerCustomer: 2,
            };
          }),
        );
      }
    }

    // 8. Voucher
    const monthStart = wibDate(today.year, today.month, 1);
    const voucherEnd = new Date(monthStart.getTime() + 183 * 86400000);
    await db.insert(schema.vouchers).values(
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
    );

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
    await db.insert(schema.staff).values(
      staffSeed.map((s) => ({
        name: s.name,
        email: s.email,
        passwordHash: hashPassword(DEMO_STAFF_PASSWORD),
        roleId: roleBySlug.get(s.role)!,
        locationId: s.location ? locationBySlug.get(s.location)!.id : null,
        isActive: true,
      })),
    );
    await db.insert(schema.settings).values(
      Object.entries(settingsSeed).map(([key, value]) => ({ key, value: value as object })),
    );
    await db.insert(schema.banners).values(
      bannerSeed.map((b) => ({ ...b, position: "hero", isActive: true })),
    );

    // 11. Pembeli demo: alamat, pesanan di berbagai status, poin, wishlist, profil kulit, dan notifikasi.
    const demo = await seedDemoBuyer(db as unknown as AnyDb, now);

    console.log(
      `Seed selesai: ${brandRows.length} merek, ${parentRows.length + childRows.length} kategori, ${locationRows.length} lokasi, ${productIds.length} produk, ${variantRows.length} varian, ${inventoryValues.length} baris stok, ${reviewValues.length} ulasan, 8 slot flash sale, ${voucherSeed.length} voucher, ${articleSeed.length} artikel, pembeli demo dengan ${demo.orders.length + 1} pesanan.`,
    );
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1]?.endsWith("seed/index.ts") || process.argv[1]?.endsWith("seed");
if (isMain) {
  // db:seed langsung ke host jauh juga butuh konfirmasi, sama seperti db:reset.
  Promise.resolve()
    .then(() => assertResetAllowed(directUrl(), process.env, "db:seed"))
    .then(() => runSeed())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
