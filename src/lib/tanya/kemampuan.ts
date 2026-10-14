// Kemampuan chat asisten (Fase 8C). Setiap fungsi membangun satu jenis kartu dari fungsi toko yang sudah dipakai halaman
// biasa, tanpa logika kedua: katalog (loadCatalogItems), rutinitas (susunRutinitas), padanan shade (padananShade),
// kecocokan (fitForProfile), ongkir (quoteShippingForZone dan cariKotaTujuan), cabang (jamHariIni, mapsRouteUrl),
// promo (slot flash sale dan voucher publik), bantuan (teks halaman bantuan), dan lacak (lacakPesanan).
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { SkinProfile } from "@/db/schema/customers";
import type { AnyDb } from "@/lib/db-types";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { padananShade, susunRutinitas } from "@/lib/catalog/tools";
import { toCardData } from "@/lib/catalog/catalog-queries";
import { loadCatalogItems } from "@/lib/catalog/load-items";
import type { CatalogItem } from "@/lib/catalog/filters";
import { skinTypeLabels, concernLabels } from "@/lib/catalog/filters";
import { CARA_BELANJA, FAQ, PENGIRIMAN } from "@/lib/content/bantuan";
import { RETURN_POLICY } from "@/lib/content/return-policy";
import { mapsRouteUrl } from "@/lib/content/toko";
import { formatDateTimeWib, formatRupiah } from "@/lib/format";
import { ONLINE_WAREHOUSE_SLUG } from "@/lib/inventory";
import { jamHariIni, locationFlags } from "@/lib/product/availability";
import { cariKotaTujuan, regionName, zoneForRegency, type KotaTujuan } from "@/lib/regions";
import { loadSettings } from "@/lib/settings/db";
import { quoteShippingForZone, quickCities, zoneLabels } from "@/lib/shipping";
import { isProfileUsable } from "@/lib/skin/profile";
import { routineView } from "@/lib/skin/routine-view";
import { fitForProfile, type FitProduct } from "@/lib/skin/rules";
import type { DupeOutcome } from "@/lib/ai/dupe";
import { judulDupe, type CabangKartu, type Chip, type FlashKartu, type Kartu, type OngkirKartu, type ProdukKartu, type TopikBantuan, type VoucherKartu } from "./kartu";

// Hasil satu kemampuan: teks pendek pembuka, kartu, dan chip lanjutan.
export type Jawaban = { teks: string; kartu: Kartu[]; chips?: Chip[] };

// ---------- Kartu produk (satu pembentuk untuk Advisor, dupe, shade, dan promo) ----------

export type PilihanProduk = { id: number; alasan?: string; varianPilihan?: number | null };

export function produkDariItem(i: CatalogItem, locationNames: Map<string, string>, p: Omit<PilihanProduk, "id"> = {}): ProdukKartu {
  const branches = new Set<string>();
  for (const v of i.variants) for (const [slug, n] of Object.entries(v.stockByLocation)) if (n > 0 && slug !== ONLINE_WAREHOUSE_SLUG) branches.add(locationNames.get(slug) ?? slug);
  const card = toCardData(i);
  return {
    id: card.id,
    name: card.name,
    slug: card.slug,
    brandName: card.brandName,
    brandColor: card.brandColor,
    packaging: card.packaging,
    price: card.price,
    normalPrice: card.normalPrice,
    primaryHex: card.primaryHex,
    variantCount: card.variantCount,
    variants: card.variants,
    stokOnline: i.variants.reduce((s, v) => s + (v.stockByLocation[ONLINE_WAREHOUSE_SLUG] ?? 0), 0),
    cabang: [...branches].sort(),
    ...(p.alasan ? { alasan: p.alasan } : {}),
    ...(p.varianPilihan ? { varianPilihan: p.varianPilihan } : {}),
  };
}

async function namaLokasi(db: AnyDb) {
  return new Map((await db.select({ slug: schema.locations.slug, name: schema.locations.name }).from(schema.locations)).map((l) => [l.slug, l.name]));
}

