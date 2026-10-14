import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Lock } from "lucide-react";
import { LoginFlow } from "@/components/account/login-flow";
import { currentCustomer } from "@/lib/auth/current";
import { loginAvailability } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Masuk", robots: { index: false } };

type Props = { searchParams: Promise<{ kembali?: string; keluar?: string }> };

function safeReturn(raw: string | undefined) {
  const v = raw ?? "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.startsWith("/masuk") || v.length > 300) return "/akun";
  return v;
}

async function LoginContent({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const kembali = safeReturn(sp.kembali);
  const me = await currentCustomer();
  if (me && me.name.trim()) redirect(kembali);
  const availability = await loginAvailability();
  if (!availability.available) {
    return (
      <div className="rounded-card border border-garis bg-putih p-6 md:p-8">
        <Lock className="size-8 text-aksen" aria-hidden />
        <h1 className="mt-3 font-serif text-3xl text-kopi">Masuk belum tersedia</h1>
        <p className="mt-2 text-sm text-abu-hangat">
          Masuk dengan WhatsApp belum diaktifkan di situs ini. Kamu tetap bisa belanja sebagai tamu dan melacak pesanan dengan nomor pesanan dan nomor WhatsApp.
        </p>
      </div>
    );
  }
  return (
    <>
      {sp.keluar === "semua" ? (
        <p className="mb-4 rounded-card bg-[#E5F2EA] px-4 py-3 text-sm text-sukses" role="status">
          Kamu sudah keluar dari semua perangkat.
        </p>
      ) : null}
      <LoginFlow kembali={kembali} demo={availability.demo} initialStep={me ? "nama" : "nomor"} />
    </>
  );
}

export default function MasukPage(props: Props) {
  return (
    <section className="container-toko max-w-md py-10 md:py-16">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-garis/50" aria-busy />}>
        <LoginContent {...props} />
      </Suspense>
    </section>
  );
}
