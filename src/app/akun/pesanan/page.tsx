import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { OrderCard } from "@/components/account/order-card";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { listCustomerOrders, ORDER_TABS } from "@/lib/account/orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pesanan" };

type Props = { searchParams: Promise<{ tab?: string; hal?: string }> };

async function Orders({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const me = await requireCustomer("/akun/pesanan");
  const page = Math.max(1, Number.parseInt(sp.hal ?? "1", 10) || 1);
  const r = await listCustomerOrders(db, me.customerId, { tab: sp.tab, page });
  const href = (tab: string, hal = 1) => `/akun/pesanan?${new URLSearchParams({ ...(tab !== "semua" ? { tab } : {}), ...(hal > 1 ? { hal: String(hal) } : {}) })}`;
  return (
    <>
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Status pesanan">
        <ul className="flex gap-2">
          {ORDER_TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={href(t.key)}
                aria-current={r.tab === t.key ? "page" : undefined}
                className={cn("inline-flex h-9 items-center rounded-pill border px-4 text-sm whitespace-nowrap transition-colors", r.tab === t.key ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi hover:border-kopi/30")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {r.orders.length ? (
        <div className="space-y-3">
          {r.orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-garis bg-putih p-8 text-center">
          <p className="font-serif text-xl text-kopi">Belum ada pesanan di sini</p>
          <Button asChild className="mt-4">
            <Link href="/c/semua">Mulai belanja</Link>
          </Button>
        </div>
      )}
      {r.pageCount > 1 ? (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Halaman pesanan">
          {r.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(r.tab, r.page - 1)}>Sebelumnya</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-abu-hangat tabular-nums">
            Halaman {r.page} dari {r.pageCount}
          </span>
          {r.page < r.pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(r.tab, r.page + 1)}>Berikutnya</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default function PesananAkunPage(props: Props) {
  return (
    <>
      <AccountPageHead title="Pesanan" description="Semua pesanan yang terhubung ke nomor WhatsApp akunmu." />
      <Suspense fallback={<AccountSkeleton />}>
        <Orders {...props} />
      </Suspense>
    </>
  );
}
