import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc, isNull } from "drizzle-orm";
import { ArrowLeftRight, ClipboardCheck, PackagePlus } from "lucide-react";
import { Denied, fieldClass, PageHead, Pager, Skeleton } from "@/components/admin/ui";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { allLocations, can } from "@/lib/admin/permissions";
import { stockLocationScope } from "@/lib/admin/stock";
import { stockMatrix } from "@/lib/admin/stock";
import { AskAssistantButton } from "@/components/admin/asisten-panel";
import { aiTersedia } from "@/lib/ai";
import { canAll, type StaffPrincipal } from "@/lib/admin/permissions";
import { now } from "@/lib/clock";
import { transferDraftHref, transferSuggestions } from "@/lib/inventory/saran";
import { loadSettings } from "@/lib/settings/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stok" };

type SP = { q?: string; merek?: string; kategori?: string; status?: string; hal?: string };
type Props = { searchParams: Promise<SP> };

function cellTone(available: number, threshold: number) {
  if (available <= 0) return "bg-[#F7E3E1] text-bahaya";
  if (available <= threshold) return "bg-[#FBEEDC] text-peringatan";
  return "";
}

// Saran transfer (deterministik, src/lib/inventory/saran.ts): cabang yang akan habis dan lokasi yang berlebih.
// "Buat draf transfer" membuka formulir transfer terisi; staf yang memeriksa dan menyimpan.
async function TransferSuggestionsSection({ me }: { me: StaffPrincipal }) {
  const settings = await loadSettings(db);
  const r = await transferSuggestions(db, { now: now(), kurangHari: settings.saran.kurangHari, lebihHari: settings.saran.lebihHari, keepMin: settings.lowStock, locationIds: stockLocationScope(me), limit: 6 });
  if (!r.suggestions.length) return null;
  return (
    <section id="saran-transfer" className="mb-5 scroll-mt-20 rounded-xl border border-garis bg-putih p-4" data-testid="saran-transfer">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-kopi">Saran transfer</h2>
        <p className="text-xs text-abu-hangat">
          {r.total} saran dari laju jual {r.windowDays} hari. Akan habis bila stok cukup kurang dari {r.kurangHari} hari; asal berlebih di atas {r.lebihHari} hari.
        </p>
      </div>
      <ul className="divide-y divide-garis">
        {r.suggestions.map((s) => (
          <li key={`${s.variantId}-${s.toId}`} className="flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-kopi">
                {s.productName} · {s.shadeName}: {s.quantity} pcs dari {s.fromName} ke {s.toName}
              </p>
              <p className="text-xs text-abu-hangat">{s.alasan}</p>
            </div>
            {canAll(me, "stok.transfer", [s.fromId, s.toId]) ? (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link href={transferDraftHref([s])} data-testid="buat-draf-transfer">
                  Buat draf transfer
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {aiTersedia() ? (
        <div className="mt-2">
          <AskAssistantButton prompt="Jelaskan saran transfer hari ini" label="Jelaskan dengan Asisten" />
        </div>
      ) : null}
    </section>
  );
}

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/stok");
  if (!can(me, "stok.lihat")) return <Denied />;
  const status = sp.status === "menipis" || sp.status === "habis" ? sp.status : "semua";
  const [m, brands, categories] = await Promise.all([
    stockMatrix(db, me, { q: sp.q, brand: sp.merek, category: sp.kategori, status, page: Number.parseInt(sp.hal ?? "1", 10) || 1 }),
    db.select({ slug: schema.brands.slug, name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name)),
    db.select({ slug: schema.categories.slug, name: schema.categories.name }).from(schema.categories).where(isNull(schema.categories.parentId)).orderBy(asc(schema.categories.sortOrder)),
  ]);
  const href = (over: Partial<SP>) => `/admin/stok?${new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageHead title="Stok" description={`Tersedia = stok fisik dikurangi dipesan. ${allLocations(me) ? "Semua lokasi." : "Hanya lokasi yang kamu ampu."} Menipis bila tersedia ${m.threshold} atau kurang.`}>
        {can(me, "stok.masuk") ? (
          <Button asChild size="sm">
            <Link href="/admin/stok/masuk">
              <PackagePlus /> Stok masuk
            </Link>
          </Button>
        ) : null}
        {can(me, "stok.transfer") ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/stok/transfer">
              <ArrowLeftRight /> Transfer
            </Link>
          </Button>
        ) : null}
        {can(me, "stok.opname") ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/stok/opname">
              <ClipboardCheck /> Opname
            </Link>
          </Button>
        ) : null}
      </PageHead>

      <Suspense fallback={null}>
        <TransferSuggestionsSection me={me} />
      </Suspense>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Saring stok">
        {(["semua", "menipis", "habis"] as const).map((s) => (
          <Link key={s} role="tab" aria-selected={status === s} href={href({ status: s === "semua" ? undefined : s, hal: undefined })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-sm", status === s ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih")}>
            {s === "semua" ? "Semua" : s === "menipis" ? "Menipis" : "Habis"} <span className="tabular-nums opacity-80">{m.counts[s]}</span>
          </Link>
        ))}
      </div>
      <form action="/admin/stok" className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-garis bg-putih p-3 md:grid-cols-4">
        {status !== "semua" ? <input type="hidden" name="status" value={status} /> : null}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Produk, shade, SKU" aria-label="Cari varian" className={cn(fieldClass, "col-span-2 md:col-span-1")} />
        <select name="merek" defaultValue={sp.merek ?? ""} aria-label="Merek" className={fieldClass}>
          <option value="">Semua merek</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="kategori" defaultValue={sp.kategori ?? ""} aria-label="Kategori" className={fieldClass}>
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="col-span-2 h-10 rounded-lg bg-kopi px-4 text-sm font-semibold text-putih md:col-span-1">
          Terapkan
        </button>
      </form>

      {/* HP: kartu per varian. */}
      <ul className="space-y-2 md:hidden">
        {m.rows.map((r) => (
          <li key={r.variantId} className="rounded-xl border border-garis bg-putih p-3">
            <Link href={`/admin/stok/${r.variantId}`} className="flex items-center gap-3">
              <span className="w-10 shrink-0 overflow-hidden rounded-md">
                <ProductArt packaging={r.packaging} shade={r.hex} brandColor={r.brandColor} brandName={r.brandName} title="" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.productName}</span>
                <span className="block truncate text-xs text-abu-hangat">
                  {r.shadeName} · {r.sku}
                </span>
              </span>
            </Link>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {m.locations.map((l) => {
                const c = r.cells[l.id];
                return (
                  <div key={l.id} className={cn("flex items-center justify-between rounded-md border border-garis px-2 py-1 text-xs", cellTone(c.available, m.threshold))}>
                    <span className="truncate">{l.name.replace("Rona ", "")}</span>
                    <span className="font-semibold tabular-nums">
                      {c.available}
                      {c.reserved ? <span className="font-normal text-abu-hangat"> +{c.reserved}</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: matriks varian x lokasi. */}
      <div className="hidden overflow-x-auto rounded-xl border border-garis bg-putih md:block" data-testid="matriks-stok">
        <table className="w-full text-sm">
          <thead className="border-b border-garis bg-porselen/70">
            <tr>
              <th className="sticky left-0 bg-porselen px-3 py-2 text-left text-xs font-semibold tracking-wide text-abu-hangat uppercase">Varian</th>
              {m.locations.map((l) => (
                <th key={l.id} className="px-3 py-2 text-right text-xs font-semibold tracking-wide whitespace-nowrap text-abu-hangat uppercase">
                  {l.name}
                  <span className="block text-[10px] font-normal tracking-normal normal-case">tersedia · dipesan</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {m.rows.map((r) => (
              <tr key={r.variantId} className="hover:bg-porselen/50" data-varian={r.sku}>
                <td className="sticky left-0 max-w-72 bg-putih px-3 py-2">
                  <Link href={`/admin/stok/${r.variantId}`} className="flex items-center gap-2.5">
                    <span className="w-8 shrink-0 overflow-hidden rounded-md">
                      <ProductArt packaging={r.packaging} shade={r.hex} brandColor={r.brandColor} brandName={r.brandName} title="" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:underline">{r.productName}</span>
                      <span className="block truncate text-xs text-abu-hangat">
                        {r.shadeName} · {r.sku}
                      </span>
                    </span>
                  </Link>
                </td>
                {m.locations.map((l) => {
                  const c = r.cells[l.id];
                  return (
                    <td key={l.id} className={cn("px-3 py-2 text-right whitespace-nowrap tabular-nums", cellTone(c.available, m.threshold))} data-lokasi={l.slug} data-tersedia={c.available}>
                      <span className="font-semibold">{c.available}</span>
                      <span className="text-xs text-abu-hangat"> · {c.reserved}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.rows.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">Tidak ada varian yang cocok.</p> : null}
      <Pager page={m.page} pageCount={m.pageCount} href={(p) => href({ hal: String(p) })} />
    </>
  );
}

export default function AdminStockPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Content {...props} />
    </Suspense>
  );
}
