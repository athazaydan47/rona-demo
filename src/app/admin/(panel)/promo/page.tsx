import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { FlashManager } from "@/components/admin/promo-flash";
import { BannerManager, PromoBarEditor, VariantPromoManager, VoucherManager } from "@/components/admin/promo-others";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { flashCalendar, listBanners, listVariantPromos, listVouchers, searchPromoVariants } from "@/lib/admin/promo";
import { flashDraftHref, flashSuggestions, type FlashSuggestion } from "@/lib/flash/saran";
import { formatRupiah } from "@/lib/format";
import { listBrands, rootCategories } from "@/lib/admin/taxonomy";
import { now } from "@/lib/clock";
import { toWibInput, toWibParts, wibDate } from "@/lib/format";
import { storageKind } from "@/lib/reviews/storage";
import { loadSettings } from "@/lib/settings/db";
import { cn } from "@/lib/utils";
import { fiturAktif } from "@/config/fitur";

export const metadata: Metadata = { title: "Promo" };

const SEMUA_TAB = [
  { key: "flash", label: "Flash sale" },
  { key: "harga", label: "Harga promo" },
  { key: "voucher", label: "Voucher" },
  { key: "banner", label: "Banner dan PromoBar" },
] as const;
type Tab = (typeof SEMUA_TAB)[number]["key"];
// Tab Flash sale tersembunyi bila fiturnya dimatikan (src/config/fitur.ts).
const TABS = SEMUA_TAB.filter((t) => t.key !== "flash" || fiturAktif("flashSale"));
type SP = { tab?: string; minggu?: string; slot?: string; dibuat?: string; draf?: string };

// Senin 00.00 WIB dari minggu yang memuat tanggal tertentu.
function mondayOf(date: Date) {
  const p = toWibParts(date);
  const back = (p.weekday + 6) % 7;
  return wibDate(p.year, p.month, p.day - back);
}

// Saran flash sale (deterministik, src/lib/flash/saran.ts). "Tambahkan ke slot" hanya mengisi formulir item.
function FlashSuggestionList({ items, windowDays }: { items: FlashSuggestion[]; windowDays: number }) {
  if (!items.length) return null;
  return (
    <section className="mb-4 rounded-xl border border-garis bg-putih p-4" data-testid="saran-flash">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-kopi">Saran flash sale</h2>
        <p className="text-xs text-abu-hangat">Lambat laku {windowDays} hari terakhir, stok online banyak, rating baik, belum ikut flash sale.</p>
      </div>
      <ul className="divide-y divide-garis">
        {items.map((s) => (
          <li key={s.variantId} className="flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-kopi">
                {s.productName} · {s.shadeName}: {formatRupiah(s.flashPrice)} ({s.discountPercent}% dari {formatRupiah(s.normalPrice)}), kuota {s.quota}
              </p>
              <p className="text-xs text-abu-hangat">{s.alasan}</p>
            </div>
            <Link href={flashDraftHref(s)} className="inline-flex h-9 shrink-0 items-center rounded-pill border border-garis px-3 text-sm font-semibold hover:border-kopi/40" data-testid="tambah-ke-slot">
              Tambahkan ke slot
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const me = await requireStaff("/admin/promo");
  if (!can(me, "promo.kelola")) return <Denied />;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : TABS[0].key;
  const at = now();
  const nowIso = at.toISOString();

  let body: React.ReactNode;
  if (tab === "flash") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sp.minggu ?? "");
    const weekStart = mondayOf(m ? wibDate(Number(m[1]), Number(m[2]), Number(m[3]), 12) : at);
    const slots = await flashCalendar(db, weekStart);
    const tomorrow = toWibInput(new Date(at.getTime() + 86_400_000)).slice(0, 10);
    const initialSlot = Number.parseInt(sp.slot ?? "", 10) || null;
    // Draf dari saran flash sale: "draf=varianId:hargaFlash:kuota".
    const d = /^(\d+):(\d+):(\d+)$/.exec(sp.draf ?? "");
    const [dv] = d ? await searchPromoVariants(db, "", 1, { ids: [Number(d[1])] }) : [];
    const suggestion = d && dv ? { variant: dv, flashPrice: Number(d[2]), quota: Math.min(10_000, Number(d[3])), param: sp.draf! } : null;
    const flashSettings = (await loadSettings(db)).saran;
    const saran = await flashSuggestions(db, { now: at, minDiscount: flashSettings.flashDiskonMin, maxDiscount: flashSettings.flashDiskonMaks, limit: 5 });
    body = (
      <>
        <FlashSuggestionList items={saran.suggestions} windowDays={saran.windowDays} />
        <FlashManager key={`${weekStart.toISOString()}:${initialSlot ?? ""}:${sp.draf ?? ""}`} suggestion={suggestion} initialSlot={initialSlot} justCreated={sp.dibuat === "1"} weekStart={weekStart.toISOString()} nowIso={nowIso} defaultDate={tomorrow} slots={slots.map((s) => ({ id: s.id, name: s.name, source: s.source, isActive: s.isActive, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), items: s.items }))} />
      </>
    );
  } else if (tab === "harga") {
    const rows = await listVariantPromos(db, at);
    body = <VariantPromoManager rows={rows.map((r) => ({ ...r, promoStartsAt: r.promoStartsAt?.toISOString() ?? null, promoEndsAt: r.promoEndsAt?.toISOString() ?? null }))} />;
  } else if (tab === "voucher") {
    const [vouchers, brands, cats] = await Promise.all([listVouchers(db), listBrands(db), rootCategories(db)]);
    body = <VoucherManager nowIso={nowIso} brands={brands.map((b) => ({ id: b.id, name: b.name }))} categories={cats} vouchers={vouchers.map((v) => ({ id: v.id, code: v.code, title: v.title, description: v.description, type: v.type, value: v.value, maxDiscount: v.maxDiscount, minSpend: v.minSpend, startsAt: v.startsAt.toISOString(), endsAt: v.endsAt.toISOString(), quota: v.quota, quotaPerCustomer: v.quotaPerCustomer, used: v.used, scope: v.scope, stackWithFlash: v.stackWithFlash, isActive: v.isActive, isPublic: v.isPublic, redeemed: v.redeemed, totalDiscount: v.totalDiscount, remaining: v.remaining }))} />;
  } else {
    const [banners, settings] = await Promise.all([listBanners(db), loadSettings(db)]);
    body = (
      <div className="space-y-6">
        <BannerManager nowIso={nowIso} photosEnabled={storageKind() !== "nonaktif"} banners={banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, href: b.href, imageUrl: b.imageUrl, art: b.art, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null, sortOrder: b.sortOrder, isActive: b.isActive }))} />
        <PromoBarEditor messages={settings.promoBar} />
      </div>
    );
  }

  return (
    <>
      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-garis bg-putih p-1 text-sm" role="tablist" aria-label="Bagian promo">
        {TABS.map((t) => (
          <Link key={t.key} role="tab" aria-selected={tab === t.key} href={`/admin/promo?tab=${t.key}`} className={cn("shrink-0 rounded-md px-3 py-1.5 font-medium", tab === t.key ? "bg-kopi text-putih" : "text-kopi hover:bg-porselen")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}

export default function PromoPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHead title="Promo" description="Flash sale, harga promo, voucher, dan banner beranda. Semua perubahan dicatat di log." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