// Kartu produk dari id dengan harga, stok, dan cabang terbaru dari server (urutan pilihan dipertahankan).
export async function produkKartu(db: AnyDb, picks: PilihanProduk[], now: Date): Promise<ProdukKartu[]> {
  if (!picks.length) return [];
  const [items, locs] = await Promise.all([loadCatalogItems(db, { kind: "ids", ids: picks.map((p) => p.id) }, now), namaLokasi(db)]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return picks.flatMap((p) => {
    const i = byId.get(p.id);
    return i ? [produkDariItem(i, locs, p)] : [];
  });
}

// ---------- Ongkir ----------

const BERAT_BAWAAN = 500;

export async function jawabOngkir(db: AnyDb, input: { kota?: string | null; kode?: string | null; beratGram?: number }): Promise<Jawaban> {
  const settings = await loadSettings(db);
  const pilihKota: Kartu = { jenis: "pilih_kota", pilihan: quickCities.slice(0, 8).map((c) => ({ kode: c.slug, nama: c.name, provinsi: c.province, zona: c.zone })) };
  let kota: KotaTujuan | null = null;
  if (input.kode) {
    const quick = quickCities.find((c) => c.slug === input.kode);
    const zona = /^\d{2}\.\d{2}$/.test(input.kode) ? zoneForRegency(input.kode) : null;
    if (quick) kota = { kode: quick.slug, nama: quick.name, provinsi: quick.province, zona: quick.zone };
    else if (zona) kota = { kode: input.kode, nama: regionName(input.kode).trim().replace(/^Kota Administrasi /, "").replace(/^Kabupaten /, "Kab. "), provinsi: regionName(input.kode.split(".")[0]), zona };
  }
  if (!kota && input.kota) {
    const r = cariKotaTujuan(input.kota);
    if (r.status === "cocok") kota = r.kota;
    else if (r.status === "ambigu") return { teks: `Maksudmu ${r.pilihan.map((k) => k.nama).join(" atau ")}? Ongkirnya berbeda, jadi pilih dulu, ya.`, kartu: [{ jenis: "pilih_kota", pilihan: r.pilihan }] };
    else return { teks: `Aku belum mengenal kota "${r.teks}". Tulis nama kota atau kabupatennya, atau pilih salah satu di bawah.`, kartu: [pilihKota] };
  }
  if (!kota) return { teks: "Mau kirim ke kota mana? Tulis nama kota atau kabupatennya, atau pilih di bawah.", kartu: [pilihKota] };
  const berat = input.beratGram ?? BERAT_BAWAAN;
  const opsi = quoteShippingForZone({ totalGram: berat, zone: kota.zona, rates: settings.couriers.rates, active: settings.couriers.active });
  const data: OngkirKartu = {
    kota: kota.nama,
    provinsi: kota.provinsi,
    zona: zoneLabels[kota.zona],
    beratGram: berat,
    opsi: opsi.map((o) => ({ kode: o.code, nama: `${o.name} ${o.service}`.trim(), harga: o.cost, eta: o.etaLabel })),
    ambilDiToko: fiturAktif("ambilDiToko") && settings.couriers.active.includes("ambil_di_toko") && kota.zona === "dalam_kota",
    gratisOngkir: settings.freeShipping.cap > 0 ? `Belanja minimal ${formatRupiah(settings.freeShipping.threshold)} dapat potongan ongkir sampai ${formatRupiah(settings.freeShipping.cap)}.` : null,
  };
  return { teks: opsi.length ? `Ongkir ke ${kota.nama} untuk paket sekitar ${berat} gram, dari Gudang Online di ${MEREK.kontak.kota}:` : `Belum ada kurir aktif untuk ${kota.nama}.`, kartu: [{ jenis: "ongkir", data }] };
}

// ---------- Cabang ----------

export async function jawabCabang(db: AnyDb, now: Date, teks = ""): Promise<Jawaban> {
  if (!fiturAktif("multiCabang")) return { teks: `${MEREK.namaLengkap} saat ini hanya melayani pesanan online.`, kartu: [] };
  const settings = await loadSettings(db);
  const rows = await db.select().from(schema.locations).where(and(eq(schema.locations.isActive, true), eq(schema.locations.type, "toko"))).orderBy(asc(schema.locations.sortOrder));
  const q = teks.toLowerCase();
  const disebut = rows.filter((r) => q.includes(r.slug.replace(/-/g, " ")) || q.includes(r.name.toLowerCase().replace(`${MEREK.nama.toLowerCase()} `, "")));
  const list = disebut.length ? disebut : rows;
  const cabang: CabangKartu[] = list.map((r) => ({
    slug: r.slug,
    nama: r.name,
    alamat: [r.address, r.district, r.city].filter(Boolean).join(", "),
    telepon: r.phone,
    hariIni: jamHariIni(r, now),
    bukaSekarang: locationFlags(r, now, settings.cutoff).openNow,
    rute: mapsRouteUrl(r),
    bisaAmbil: r.canPickup && fiturAktif("ambilDiToko"),
  }));
  return { teks: disebut.length === 1 ? `Ini info ${disebut[0].name} hari ini:` : `${MEREK.namaLengkap} punya ${rows.length} cabang. Jam buka hari ini:`, kartu: [{ jenis: "cabang", cabang }] };
}

// ---------- Promo: flash sale berjalan dan voucher publik ----------

export async function jawabPromo(db: AnyDb, now: Date): Promise<Jawaban> {
  let flash: FlashKartu | null = null;
  if (fiturAktif("flashSale")) {
    const [slot] = await db
      .select({ id: schema.flashSales.id, name: schema.flashSales.name, startsAt: schema.flashSales.startsAt, endsAt: schema.flashSales.endsAt })
      .from(schema.flashSales)
      .where(and(eq(schema.flashSales.isActive, true), gt(schema.flashSales.endsAt, now), lte(schema.flashSales.startsAt, new Date(now.getTime() + 2 * 86_400_000))))
      .orderBy(asc(schema.flashSales.startsAt))
      .limit(1);
    if (slot) {
      const items = await db
        .select({ productId: schema.variants.productId, variantId: schema.flashSaleItems.variantId, flashPrice: schema.flashSaleItems.flashPrice, quota: schema.flashSaleItems.quota, sold: schema.flashSaleItems.sold })
        .from(schema.flashSaleItems)
        .innerJoin(schema.variants, eq(schema.flashSaleItems.variantId, schema.variants.id))
        .where(eq(schema.flashSaleItems.flashSaleId, slot.id))
        .orderBy(desc(sql`${schema.flashSaleItems.quota} - ${schema.flashSaleItems.sold}`), asc(schema.flashSaleItems.id))
        .limit(4);
      const cards = await produkKartu(db, items.map((i) => ({ id: i.productId, varianPilihan: i.variantId })), now);
      const byId = new Map(cards.map((c) => [c.id, c]));
      const berjalan = slot.startsAt <= now;
      flash = {
        nama: slot.name,
        berjalan,
        mulai: formatDateTimeWib(slot.startsAt),
        selesai: formatDateTimeWib(slot.endsAt),
        selesaiIso: slot.endsAt.toISOString(),
        item: items.flatMap((i) => (byId.get(i.productId) ? [{ produk: byId.get(i.productId)!, hargaFlash: i.flashPrice, sisa: Math.max(0, i.quota - i.sold) }] : [])),
      };
    }
  }
  const vouchers = await db
    .select({ code: schema.vouchers.code, title: schema.vouchers.title, description: schema.vouchers.description, minSpend: schema.vouchers.minSpend })
    .from(schema.vouchers)
    .where(and(eq(schema.vouchers.isActive, true), eq(schema.vouchers.isPublic, true), lte(schema.vouchers.startsAt, now), gt(schema.vouchers.endsAt, now), or(isNull(schema.vouchers.quota), sql`${schema.vouchers.used} < ${schema.vouchers.quota}`)))
    .orderBy(asc(schema.vouchers.minSpend), asc(schema.vouchers.code))
    .limit(5);
  const voucher: VoucherKartu[] = vouchers.map((v) => ({ kode: v.code, judul: v.title, deskripsi: v.description, minimal: v.minSpend }));
  if (!flash && !voucher.length) return { teks: "Belum ada promo yang berjalan saat ini. Coba cek lagi nanti, ya.", kartu: [] };
  const teks = [flash ? (flash.berjalan ? `Flash sale ${flash.nama} sedang berjalan sampai ${flash.selesai}.` : `Flash sale berikutnya mulai ${flash.mulai}.`) : "", voucher.length ? "Voucher yang bisa dipakai semua pembeli ada di bawah; syaratnya dicek ulang saat checkout." : ""].filter(Boolean).join(" ");
  return { teks, kartu: [{ jenis: "promo", flash, voucher }] };
}

// ---------- Bantuan: teks dari halaman bantuan (satu sumber) ----------

const faq = (q: RegExp) => FAQ.find((f) => q.test(f.q))?.a ?? "";

export function jawabBantuan(topik: TopikBantuan): Jawaban {
  switch (topik) {
    case "retur":
      return { teks: "Soal retur:", kartu: [{ jenis: "info", judul: "Kebijakan retur", paragraf: [RETURN_POLICY.window, RETURN_POLICY.scope], tautan: { href: RETURN_POLICY.href, label: "Baca kebijakan retur" } }] };
    case "bayar":
      return { teks: "Soal pembayaran:", kartu: [{ jenis: "info", judul: "Cara bayar", paragraf: [faq(/cara membayar/i), faq(/voucher dan poin/i)].filter(Boolean), tautan: { href: "/cara-belanja", label: "Lihat cara belanja" } }] };
    case "kirim":
      return { teks: "Soal pengiriman:", kartu: [{ jenis: "info", judul: "Kapan pesanan dikirim", paragraf: [faq(/kapan pesanan dikirim/i), ...(PENGIRIMAN.find((s) => /kapan dikirim/i.test(s.title))?.items ?? [])].filter(Boolean).slice(0, 3), tautan: { href: "/kebijakan/pengiriman", label: "Baca kebijakan pengiriman" } }] };
    case "kontak":
      return { teks: "Kamu bisa menghubungi kami di sini:", kartu: [{ jenis: "info", judul: "Hubungi kami", paragraf: [`WhatsApp ${MEREK.kontak.whatsapp.replace(/^62/, "0")}, email ${MEREK.kontak.email}.`, faq(/toko sungguhan/i)].filter(Boolean), tautan: { href: "/hubungi", label: "Buka halaman Hubungi kami" } }] };
    default:
      return { teks: "Pertanyaan yang sering ditanyakan:", kartu: [{ jenis: "info", judul: "Pertanyaan umum", paragraf: [CARA_BELANJA[0].text, ...FAQ.slice(1, 3).map((f) => `${f.q} ${f.a}`)], tautan: { href: "/faq", label: "Lihat semua pertanyaan" } }] };
  }
}

// ---------- Rutinitas dan kuis ----------

export async function jawabRutinitas(db: AnyDb, profile: SkinProfile | null, now: Date): Promise<Jawaban> {
  if (!isProfileUsable(profile)) return { teks: "Aku perlu kenal kulitmu dulu. Jawab beberapa pertanyaan singkat ini, ya, nanti rutinitasnya langsung tersusun.", kartu: [{ jenis: "kuis", awal: {}, foto: false }] };
  const routine = await susunRutinitas(db, profile, profile.budget, now);
  const v = routineView(routine, profile.routine);
  const ringkasan = `Untuk kulit ${skinTypeLabels[profile.skinType!]?.toLowerCase() ?? profile.skinType}${profile.concerns?.length ? `, fokus ${profile.concerns.map((c) => concernLabels[c]?.toLowerCase() ?? c).join(" dan ")}` : ""}, budget sampai ${formatRupiah(routine.budget)} per produk.`;
  return { teks: "Ini rutinitas pagi dan malam dari profil kulitmu. Bisa mulai dari yang penting dulu.", kartu: [{ jenis: "rutinitas", data: { ...v, ringkasan } }] };
}

// ---------- Padanan shade ----------

export async function jawabShade(db: AnyDb, varianId: number, now: Date): Promise<Jawaban> {
  const r = await padananShade(db, varianId, now);
  if (!r.sumber || !r.hasil.length) return { teks: "Belum ada shade lain yang cukup dekat di katalog. Coba pilih produk dan shade lain, ya.", kartu: [{ jenis: "pilih_shade" }] };
  const cards = await produkKartu(db, r.hasil.map((h) => ({ id: h.produkId, varianPilihan: h.varianId })), now);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const hasil = r.hasil.flatMap((h) => (byId.get(h.produkId) ? [{ produk: { ...byId.get(h.produkId)!, alasan: h.alasan }, shade: h.shade, hex: h.hex, alasan: h.alasan }] : []));
  return { teks: `3 shade terdekat dengan ${r.sumber.produk} ${r.sumber.shade}, dibandingkan dari warna, kedalaman, dan undertone:`, kartu: [{ jenis: "shade", sumber: { produk: r.sumber.produk, shade: r.sumber.shade, hex: r.sumber.hex }, hasil }] };
}

// ---------- Cocok untuk kulitku ----------

export async function muatFitProduct(db: AnyDb, produkId: number): Promise<{ id: number; nama: string; slug: string; fit: FitProduct } | null> {
  const [p] = await db
    .select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug, categoryId: schema.products.categoryId, skinTypes: schema.products.skinTypes, concerns: schema.products.skinConcerns, finish: schema.products.finish, activeIngredients: schema.products.activeIngredients, ingredients: schema.products.ingredients })
    .from(schema.products)
    .where(and(eq(schema.products.id, produkId), eq(schema.products.status, "aktif")));
  if (!p) return null;
  const [cat] = await db.select({ slug: schema.categories.slug, parentId: schema.categories.parentId }).from(schema.categories).where(eq(schema.categories.id, p.categoryId));
  const [parent] = cat?.parentId ? await db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.id, cat.parentId)) : [];
  const variants = await db.select({ shadeName: schema.variants.shadeName, undertone: schema.variants.undertone, depth: schema.variants.depth }).from(schema.variants).where(and(eq(schema.variants.productId, p.id), eq(schema.variants.isActive, true)));
  return { id: p.id, nama: p.name, slug: p.slug, fit: { categorySlug: cat?.slug ?? "", parentSlug: parent?.slug ?? cat?.slug ?? "", skinTypes: p.skinTypes, concerns: p.concerns, finish: p.finish, activeIngredients: p.activeIngredients, ingredients: p.ingredients, variants } };
}

