import type { Metadata } from "next";
import Link from "next/link";
import { DemoLoginButton } from "@/components/account/demo-login-button";
import { DemoStaffButtons } from "@/components/admin/login-form";
import { DEMO_QUICK_LOGIN } from "@/lib/admin/staff";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Tentang demo" };

const features = [
  { title: "Satu produk, banyak shade", text: "Cushion, foundation, dan lipstick punya pemilih shade dengan swatch warna dan stok per shade." },
  { title: "Stok per cabang", text: "Gudang Online plus tiga toko fiktif di Malang. Ambil di toko kalau stoknya ada." },
  { title: "Rona Advisor", text: "Asisten AI yang hanya merekomendasikan produk yang benar-benar ada di katalog." },
  { title: "Panel admin lengkap", text: "Pesanan, stok, promo, laporan, dan log aktivitas untuk owner dan staf cabang." },
];

export default function AboutDemoPage() {
  return (
    <section className="container-rona max-w-3xl py-10 md:py-16">
      <p className="text-xs font-semibold tracking-wide text-rona uppercase">Tentang demo</p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">
        Rona Beauty adalah toko demo. Semua datanya fiktif.
      </h1>
      <p className="mt-4 text-lg text-abu-hangat">
        Dua belas merek, puluhan produk, ulasan, cabang, dan pesanan di sini dibuat untuk memamerkan apa yang bisa dibangun untuk toko kosmetik
        sungguhan. Tidak ada barang yang dikirim dan tidak ada uang yang berpindah.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription className="mt-2">{f.text}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-10 rounded-card border border-garis bg-putih p-6">
        <h2 className="font-serif text-xl text-kopi">Akun demo</h2>
        <p className="mt-2 text-sm text-abu-hangat">
          {env.demoMode
            ? "Masuk sebagai Pembeli Demo tanpa OTP: akun ini sudah berisi alamat, pesanan di berbagai status, poin, wishlist, dan profil kulit. Panel admin bisa dicoba dari empat sudut pandang: Owner, Admin Online, Staf Cabang Dinoyo, dan Gudang."
            : "Akun demo hanya aktif di mode demo."}{" "}
          Data direset setiap malam supaya demo selalu bersih.
        </p>
        {env.demoMode ? (
          <div className="mt-4 space-y-4">
            <DemoLoginButton className="max-w-xs" />
            <div>
              <p className="mb-2 text-sm font-semibold text-kopi">Masuk ke panel admin sebagai</p>
              <DemoStaffButtons accounts={DEMO_QUICK_LOGIN} compact />
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-10 text-sm text-abu-hangat">
        Dibangun oleh <span className="font-semibold text-kopi">{env.studioName}</span>.{" "}
        <Link href="/" className="font-semibold text-rona hover:underline">
          Kembali ke beranda
        </Link>
      </p>
    </section>
  );
}
