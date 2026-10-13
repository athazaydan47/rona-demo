import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Clock, MapPin, MessageCircleHeart, Sparkles } from "lucide-react";
import type { Packaging } from "@/db/schema/enums";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { ProductCard, ProductCardSkeleton, type CardBadge } from "@/components/product-card";
import { FlashCountdown } from "@/components/flash/flash-countdown";
import { QuotaBar } from "@/components/flash/quota-bar";
import { PriceTag } from "@/components/ui/price-tag";
import { getFlashSlots, getProductCards, getProductCardsForSkinTypes } from "@/lib/catalog/catalog-queries";
import type { ArticleSummary, BrandSummary, CategoryNode, StoreLocation } from "@/lib/catalog/queries";
import { formatDateWib, formatTimeWib } from "@/lib/format";
import { pickFlashSlot } from "@/lib/flash";
import { readableOn } from "@/lib/color";
import { SkinTypeTabs } from "./skin-type-tabs";
import { ScrollRow } from "@/components/ui/scroll-row";
import { now as clockNow } from "@/lib/clock";

export function SectionHeading({ title, subtitle, href, hrefLabel = "Lihat semua" }: { title: string; subtitle?: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 md:mb-5">
      <div className="min-w-0">
        <h2 className="font-serif text-2xl font-medium text-kopi md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-abu-hangat">{subtitle}</p> : null}
      </div>
      {href ? (
        <Button variant="link" asChild className="shrink-0">
          <Link href={href}>
            {hrefLabel} <ArrowRight />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

const categoryArt: Record<string, { packaging: Packaging; shade: string; brand: string; brandName: string }> = {
  skincare: { packaging: "serum_dropper", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  "makeup-wajah": { packaging: "cushion", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  "makeup-mata": { packaging: "mascara", shade: "#1B1818", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
  bibir: { packaging: "lipstick", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  "sun-care": { packaging: "sunscreen_tube", shade: "#FBE7B8", brand: "#E0A227", brandName: "Surya Shield" },
  "body-dan-hair": { packaging: "lotion_pump", shade: "#F3ECE4", brand: "#D98E8E", brandName: "Mekar" },
  fragrance: { packaging: "perfume_bottle", shade: "#E8F0DE", brand: "#7A4E8C", brandName: "Arunika" },
  pria: { packaging: "cream_jar", shade: "#C9B07A", brand: "#2E4057", brandName: "Nara Men" },
};

export function CategoryCircles({ categories }: { categories: CategoryNode[] }) {
  return (
    <section className="container-rona py-7 md:py-14" aria-labelledby="kategori-heading">
      <h2 id="kategori-heading" className="sr-only">
        Kategori
      </h2>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
        {categories.map((c) => {
          const art = categoryArt[c.slug] ?? categoryArt.skincare;
          return (
            <li key={c.id} className="w-24 shrink-0 sm:w-auto">
              <Link href={`/c/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
                <span className="grid size-20 place-items-center overflow-hidden rounded-full border border-garis bg-putih shadow-soft transition-[transform,box-shadow] duration-250 ease-soft group-hover:-translate-y-0.5 group-hover:shadow-lift md:size-28">
                  <span className="w-[82%] translate-y-1">
                    <ProductArt packaging={art.packaging} shade={art.shade} brandColor={art.brand} brandName={art.brandName} background="none" title={`Ilustrasi ${c.name}`} />
                  </span>
                </span>
                <span className="text-xs font-semibold text-kopi group-hover:text-rona-gelap md:text-sm">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Flash sale: slot aktif dengan hitung mundur dan kuota, atau slot berikutnya dengan hitung mundur menuju mulai.
export async function FlashSaleSection() {
  await connection();
  const now = clockNow();
  const slots = await getFlashSlots(now);
  const { active, next } = pickFlashSlot(slots, now);
  const slot = active ?? next;
  if (!slot) return null;
  const isActive = Boolean(active);
  const items = slot.items.slice(0, 6);
  return (
    <section className="bg-kopi text-putih" aria-labelledby="flash-heading">
      <div className="container-rona py-7 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-pill bg-emas/15 px-3 py-1 text-xs font-semibold tracking-wide text-emas uppercase">
              <Sparkles className="size-3.5" /> {isActive ? "Sedang berlangsung" : "Slot berikutnya"}
            </p>
            <h2 id="flash-heading" className="mt-3 font-serif text-3xl font-medium md:text-4xl">
              {slot.name}
            </h2>
            <p className="mt-1 text-sm text-putih/70">
              {formatDateWib(slot.startsAt)}, {formatTimeWib(slot.startsAt).replace(" WIB", "")} sampai {formatTimeWib(slot.endsAt)}
              {next && isActive ? ` · Berikutnya ${formatTimeWib(next.startsAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <FlashCountdown target={(isActive ? slot.endsAt : slot.startsAt).toISOString()} label={isActive ? "Berakhir dalam" : "Mulai dalam"} size="md" className="[&_span.text-sm]:text-putih/70 [&_[role=timer]_span.grid]:bg-putih [&_[role=timer]_span.grid]:text-kopi" />
            <Button variant="secondary" size="sm" asChild>
              <Link href="/flash-sale">
                Semua produk flash sale <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <ul className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 md:mt-8 lg:grid-cols-6">
          {items.map((it) => (
            <li key={it.variantId} className="w-44 shrink-0 snap-start sm:w-auto">
              <Link href={`/p/${it.productSlug}?shade=${encodeURIComponent(it.shadeName)}`} className="group flex h-full flex-col rounded-card bg-putih p-2 text-kopi shadow-soft transition-transform duration-250 ease-soft hover:-translate-y-0.5">
                <div className="overflow-hidden rounded-[12px]">
                  <ProductArt packaging={it.packaging} shade={it.hex} brandColor={it.brandColor} brandName={it.brandName} title={`${it.productName}, ${it.shadeName}`} className="transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="flex flex-1 flex-col gap-1 px-1 pt-2 pb-1">
                  <p className="truncate text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{it.brandName}</p>
                  <p className="line-clamp-2 text-xs leading-4 font-medium">{it.productName}</p>
                  <p className="truncate text-[11px] text-abu-hangat">{it.shadeName}</p>
                  <PriceTag price={it.flashPrice} normalPrice={it.normalPrice} size="sm" className="mt-auto" />
                  <QuotaBar quota={it.quota} sold={it.sold} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AdvisorCta() {
  return (
    <section className="container-rona py-7 md:py-14">
      <ScrollRow ariaLabel="Bantuan memilih produk" desktop="md:grid-cols-2" gap="gap-3 md:gap-4" itemWidth="w-[84vw]">
        <li className="min-w-0">
        <Link href="/kuis-kulit" className="group relative flex h-full flex-col overflow-hidden rounded-card border border-garis bg-[linear-gradient(135deg,#FFFFFF,#F4DCDF)] p-5 shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift md:p-8">
          <p className="text-xs font-semibold tracking-wide text-rona uppercase">Belum tahu cocok yang mana?</p>
          <h3 className="mt-2 font-serif text-2xl text-kopi md:text-3xl">Kuis Kulit 2 menit</h3>
          <p className="mt-2 max-w-sm text-sm text-abu-hangat">Enam pertanyaan bergambar untuk tahu jenis kulit, undertone, dan rutinitas yang pas untukmu.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-rona group-hover:underline">
            Mulai kuis <ArrowRight className="size-4" />
          </span>
          <div className="pointer-events-none absolute -right-6 -bottom-8 w-40 opacity-90 md:w-48">
            <ProductArt packaging="sheet_mask" shade="#BFD8EE" brandColor="#5B8DB8" brandName="Embun" background="none" view="detail" title="" />
          </div>
        </Link>
        </li>
        <li className="min-w-0">
        <Link href="/advisor" className="group relative flex h-full flex-col overflow-hidden rounded-card bg-kopi p-5 text-putih shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift md:p-8">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emas uppercase">
            <MessageCircleHeart className="size-3.5" /> Rona Advisor
          </p>
          <h3 className="mt-2 font-serif text-2xl md:text-3xl">Tanya apa saja soal kulitmu</h3>
          <p className="mt-2 max-w-sm text-sm text-putih/75">&ldquo;Kulitku berminyak dan gampang jerawat, sunscreen apa?&rdquo; Jawabannya hanya dari produk yang ada di katalog kami.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-emas group-hover:underline">
            Coba Advisor <ArrowRight className="size-4" />
          </span>
          <div className="pointer-events-none absolute -right-4 -bottom-10 w-36 opacity-95 md:w-44">
            <ProductArt packaging="serum_dropper" shade="#D9EBE7" brandColor="#2F5D62" brandName="Kirana Lab" background="none" view="detail" title="" />
          </div>
        </Link>
        </li>
      </ScrollRow>
    </section>
  );
}

export async function ProductRow({ title, subtitle, href, sort, limit = 8, hideBadges }: { title: string; subtitle?: string; href: string; sort: "terlaris" | "terbaru"; limit?: number; hideBadges?: CardBadge[] }) {
  const products = await getProductCards({ kind: "all" }, sort, limit);
  return (
    <section className="container-rona py-7 md:py-14">
      <SectionHeading title={title} subtitle={subtitle} href={href} />
      <ScrollRow ariaLabel={title} desktop="md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} hideBadges={hideBadges} />
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}

export function ProductRowSkeleton({ title, count = 8 }: { title: string; count?: number }) {
  return (
    <section className="container-rona py-7 md:py-14" aria-busy>
      <SectionHeading title={title} />
      <ScrollRow ariaLabel={title} desktop="md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}

export async function SkinTypeSection() {
  const data = await getProductCardsForSkinTypes(4);
  return (
    <section className="container-rona py-7 md:py-14">
      <SectionHeading title="Pilihan per jenis kulit" subtitle="Produk terlaris yang cocok untuk jenis kulitmu." />
      <SkinTypeTabs data={data} />
    </section>
  );
}

export function BrandShowcase({ brands }: { brands: BrandSummary[] }) {
  return (
    <section className="container-rona py-7 md:py-14">
      <SectionHeading title="Etalase merek" subtitle="Dua belas merek fiktif, masing-masing punya karakter sendiri." href="/merek" hrefLabel="Semua merek" />
      <ScrollRow ariaLabel="Etalase merek" desktop="md:grid-cols-4 lg:grid-cols-6" itemWidth="w-[40vw]">
        {brands.map((b) => (
          <li key={b.id} className="min-w-0">
            <Link
              href={`/merek/${b.slug}`}
              className="group flex h-full flex-col rounded-card border border-garis bg-putih p-3 shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift"
              style={{ ["--brand" as string]: b.color }}
            >
              <div className="relative flex h-20 items-end justify-center overflow-hidden rounded-[12px] md:h-24" style={{ background: `linear-gradient(160deg, ${b.color}22, ${b.color}08)` }}>
                <span className="absolute top-2 left-2 grid size-8 place-items-center rounded-full font-serif text-sm text-putih shadow-soft" style={{ backgroundColor: b.color, color: brandTextColor(b.color) }} aria-hidden>
                  {b.name[0]}
                </span>
                {b.topProduct ? (
                  <div className="w-[62%] translate-y-2">
                    <ProductArt packaging={b.topProduct.packaging} shade={b.topProduct.hex} brandColor={b.color} brandName={b.name} background="none" title={`${b.topProduct.name}, produk terlaris ${b.name}`} />
                  </div>
                ) : null}
              </div>
              <span className="mt-3 font-serif text-lg leading-tight text-kopi transition-colors group-hover:text-[var(--brand)]">{b.name}</span>
              <span className="mt-0.5 truncate text-[11px] text-abu-hangat">{b.tagline}</span>
              <span className="mt-1 text-xs font-semibold text-abu-hangat tabular-nums">{b.productCount} produk</span>
            </Link>
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}

export function JournalSection({ articles }: { articles: ArticleSummary[] }) {
  return (
    <section className="container-rona py-7 md:py-14">
      <SectionHeading title="Jurnal Rona" subtitle="Tips singkat dari tim kami." href="/jurnal" hrefLabel="Semua artikel" />
      <ScrollRow ariaLabel="Jurnal Rona" desktop="md:grid-cols-3" gap="gap-3 md:gap-4" itemWidth="w-[76vw]">
        {articles.slice(0, 3).map((a, i) => (
          <li key={a.id} className="min-w-0">
            <Link href={`/jurnal/${a.slug}`} className="group flex h-full flex-col rounded-card border border-garis bg-putih shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift">
              <div className={`flex h-28 items-end justify-center overflow-hidden rounded-t-card md:h-36 ${["bg-[linear-gradient(135deg,#F4DCDF,#FAF7F5)]", "bg-[linear-gradient(135deg,#E3EEDF,#FAF7F5)]", "bg-[linear-gradient(135deg,#FBE7B8,#FAF7F5)]"][i % 3]}`}>
                <div className="w-24 translate-y-3">
                  <ProductArt packaging={(["cushion", "sunscreen_tube", "lip_tint"] as const)[i % 3]} shade={["#DAB085", "#FBE7B8", "#E2654A"][i % 3]} brandColor={["#B98A6A", "#E0A227", "#C2416B"][i % 3]} brandName={["Pualam", "Surya Shield", "Lumi"][i % 3]} background="none" title="" />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs text-abu-hangat">{a.publishedAt ? formatDateWib(a.publishedAt) : ""}</p>
                <h3 className="mt-1 font-serif text-xl leading-snug text-kopi group-hover:text-rona-gelap">{a.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-abu-hangat">{a.excerpt}</p>
              </div>
            </Link>
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}

export function StoresSection({ locations }: { locations: StoreLocation[] }) {
  const stores = locations.filter((l) => l.type === "toko");
  return (
    <section className="container-rona pt-8 md:pt-14">
      <div className="rounded-card bg-blush/60 p-5 md:p-8">
        <SectionHeading title="Ambil hari ini di toko terdekat" subtitle="Pesan sebelum 16.00 WIB, ambil di cabang yang stoknya ada." href="/toko" hrefLabel="Lihat peta" />
        <ScrollRow ariaLabel="Cabang Rona" desktop="md:grid-cols-3" gap="gap-3" itemWidth="w-[70vw]">
          {stores.map((s) => (
            <li key={s.id} className="min-w-0 rounded-card border border-garis bg-putih p-4">
              <p className="font-serif text-lg text-kopi">{s.name}</p>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-abu-hangat">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {s.address}, {s.district}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-abu-hangat">
                <Clock className="size-3.5 shrink-0" aria-hidden /> {s.hoursLabel} WIB
              </p>
            </li>
          ))}
        </ScrollRow>
      </div>
    </section>
  );
}

export function brandTextColor(hex: string) {
  return readableOn(hex);
}
