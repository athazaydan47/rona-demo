import type { Metadata } from "next";
import Link from "next/link";
import { Bot, LayoutDashboard, MessageCircle, ShoppingBag } from "lucide-react";
import { DemoLoginButton } from "@/components/account/demo-login-button";
import { DemoStaffButtons } from "@/components/admin/login-form";
import { OpenGuideButton } from "@/components/demo/open-guide-button";
import { Button } from "@/components/ui/button";
import { DEMO_QUICK_LOGIN } from "@/lib/admin/staff";
import { env } from "@/lib/env";
import { MEREK } from "@/config/merek";
import { fiturAktif, type Fitur } from "@/config/fitur";

export const metadata: Metadata = { title: "Tentang demo", description: `${MEREK.namaLengkap} adalah toko kosmetik demo: etalase fitur toko, panel admin, dan AI yang bisa dibangun untuk toko kosmetik sungguhan.` };

type Feature = { title: string; text: string; href: string; fitur?: Fitur };
const GROUPS: { key: string; label: string; icon: typeof ShoppingBag; intro: string; items: Feature[] }[] = [
  {
    key: "pembeli",
    label: "Untuk pembeli",
    icon: ShoppingBag,
    intro: "Alur belanja lengkap di HP dan laptop, dengan harga, stok, dan ongkir yang selalu dihitung di server.",
    items: [
      { title: "Shade yang pas", text: "Pemilih shade dengan swatch, stok per shade, Shade Finder, dan padanan shade dari produk yang kamu pakai.", href: "/p/pualam-velvet-matte-cushion-spf-50" },
      { title: "Pencarian tahan salah ketik", text: "Ketik \"cusion\", hasilnya tetap cushion. Filter jenis kulit, masalah kulit, harga, dan merek.", href: "/cari?q=cusion" },
      { title: "Stok per cabang dan Ambil di Toko", text: "Gudang Online plus tiga toko fiktif di Malang. Checkout bisa Ambil di Toko dengan Bayar di Toko.", href: "/toko" , fitur: "multiCabang"},
      { title: "Flash sale dan promo", text: "Hitung mundur, kuota per slot, voucher, dan gratis ongkir dengan aturan yang dihitung ulang di server.", href: "/flash-sale" , fitur: "flashSale"},
      { title: "Akun, poin, dan ulasan", text: "Masuk dengan OTP WA (disimulasikan), riwayat pesanan, poin, wishlist, ulasan berfoto, dan Kabari aku saat stok kembali.", href: "/akun" },
      { title: "Kuis kulit dan rutinitas", text: "Enam pertanyaan untuk profil kulit, lalu rutinitas pagi dan malam dari katalog sendiri.", href: "/kuis-kulit" },
    ],
  },
  {
    key: "admin",
    label: "Untuk pemilik toko dan staf",
    icon: LayoutDashboard,
    intro: "Panel admin dengan empat peran dan batas akses per cabang. Semua perubahan stok tercatat di buku stok.",
    items: [
      { title: "Dashboard langsung", text: "Pesanan baru muncul dalam 30 detik, omzet hari ini, hal yang perlu ditindak, dan stok kritis.", href: "/admin" },
      { title: "Pesanan: kanban dan tabel", text: "Seret kartu antar status (atau pilih dari daftar), label kirim PDF, input resi, retur.", href: "/admin/pesanan" },
      { title: "Stok, transfer, opname", text: "Matriks stok per lokasi, transfer antar cabang, opname dengan selisih, dan pembeda habis dengan tidak dijual.", href: "/admin/stok" },
      { title: "Produk, kategori, promo", text: "Kelola produk dan shade, pohon kategori, flash sale, voucher, dan banner.", href: "/admin/produk" },
      { title: "Laporan dan ekspor", text: "Omzet, produk terlaris, per cabang, kesehatan AI, ekspor Excel.", href: "/admin/laporan" },
      { title: "Pelanggan dan ulasan", text: "Riwayat pelanggan, penyesuaian poin, moderasi ulasan, notifikasi keluar.", href: "/admin/pelanggan" },
    ],
  },
  {
    key: "ai",
    label: "AI yang dijaga kode",
    icon: Bot,
    intro: "Gemini lewat Cloudflare AI Gateway. Model hanya memilih dari katalog; harga, stok, dan angka laporan diperiksa ulang oleh server.",
    items: [
      { title: MEREK.asisten.nama, text: "Rekomendasi dengan alasan per produk, menolak klaim medis, dan tahu stok tiap cabang.", href: "/advisor" , fitur: "aiPembeli"},
      { title: "Dari foto dan link", text: "Isi kuis dari foto wajah (tidak disimpan), atau cari produk serupa dari link TikTok, YouTube, dan screenshot.", href: "/cari-dari-video" , fitur: "aiFotoLink"},
      { title: "Asisten Admin", text: "Tanya omzet, stok, dan pesanan dengan bahasa sehari-hari; jawabannya dari data, dengan sumber angka.", href: "/admin/masuk" , fitur: "asistenAdmin"},
      { title: "Penulis deskripsi dan balasan", text: "Draf deskripsi produk dan balasan ulasan mengikuti panduan gaya toko, setiap klaim dicek terhadap data produk.", href: "/admin/masuk" , fitur: "asistenAdmin"},
      { title: "Kabar Harian", text: "Ringkasan pagi untuk owner: omzet kemarin, stok kritis, saran transfer dan flash sale, siap dikirim ke WA.", href: "/admin/masuk" , fitur: "asistenAdmin"},
    ],
  },
];