export async function jawabCocok(db: AnyDb, produkId: number, profile: SkinProfile | null): Promise<Jawaban> {
  const data = await muatFitProduct(db, produkId);
  if (!data) return { teks: "Produk itu tidak ada di katalog atau sedang tidak aktif.", kartu: [] };
  const fit = isProfileUsable(profile) ? fitForProfile(profile, data.fit) : null;
  return {
    teks: fit ? `Penilaian ${data.nama} untuk kulitmu, berbasis aturan dari profil kulit dan data produk:` : `Aku perlu kenal kulitmu dulu untuk menilai ${data.nama}. Isi kuis singkat ini, ya.`,
    kartu: fit ? [{ jenis: "cocok", produk: { id: data.id, nama: data.nama, slug: data.slug }, fit }] : [{ jenis: "cocok", produk: { id: data.id, nama: data.nama, slug: data.slug }, fit: null }, { jenis: "kuis", awal: {}, foto: false }],
  };
}

// ---------- Lacak: daftar pesanan milik pembeli yang masuk ----------

export async function pesananTerakhir(db: AnyDb, customerId: number) {
  const rows = await db.select({ number: schema.orders.number, status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.customerId, customerId)).orderBy(desc(schema.orders.createdAt)).limit(4);
  return rows.map((r) => ({ nomor: r.number, status: r.status }));
}

