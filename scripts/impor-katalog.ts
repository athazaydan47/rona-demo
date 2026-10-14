// Impor katalog dari CSV (Fase 8B). Pekerjaan pertama di setiap proyek klien.
//   npm run impor:katalog -- --berkas=docs/templat-katalog.csv --kering     periksa saja, tanpa menulis
//   npm run impor:katalog -- --berkas=katalog-klien.csv                     tulis ke DATABASE_URL
//   --staf=owner@domain   akun staf pencatat (bawaan: Owner aktif pertama)
//   --buat-merek          buat merek yang belum ada (warna bawaan abu, bisa diubah di admin)
// Produk dibuat lewat saveProduct (aturan yang sama dengan formulir admin, termasuk SKU dan slug unik), stok awal lewat
// receiveStock (modul inventory, menulis stock_movements dan log aktivitas). Produk yang slug-nya sudah ada dilewati.
// Kategori ditulis dengan slug sub kategori (tingkat kedua), lokasi stok lewat kolom stok_<slug lokasi>.
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const berkas = arg("berkas");
  if (!berkas) {
    console.error("Pakai: npm run impor:katalog -- --berkas=<file.csv> [--kering] [--staf=email] [--buat-merek]");
    return 2;
  }
  const kering = flag("kering");
  const { parseKatalog } = await import("../src/lib/impor/katalog");
  const hasil = parseKatalog(readFileSync(berkas, "utf8"));
  console.log(`${berkas}: ${hasil.jumlahBaris} baris, ${hasil.produk.length} produk lolos aturan isi, ${hasil.gagal.length} baris gagal.`);

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { and, eq, inArray, isNotNull } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");
  const { loadPrincipal } = await import("../src/lib/admin/auth");
  const { saveProduct } = await import("../src/lib/admin/products");
  const { receiveStock } = await import("../src/lib/admin/stock");
  const { slugify } = await import("../src/lib/utils");
  const client = postgres(process.env.DATABASE_URL ?? "", { max: 2, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" }) as never as import("../src/lib/db-types").AnyDb;
  const gagal = [...hasil.gagal];
  try {
    // Rujukan ke database: merek, sub kategori, lokasi, slug dan SKU yang sudah ada.
    const brands = await db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands);
    const cats = await db.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories).where(isNotNull(schema.categories.parentId));
    const locs = await db.select({ id: schema.locations.id, slug: schema.locations.slug }).from(schema.locations);
    const slugs = hasil.produk.map((p) => p.slug);
    const skus = hasil.produk.flatMap((p) => p.input.variants.map((v) => v.sku));
    const takenSlug = new Set(slugs.length ? (await db.select({ slug: schema.products.slug }).from(schema.products).where(inArray(schema.products.slug, slugs))).map((r) => r.slug) : []);
    const takenSku = new Set(skus.length ? (await db.select({ sku: schema.variants.sku }).from(schema.variants).where(inArray(schema.variants.sku, skus))).map((r) => r.sku) : []);
    const brandId = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
    const catId = new Map(cats.map((c) => [c.slug, c.id]));
    const locId = new Map(locs.map((l) => [l.slug, l.id]));
    const merekBaru = new Set<string>();

    const siap = hasil.produk.filter((p) => {
      const masalah: string[] = [];
      if (takenSlug.has(p.slug)) masalah.push(`produk ${p.slug} sudah ada (dilewati)`);
      const sudah = p.input.variants.filter((v) => takenSku.has(v.sku)).map((v) => v.sku);
      if (sudah.length) masalah.push(`SKU sudah dipakai: ${sudah.join(", ")}`);
      if (!catId.has(p.categorySlug)) masalah.push(`sub kategori "${p.categorySlug}" tidak ada`);
      if (!brandId.has(p.brandName.toLowerCase())) {
        if (flag("buat-merek")) merekBaru.add(p.brandName);
        else masalah.push(`merek "${p.brandName}" belum ada (tambah di admin, atau pakai --buat-merek)`);
      }
      const lokasiAsing = [...new Set(p.stok.map((s) => s.lokasi).filter((l) => !locId.has(l)))];
      if (lokasiAsing.length) masalah.push(`lokasi tidak dikenal: ${lokasiAsing.join(", ")}`);
      if (masalah.length) gagal.push({ baris: p.baris[0], pesan: `${p.slug}: ${masalah.join("; ")}` });
      return masalah.length === 0;
    });
    const varianSiap = siap.reduce((s, p) => s + p.input.variants.length, 0);
    const pcs = siap.reduce((s, p) => s + p.stok.reduce((a, x) => a + x.jumlah, 0), 0);
    console.log(`Siap ditulis: ${siap.length} produk, ${varianSiap} varian, stok awal ${pcs} pcs${merekBaru.size ? `, merek baru: ${[...merekBaru].join(", ")}` : ""}.`);
    for (const g of gagal.sort((a, b) => a.baris - b.baris)) console.log(`  baris ${g.baris}: ${g.pesan}`);
    if (kering) {
      console.log("Mode uji kering: tidak ada yang ditulis.");
      return gagal.length ? 1 : 0;
    }
    if (!siap.length) return 1;

    const email = arg("staf");
    const [actor] = email
      ? await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email)).limit(1)
      : await db.select({ id: schema.staff.id }).from(schema.staff).innerJoin(schema.roles, eq(schema.staff.roleId, schema.roles.id)).where(and(eq(schema.roles.slug, "owner"), eq(schema.staff.isActive, true))).limit(1);
    const staff = actor ? await loadPrincipal(db, actor.id) : null;
    if (!staff) {
      console.error("Akun staf pencatat tidak ditemukan. Isi --staf=email akun Owner.");
      return 1;
    }
    for (const nama of merekBaru) {
      const [b] = await db.insert(schema.brands).values({ name: nama, slug: slugify(nama), color: "#6E615D" }).returning({ id: schema.brands.id });
      brandId.set(nama.toLowerCase(), b.id);
    }
    const reference = `IMPOR-${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).replace(/-/g, "")}`; // tanggal WIB
    let ditulis = 0;
    for (const p of siap) {
      const r = await saveProduct(db, staff, { ...p.input, brandId: brandId.get(p.brandName.toLowerCase())!, categoryId: catId.get(p.categorySlug)! }, null);
      if (!r.ok) {
        console.log(`  baris ${p.baris[0]}: ${p.slug} gagal disimpan: ${r.message}`);
        continue;
      }
      ditulis += 1;
      const vars = await db.select({ id: schema.variants.id, sku: schema.variants.sku }).from(schema.variants).where(eq(schema.variants.productId, r.id));
      const varId = new Map(vars.map((v) => [v.sku, v.id]));
      const perLokasi = new Map<string, { variantId: number; quantity: number }[]>();
      for (const s of p.stok) perLokasi.set(s.lokasi, [...(perLokasi.get(s.lokasi) ?? []), { variantId: varId.get(s.sku)!, quantity: s.jumlah }]);
      for (const [lokasi, lines] of perLokasi) {
        const st = await receiveStock(db, staff, { locationId: locId.get(lokasi)!, lines, reference, note: "Stok awal impor katalog" });
        if (!st.ok) console.log(`  ${p.slug}: stok ${lokasi} gagal: ${st.message}`);
      }
    }
    console.log(`Selesai: ${ditulis} produk ditulis dengan referensi stok ${reference}. Produk berstatus sesuai kolom status (bawaan draf); aktifkan dari admin setelah dicek.`);
    console.log("Setelah impor ke produksi, buka admin dan simpan satu produk (atau deploy ulang) supaya cache katalog diperbarui.");
    return gagal.length ? 1 : 0;
  } finally {
    await client.end();
  }
}

main().then((c) => process.exit(c), (e) => (console.error(e instanceof Error ? e.message : e), process.exit(1)));