const STACK = ["Next.js App Router dan TypeScript", "PostgreSQL di Neon dengan Drizzle ORM", "Tailwind CSS, Radix, Motion", "Pencarian full-text Postgres dan pg_trgm", "Gemini lewat Cloudflare AI Gateway", "Vitest dan Playwright (Chrome dan WebKit)", "Vercel"];

export default function AboutDemoPage() {
  const wa = env.studioWa ? `https://wa.me/${env.studioWa}?text=${encodeURIComponent(`Halo, aku lihat demo ${MEREK.namaLengkap} dan mau tanya soal toko online untuk tokoku.`)}` : null;
  return (
    <div className="container-toko max-w-5xl py-10 md:py-16">
      <section className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-aksen uppercase">Tentang demo</p>
        <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-5xl">{MEREK.namaLengkap} adalah toko kosmetik demo. Semua datanya fiktif.</h1>
        <p className="mt-4 text-lg text-abu-hangat">
          Dua belas merek fiktif, ratusan varian, ulasan, tiga cabang, dan riwayat pesanan 90 hari dibuat untuk menunjukkan apa yang bisa dibangun untuk toko kosmetik sungguhan. Tidak ada barang yang dikirim dan tidak ada uang yang berpindah. Dibangun oleh{" "}
          {env.studioUrl !== "#" ? (
            <a href={env.studioUrl} target="_blank" rel="noreferrer" className="font-semibold text-kopi underline-offset-2 hover:underline">
              {env.studioName}
            </a>
          ) : (
            <span className="font-semibold text-kopi">{env.studioName}</span>
          )}
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {env.demoMode ? <OpenGuideButton /> : null}
          {wa ? (
            <Button asChild variant="dark">
              <a href={wa} target="_blank" rel="noreferrer" data-testid="wa-studio">
                <MessageCircle /> Ngobrol di WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {GROUPS.map((g) => ({ ...g, items: g.items.filter((f) => !f.fitur || fiturAktif(f.fitur)) }))
        .filter((g) => g.items.length)
        .map((g) => (
        <section key={g.key} className="mt-14" aria-labelledby={`fitur-${g.key}`}>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-blush text-aksen-gelap">
              <g.icon className="size-4" aria-hidden />
            </span>
            <h2 id={`fitur-${g.key}`} className="font-serif text-2xl text-kopi">
              {g.label}
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-abu-hangat">{g.intro}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((f) => (
              <li key={f.title}>
                <Link href={f.href} className="block h-full rounded-card border border-garis bg-putih p-4 transition-[border-color,box-shadow] duration-[var(--durasi-cepat)] hover:border-aksen/40 hover:shadow-soft">
                  <p className="font-semibold text-kopi">{f.title}</p>
                  <p className="mt-1 text-sm text-abu-hangat">{f.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-14 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-card border border-garis bg-putih p-6" data-testid="akun-demo">
          <h2 className="font-serif text-2xl text-kopi">Masuk cepat</h2>
          <p className="mt-2 text-sm text-abu-hangat">
            {env.demoMode
              ? "Pembeli Demo masuk tanpa OTP dan sudah punya alamat, pesanan di berbagai status, poin, wishlist, dan profil kulit. Panel admin bisa dicoba dari empat sudut pandang."
              : "Akun demo hanya aktif di mode demo."}{" "}
            Data direset setiap malam pukul 03.00 WIB.
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
        <div className="rounded-card border border-garis bg-porselen p-6">
          <h2 className="font-serif text-2xl text-kopi">Stack</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-kopi">
            {STACK.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-aksen" aria-hidden /> {s}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-abu-hangat">Satu aplikasi untuk toko dan admin, migrasi database aditif, uji otomatis untuk logika uang dan stok.</p>
        </div>
      </section>

      <section className="mt-14 rounded-card bg-kopi p-6 text-putih md:p-8">
        <h2 className="font-serif text-2xl md:text-3xl">Untuk tokomu, merek, stok, dan cabangnya diganti dengan punyamu.</h2>
        <p className="mt-2 max-w-2xl text-sm text-putih/80">Bisa disambung ke kasir di toko, WhatsApp Business untuk OTP dan notifikasi, serta pembayaran sungguhan. Mulai dari sesi scoping singkat.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {wa ? (
            <Button asChild variant="primary">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle /> Hubungi {env.studioName}
              </a>
            </Button>
          ) : env.studioUrl !== "#" ? (
            <Button asChild variant="primary">
              <a href={env.studioUrl} target="_blank" rel="noreferrer">
                Lihat {env.studioName}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="border-putih/30 bg-transparent text-putih hover:bg-putih/10 hover:text-putih">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
