import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CopyForWa, RegenerateBrief } from "@/components/admin/kabar-parts";
import { Denied, PageHead, Skeleton } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { can } from "@/lib/admin/permissions";
import { aiTersedia } from "@/lib/ai";
import { now } from "@/lib/clock";
import { formatDateTimeWib } from "@/lib/format";
import { briefWaText, listBriefs, type BriefData } from "@/lib/kabar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kabar Harian" };

type SP = { hari?: string };

// Kabar Harian untuk owner: riwayat 14 hari, pratinjau gelembung WA, dan tombol Salin untuk WA.
async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const sp = await searchParams;
  const me = await requireStaff("/admin/kabar");
  if (!can(me, "laporan.keuangan")) return <Denied />;
  const list = await listBriefs(db, now());
  const selected = list.find((b) => b.day === sp.hari) ?? list[0];
  return (
    <>
      <PageHead title="Kabar Harian" description="Ringkasan hari kemarin yang dibuat setiap pagi: omzet, terlaris, stok menipis, pesanan bermasalah, ulasan buruk, dan saran transfer. Angka dari fungsi laporan yang sama dengan halaman Laporan.">
        {aiTersedia() ? <RegenerateBrief /> : null}
      </PageHead>
      {!selected ? (
        <p className="rounded-xl border border-garis bg-putih p-6 text-sm text-abu-hangat">Belum ada Kabar Harian. Kabar dibuat otomatis oleh cron harian.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Riwayat Kabar Harian" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {list.map((b) => {
              const d = b.data as unknown as BriefData;
              return (
                <Link key={b.day} href={`/admin/kabar?hari=${b.day}`} aria-current={b.day === selected.day ? "page" : undefined} className={cn("shrink-0 rounded-lg border px-3 py-2 text-sm", b.day === selected.day ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih hover:border-kopi/30")} data-testid="kabar-hari">
                  <span className="block font-semibold">{d.hari}</span>
                  <span className={cn("text-xs", b.day === selected.day ? "text-putih/80" : "text-abu-hangat")}>{b.source === "ai" ? "Narasi AI" : "Templat"}</span>
                </Link>
              );
            })}
          </nav>
          <section className="space-y-3" data-testid="kabar-terpilih">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected.source === "ai" ? "baru" : "netral"}>{selected.source === "ai" ? `Narasi AI (${selected.model})` : "Narasi templat"}</Badge>
              <span className="text-xs text-abu-hangat">Dibuat {formatDateTimeWib(selected.createdAt)}</span>
            </div>
            <div className="rounded-2xl bg-[#E9E4DC] p-4 sm:p-6" aria-label="Pratinjau pesan WhatsApp">
              <div className="ml-auto max-w-xl rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3 text-sm whitespace-pre-line text-[#1F2C34] shadow-sm" data-testid="gelembung-wa">
                {briefWaText(selected.data as unknown as BriefData, selected.narrative)}
                <span className="mt-1 block text-right text-[10px] text-[#4b5b62]">07.00</span>
              </div>
            </div>
            <CopyForWa text={briefWaText(selected.data as unknown as BriefData, selected.narrative)} />
            <p className="text-xs text-abu-hangat">Kabar juga masuk antrean WA hanya untuk nomor owner di Pengaturan, Profil toko. Di mode demo pesannya berupa pratinjau di Notifikasi keluar.</p>
          </section>
        </div>
      )}
    </>
  );
}

export default function KabarPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
