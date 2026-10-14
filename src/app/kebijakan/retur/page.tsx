import type { Metadata } from "next";
import Link from "next/link";
import { Camera, PackageCheck, RotateCcw, Video } from "lucide-react";
import { HelpPage, HelpSections } from "@/components/layout/help-page";
import { RETURN_POLICY } from "@/lib/content/return-policy";

export const metadata: Metadata = { title: "Kebijakan retur", description: "Syarat retur Rona Beauty: 2 x 24 jam setelah paket sampai, video unboxing tanpa jeda, dan produk yang bisa diretur." };

const UNBOXING = [
  { icon: Video, title: "Rekam dari paket masih tersegel", text: "Mulai merekam sebelum segel atau lakban dibuka, tampakkan label pengiriman dan nomor pesanan." },
  { icon: Camera, title: "Tanpa jeda sampai produk terlihat", text: "Satu video utuh tanpa potongan: buka kemasan, keluarkan tiap produk, tunjukkan kondisi dan segelnya." },
  { icon: PackageCheck, title: "Kirim dalam 2 x 24 jam", text: "Ajukan retur lewat WhatsApp toko dengan nomor pesanan dan video itu, maksimal 2 x 24 jam setelah paket diterima." },
  { icon: RotateCcw, title: "Kami proses pengganti atau pengembalian", text: "Setelah video dicek, produk pengganti dikirim atau pembayaran dikembalikan sesuai metode semula." },
];

export default function ReturPage() {
  return (
    <HelpPage eyebrow="Kebijakan" title="Kebijakan retur" intro={RETURN_POLICY.window} current="/kebijakan/retur">
      <div className="grid gap-3 sm:grid-cols-2">
        {UNBOXING.map((u) => (
          <div key={u.title} className="rounded-card border border-garis bg-putih p-4">
            <u.icon className="size-5 text-rona" aria-hidden />
            <h2 className="mt-2 font-semibold text-kopi">{u.title}</h2>
            <p className="mt-1 text-sm text-kopi/85">{u.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <HelpSections
          sections={[
            { title: "Yang bisa diretur", paragraphs: [RETURN_POLICY.scope] },
            { title: "Yang tidak bisa diretur", items: ["Shade yang ternyata kurang cocok di kulit. Manfaatkan Cari shade-ku dan Padanan Shade sebelum membeli.", "Produk yang sudah dipakai atau segelnya dibuka tanpa video unboxing.", "Pengajuan lewat dari 2 x 24 jam setelah paket sampai."] },
            { title: "Keaslian dan kemasan", paragraphs: [RETURN_POLICY.origin] },
          ]}
        />
      </div>
      <p className="mt-8 text-sm text-abu-hangat">
        Ini toko demo, jadi retur tidak benar-benar diproses. Untuk bertanya soal alur ini,{" "}
        <Link href="/hubungi" className="font-semibold text-rona hover:underline">
          hubungi kami
        </Link>
        .
      </p>
    </HelpPage>
  );
}