// Id produk yang punya nama paling cocok dengan kalimat (untuk "X cocok buat kulitku?").
export async function produkDisebut(db: AnyDb, teks: string): Promise<number | null> {
  const rows = await db.select({ id: schema.products.id, name: schema.products.name, brand: schema.brands.name }).from(schema.products).innerJoin(schema.brands, eq(schema.products.brandId, schema.brands.id)).where(eq(schema.products.status, "aktif"));
  const t = teks.toLowerCase();
  const scored = rows
    .map((r) => {
      const own = r.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !/^spf$|^\d+$/.test(w));
      const hits = own.filter((w) => t.includes(w)).length;
      return { id: r.id, score: hits / Math.max(1, own.length), hits };
    })
    .filter((x) => x.hits >= 2 && x.score >= 0.6)
    .sort((a, b) => b.score - a.score || b.hits - a.hits);
  return scored.length && (scored.length === 1 || scored[0].score > scored[1].score) ? scored[0].id : null;
}


// ---------- Kartu dupe dari hasil cari dupe (link atau screenshot) ----------

export async function kartuDupe(db: AnyDb, outcome: Extract<DupeOutcome, { ok: true }>, now: Date): Promise<Kartu> {
  const produk = await produkKartu(db, outcome.match.picks.map((p) => ({ id: p.productId, alasan: p.alasan, varianPilihan: p.variantId })), now);
  return { jenis: "dupe", sumber: outcome.source, tipe: outcome.match.tipe, namaTerbaca: "namaTerbaca" in outcome.match ? outcome.match.namaTerbaca : null, jenisProduk: outcome.extraction.jenisProduk || null, produk };
}

export function teksDupe(k: Extract<Kartu, { jenis: "dupe" }>): string {
  return k.tipe === "tidak_dikenali" ? "Produk di video belum bisa kami kenali. Coba kirim screenshot yang menampilkan produknya dengan jelas, ya." : `${judulDupe(k)}.`;
}
