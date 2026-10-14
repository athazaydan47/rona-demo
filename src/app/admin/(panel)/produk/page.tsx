import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { and, asc, ne, sql } from "drizzle-orm";
import { BulkDescriptionPanel } from "@/components/admin/description-writer";
import { aiTersedia } from "@/lib/ai";
import { Plus } from "lucide-react";
import { DuplicateProductButton } from "@/components/admin/product-row-actions";
import { Denied, fieldClass, PageHead, Pager, Skeleton, tdClass, thClass } from "@/components/admin/ui";
import { ProductArt } from "@/components/product-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db/client";
import type { Packaging } from "@/db/schema/enums";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { listProducts, PRODUCT_STATUSES, type ProductStatus } from "@/lib/admin/products";
import { rootCategories } from "@/lib/admin/taxonomy";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Produk" };

type SP = { q?: string; merek?: string; kategori?: string; status?: string; hal?: string };
type Props = { searchParams: Promise<SP> };
const STATUS_TONE = { aktif: "sukses", draf: "menipis", arsip: "netral" } as const;

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/produk");
  if (!can(me, "produk.kelola")) return <Denied />;
  const status = PRODUCT_STATUSES.includes(sp.status as ProductStatus) ? (sp.status as ProductStatus) : null;
  const [r, brands, cats] = await Promise.all([
    listProducts(db, { q: sp.q, brand: Number(sp.merek) || null, category: Number(sp.kategori) || null, status, page: Number.parseInt(sp.hal ?? "1", 10) || 1 }),
    db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name)),
    rootCategories(db),
  ]);
  // Produk berdeskripsi pendek (tab Manfaat di bawah 200 karakter) untuk usulan massal penulis AI.
  const short = aiTersedia()
    ? await db
        .select({ id: schema.products.id, name: schema.products.name, length: sql<number>`(length(${schema.products.benefits}) + length(${schema.products.shortDescription}))::int` })
        .from(schema.products)
        .where(and(ne(schema.products.status, "arsip"), sql`length(${schema.products.benefits}) < 200`))
        .orderBy(sql`length(${schema.products.benefits}) + length(${schema.products.shortDescription})`, asc(schema.products.name))
        .limit(12)
    : [];
  const href = (p: number) => `/admin/produk?${new URLSearchParams(Object.entries({ ...sp, hal: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  const price = (min: number, max: number) => (min === max ? formatRupiah(min) : `${formatRupiah(min)} sampai ${formatRupiah(max)}`);
  return (
    <>
      <PageHead title="Produk" description={`${r.total} produk. Draf dan arsip tidak tampil di toko.`}>
        <Button asChild size="sm">
          <Link href="/admin/produk/baru">
            <Plus /> Tambah produk
          </Link>
        </Button>
      </PageHead>
      <BulkDescriptionPanel products={short} />
      <form action="/admin/produk" className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-garis bg-putih p-3 md:grid-cols-5">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Nama, slug, atau SKU" aria-label="Cari produk" className={cn(fieldClass, "col-span-2 md:col-span-1")} />
        <select name="merek" defaultValue={sp.merek ?? ""} aria-label="Merek" className={fieldClass}>
          <option value="">Semua merek</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="kategori" defaultValue={sp.kategori ?? ""} aria-label="Kategori" className={fieldClass}>
          <option value="">Semua kategori</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={fieldClass}>
          <option value="">Semua status</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="col-span-2 h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih md:col-span-1">
          Terapkan
        </button>
      </form>

      <ul className="space-y-2 md:hidden">
        {r.rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-garis bg-putih p-3">
            <span className="w-12 shrink-0 overflow-hidden rounded-lg">
              <ProductArt packaging={p.packaging as Packaging} shade={p.hex} brandColor={p.brandColor} brandName={p.brandName} title="" />
            </span>
            <Link href={`/admin/produk/${p.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-abu-hangat">
                {p.brandName} · {p.variants} varian · stok {formatNumber(p.stock)}
              </span>
              <span className="block text-xs font-semibold tabular-nums">{price(p.minPrice, p.maxPrice)}</span>
            </Link>
            <Badge variant={STATUS_TONE[p.status]}>{p.status}</Badge>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-garis bg-putih md:block">
        <table className="w-full text-sm" data-testid="tabel-produk">
          <thead className="border-b border-garis bg-porselen/70">
            <tr>
              <th className={thClass}>Produk</th>
              <th className={thClass}>Kategori</th>
              <th className={`${thClass} text-right`}>Varian</th>
              <th className={`${thClass} text-right`}>Harga jual</th>
              <th className={`${thClass} text-right`}>Stok total</th>
              <th className={`${thClass} text-right`}>Terjual</th>
              <th className={thClass}>Status</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {r.rows.map((p) => (
              <tr key={p.id} className="hover:bg-porselen/50">
                <td className={tdClass}>
                  <Link href={`/admin/produk/${p.id}`} className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 overflow-hidden rounded-md">
                      <ProductArt packaging={p.packaging as Packaging} shade={p.hex} brandColor={p.brandColor} brandName={p.brandName} title="" />
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-72 truncate font-medium hover:underline">{p.name}</span>
                      <span className="block text-xs text-abu-hangat">{p.brandName}</span>
                    </span>
                  </Link>
                </td>
                <td className={`${tdClass} whitespace-nowrap text-abu-hangat`}>{p.categoryName}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{p.variants}</td>
                <td className={`${tdClass} text-right whitespace-nowrap tabular-nums`}>{price(p.minPrice, p.maxPrice)}</td>
                <td className={cn(tdClass, "text-right tabular-nums", p.stock <= 0 && "text-bahaya")}>{formatNumber(p.stock)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(p.soldCount)}</td>
                <td className={tdClass}>
                  <Badge variant={STATUS_TONE[p.status]}>{p.status}</Badge>
                </td>
                <td className={`${tdClass} text-right`}>
                  <DuplicateProductButton id={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.rows.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">Tidak ada produk yang cocok.</p> : null}
      <Pager page={r.page} pageCount={r.pageCount} href={href} />
    </>
  );
}

export default function AdminProductsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Content {...props} />
    </Suspense>
  );
}
