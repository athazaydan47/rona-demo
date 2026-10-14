import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Gift, ShoppingBag, Sparkles, Undo2 } from "lucide-react";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { getProfile } from "@/lib/account/profile";
import { formatDateTimeWib, formatNumber, formatRupiah } from "@/lib/format";
import { ledgerFor } from "@/lib/points";
import { cn } from "@/lib/utils";
import { fiturAktif } from "@/config/fitur";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Poin" };

async function Points() {
  await connection();
  const me = await requireCustomer("/akun/poin");
  const [profile, ledger] = await Promise.all([getProfile(db, me.customerId), ledgerFor(db, me.customerId, 50)]);
  const balance = profile?.points ?? 0;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <div className="rounded-card bg-kopi p-6 text-putih shadow-soft">
          <p className="flex items-center gap-2 text-sm text-putih/80">
            <Sparkles className="size-4 text-emas" aria-hidden /> Saldo poin
          </p>
          <p className="mt-1 font-serif text-5xl tabular-nums" data-testid="saldo-poin">
            {formatNumber(balance)}
          </p>
          <p className="mt-1 text-sm text-putih/80">Senilai {formatRupiah(balance)}. 1 poin = Rp 1 saat checkout.</p>
        </div>
        <div className="rounded-card border border-garis bg-putih p-5">
          <h2 className="font-serif text-xl text-kopi">Riwayat poin</h2>
          {ledger.length ? (
            <ul className="mt-3 divide-y divide-garis" data-testid="riwayat-poin">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm text-kopi">{l.reason}</span>
                    <span className="block text-xs text-abu-hangat">{formatDateTimeWib(l.createdAt)}</span>
                  </span>
                  <span className={cn("shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums", l.amount >= 0 ? "text-sukses" : "text-bahaya")}>
                    {l.amount >= 0 ? "+" : ""}
                    {formatNumber(l.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-abu-hangat">Belum ada riwayat. Poin pertama datang dari pesanan yang selesai.</p>
          )}
        </div>
      </div>
      <aside className="space-y-3 rounded-card border border-garis bg-putih p-5 text-sm lg:self-start">
        <h2 className="font-serif text-xl text-kopi">Cara kerja poin</h2>
        <p className="flex gap-2 text-kopi/90">
          <ShoppingBag className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden /> Dapat 1 poin per Rp 1.000 belanja bersih (setelah diskon, voucher, dan poin, tanpa ongkir), masuk saat pesanan selesai.
        </p>
        <p className="flex gap-2 text-kopi/90">
          <Gift className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden /> Ulasan pertamamu dapat bonus 50 poin.
        </p>
        <p className="flex gap-2 text-kopi/90">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden /> Tukar di checkout: 1 poin = Rp 1, maksimal 50% dari belanja setelah voucher.
        </p>
        <p className="flex gap-2 text-kopi/90">
          <Undo2 className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden /> Poin yang dipakai kembali bila pesanan batal. Poin dari pesanan yang diretur ditarik lagi.
        </p>
      </aside>
    </div>
  );
}

export default function PoinPage() {
  // Fitur dimatikan di src/config/fitur.ts: halaman ini tidak ada.
  if (!fiturAktif("poin")) notFound();
  return (
    <>
      <AccountPageHead title="Poin" />
      <Suspense fallback={<AccountSkeleton />}>
        <Points />
      </Suspense>
    </>
  );
}
