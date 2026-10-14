import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { FlashCountdown } from "@/components/flash/flash-countdown";
import { QuotaBar } from "@/components/flash/quota-bar";
import { ProductArt } from "@/components/product-art";
import { PriceTag } from "@/components/ui/price-tag";
import { Badge } from "@/components/ui/badge";
import { getFlashSlots, type FlashSlotData } from "@/lib/catalog/catalog-queries";
import { formatDateWib, formatTimeWib } from "@/lib/format";
import { pickFlashSlot } from "@/lib/flash";
import { now as clockNow } from "@/lib/clock";
import { fiturAktif } from "@/config/fitur";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Flash Sale", description: "Slot flash sale yang sedang berjalan dan berikutnya." };

function SlotItems({ slot, live }: { slot: FlashSlotData; live: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
      {slot.items.map((it) => (
        <li key={it.variantId}>
          <Link href={`/p/${it.productSlug}?shade=${encodeURIComponent(it.shadeName)}`} className="group flex h-full flex-col rounded-card border border-garis bg-putih p-2 shadow-soft transition-transform duration-250 ease-soft hover:-translate-y-0.5">
            <div className="relative overflow-hidden rounded-[12px]">
              <ProductArt packaging={it.packaging} shade={it.hex} brandColor={it.brandColor} brandName={it.brandName} title={`${it.productName}, ${it.shadeName}`} className="transition-transform duration-300 group-hover:scale-[1.03]" />
              {live ? <Badge variant="flash" className="absolute top-2 left-2">Flash Sale</Badge> : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 px-1 pt-2 pb-1">
              <p className="truncate text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{it.brandName}</p>
              <p className="line-clamp-2 text-xs leading-4 font-medium text-kopi">{it.productName}</p>
              <p className="truncate text-[11px] text-abu-hangat">{it.shadeName}</p>
              <PriceTag price={it.flashPrice} normalPrice={it.normalPrice} size="sm" className="mt-auto" />
              {live ? <QuotaBar quota={it.quota} sold={it.sold} /> : <p className="text-[11px] text-abu-hangat tabular-nums">Kuota {it.quota}, maks {it.maxPerCustomer} per pembeli</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function FlashSaleContent() {
  await connection();
  const now = clockNow();
  const slots = await getFlashSlots(now);
  const { active, next } = pickFlashSlot(slots, now);
  const upcoming = slots.filter((s) => s.startsAt.getTime() > now.getTime() && s.id !== next?.id);
  return (
    <div className="container-toko py-6 md:py-8">
      <Breadcrumb items={[{ label: "Flash Sale" }]} className="mb-3" />
      <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">Flash Sale</h1>
      <p className="mt-2 max-w-2xl text-sm text-abu-hangat md:text-base">Dua slot setiap hari, 12.00 sampai 14.00 dan 20.00 sampai 22.00 WIB. Kuota terbatas, maksimal 2 per pembeli per produk.</p>

      {active ? (
        <section className="mt-8 rounded-card bg-kopi p-5 text-putih md:p-7" aria-labelledby="slot-aktif">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emas uppercase">
                <Sparkles className="size-3.5" /> Sedang berlangsung
              </p>
              <h2 id="slot-aktif" className="mt-1 font-serif text-2xl md:text-3xl">
                {active.name}
              </h2>
              <p className="text-sm text-putih/70">Sampai {formatTimeWib(active.endsAt)}</p>
            </div>
            <FlashCountdown target={active.endsAt.toISOString()} label="Berakhir dalam" className="[&_span.text-sm]:text-putih/70 [&_[role=timer]_span.grid]:bg-putih [&_[role=timer]_span.grid]:text-kopi" />
          </div>
          <div className="mt-5 rounded-card bg-putih/5 p-3">
            <SlotItems slot={active} live />
          </div>
        </section>
      ) : null}

      {next ? (
        <section className="mt-8" aria-labelledby="slot-berikut">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-aksen uppercase">Slot berikutnya</p>
              <h2 id="slot-berikut" className="mt-1 font-serif text-2xl text-kopi md:text-3xl">
                {next.name}
              </h2>
              <p className="text-sm text-abu-hangat">
                {formatDateWib(next.startsAt)}, {formatTimeWib(next.startsAt).replace(" WIB", "")} sampai {formatTimeWib(next.endsAt)}
              </p>
            </div>
            <FlashCountdown target={next.startsAt.toISOString()} label="Mulai dalam" />
          </div>
          <div className="mt-5">
            <SlotItems slot={next} live={false} />
          </div>
        </section>
      ) : null}

      {!active && !next ? <p className="mt-8 rounded-card border border-dashed border-garis bg-putih p-8 text-center text-abu-hangat">Belum ada slot flash sale yang dijadwalkan. Cek lagi nanti ya.</p> : null}

      {upcoming.length > 0 ? (
        <section className="mt-10" aria-labelledby="slot-jadwal">
          <h2 id="slot-jadwal" className="font-serif text-xl text-kopi">
            Jadwal berikutnya
          </h2>
          <ul className="mt-3 divide-y divide-garis rounded-card border border-garis bg-putih">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-kopi">{s.name}</span>
                <span className="text-abu-hangat tabular-nums">
                  {formatDateWib(s.startsAt)}, {formatTimeWib(s.startsAt).replace(" WIB", "")} sampai {formatTimeWib(s.endsAt)} · {s.items.length} produk
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function FlashSalePage() {
  // Fitur dimatikan di src/config/fitur.ts: halaman ini tidak ada.
  if (!fiturAktif("flashSale")) notFound();
  return (
    <Suspense
      fallback={
        <div className="container-toko py-8" aria-busy>
          <div className="h-10 w-48 animate-pulse rounded bg-garis/70" />
          <div className="mt-8 h-[460px] animate-pulse rounded-card bg-kopi/90" />
        </div>
      }
    >
      <FlashSaleContent />
    </Suspense>
  );
}
