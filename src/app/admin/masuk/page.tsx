import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DemoStaffButtons, StaffLoginForm } from "@/components/admin/login-form";
import { currentStaff } from "@/lib/admin/current";
import { DEMO_QUICK_LOGIN } from "@/lib/admin/staff";
import { env } from "@/lib/env";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Masuk staf" };

type Props = { searchParams: Promise<{ kembali?: string; reset?: string }> };

function safeReturn(v?: string) {
  return v && v.startsWith("/admin") && !v.startsWith("/admin/masuk") && !v.includes("//") ? v : "/admin";
}

async function Content({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const kembali = safeReturn(sp.kembali);
  if (await currentStaff()) redirect(kembali);
  return (
    <>
      {sp.reset ? (
        <p className="mb-4 rounded-lg bg-[#E5F2EA] px-4 py-3 text-sm text-sukses" role="status">
          Data demo sudah direset. Semua sesi ikut keluar, silakan masuk lagi.
        </p>
      ) : null}
      <StaffLoginForm kembali={kembali} />
      {env.demoMode ? (
        <div className="mt-6 border-t border-garis pt-5">
          <p className="mb-3 text-sm font-semibold text-kopi">Masuk cepat akun demo</p>
          <DemoStaffButtons accounts={DEMO_QUICK_LOGIN} kembali={kembali} />
          <p className="mt-3 text-xs text-abu-hangat">Akun demo terkunci dari perubahan kata sandi dan nonaktif, supaya pengunjung berikutnya tetap bisa mencoba.</p>
        </div>
      ) : null}
    </>
  );
}

export default function StaffLoginPage(props: Props) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-baseline justify-center gap-2">
          <span className="font-serif text-3xl text-kopi">{MEREK.nama}</span>
          <span className="text-[10px] font-bold tracking-[0.24em] text-aksen uppercase">Admin</span>
        </Link>
        <div className="rounded-card border border-garis bg-putih p-6 shadow-soft">
          <h1 className="font-serif text-2xl text-kopi">Masuk staf</h1>
          <p className="mt-1 mb-5 text-sm text-abu-hangat">Khusus tim toko. Pembeli masuk lewat halaman akun.</p>
          <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-garis/40" />}>
            <Content {...props} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
