import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Bell, Heart, MapPin, Package, Sparkles, SunMedium } from "lucide-react";
import { AccountNav } from "@/components/account/account-nav";
import { LogoutButton } from "@/components/account/logout-buttons";
import { OrderCard } from "@/components/account/order-card";
import { AccountSkeleton } from "@/components/account/page-head";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { unreadCount } from "@/lib/account/notifications";
import { ACTIVE_STATUSES, listCustomerOrders } from "@/lib/account/orders";
import { getProfile } from "@/lib/account/profile";
import { wishlistIds } from "@/lib/account/wishlist";
import { now } from "@/lib/clock";
import { formatNumber, formatRupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Ringkasan" };

function greeting(hourWib: number) {
  if (hourWib < 11) return "Selamat pagi";
  if (hourWib < 15) return "Selamat siang";
  if (hourWib < 18) return "Selamat sore";
  return "Selamat malam";
}

async function Summary() {
  await connection();
  const me = await requireCustomer("/akun");
  const [profile, active, unread, wishes] = await Promise.all([
    getProfile(db, me.customerId),
    listCustomerOrders(db, me.customerId, { statuses: ACTIVE_STATUSES, pageSize: 3 }),
    unreadCount(db, me.customerId),
    wishlistIds(db, me.customerId),
  ]);
  const hour = (now().getUTCHours() + 7) % 24;
  const shortcuts = [
    { href: "/akun/pesanan", label: "Pesanan", icon: Package, note: `${active.total} aktif` },
    { href: "/akun/notifikasi", label: "Notifikasi", icon: Bell, note: unread ? `${unread} belum dibaca` : "Semua terbaca" },
    { href: "/akun/wishlist", label: "Wishlist", icon: Heart, note: `${wishes.length} produk` },
    { href: "/akun/alamat", label: "Alamat", icon: MapPin, note: "Atur alamat kirim" },
    { href: "/akun/profil-kulit", label: "Profil kulit", icon: SunMedium, note: profile?.skinProfile?.skinType ? `Kulit ${profile.skinProfile.skinType}` : "Belum diisi" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-abu-hangat">{greeting(hour)},</p>
        <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">Halo, {me.name.split(" ")[0]}!</h1>
      </div>

      <Link href="/akun/poin" className="block rounded-card bg-kopi p-5 text-putih shadow-soft transition-transform hover:-translate-y-0.5" data-testid="kartu-poin">
        <p className="flex items-center gap-2 text-sm text-putih/80">
          <Sparkles className="size-4 text-emas" aria-hidden /> Poin Rona
        </p>
        <p className="mt-1 font-serif text-4xl tabular-nums" data-testid="saldo-poin">
          {formatNumber(profile?.points ?? 0)}
        </p>
        <p className="mt-1 text-sm text-putih/80">Senilai {formatRupiah(profile?.points ?? 0)} untuk belanja berikutnya.</p>
      </Link>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-kopi">Pesanan aktif</h2>
          <Link href="/akun/pesanan" className="text-sm font-semibold text-rona hover:underline">
            Semua pesanan
          </Link>
        </div>
        {active.orders.length ? (
          <div className="space-y-3">
            {active.orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-garis bg-putih p-5 text-sm text-abu-hangat">Tidak ada pesanan yang sedang berjalan.</p>
        )}
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-5">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-card border border-garis bg-putih p-4 transition-colors hover:border-kopi/25">
            <s.icon className="size-5 text-rona" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-kopi">{s.label}</p>
            <p className="text-xs text-abu-hangat">{s.note}</p>
          </Link>
        ))}
      </div>

      <div className="md:hidden">
        <AccountNav variant="list" />
        <LogoutButton className="mt-3 w-full" />
      </div>
    </div>
  );
}

export default function AkunPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Summary />
    </Suspense>
  );
}
