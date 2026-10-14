import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { HelpPage } from "@/components/layout/help-page";
import { Button } from "@/components/ui/button";
import { getStoreDetails } from "@/lib/content/toko";
import { env } from "@/lib/env";
import { getStoreSettings } from "@/lib/settings/load";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Hubungi kami", description: `WhatsApp, email, dan alamat cabang ${MEREK.namaLengkap}, plus ${MEREK.asisten.nama} untuk pertanyaan produk.` };

export default async function HubungiPage() {
  const [settings, stores] = await Promise.all([getStoreSettings(), getStoreDetails()]);
  const wa = settings.profile.whatsapp.replace(/\D/g, "");
  return (
    <HelpPage title="Hubungi kami" intro={`Paling cepat lewat WhatsApp, Senin sampai Sabtu pukul 09.00 sampai 21.00 WIB. Untuk soal produk dan shade, ${MEREK.asisten.nama} bisa menjawab kapan saja.`} current="/hubungi">
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-card border border-garis bg-putih p-4 transition-colors hover:border-aksen/40" data-testid="kontak-wa">
          <MessageCircle className="size-5 text-sukses" aria-hidden />
          <p className="mt-2 font-semibold text-kopi">WhatsApp toko</p>
          <p className="text-sm text-abu-hangat">+{wa}</p>
        </a>
        <a href={`mailto:${settings.profile.email}`} className="rounded-card border border-garis bg-putih p-4 transition-colors hover:border-aksen/40">
          <Mail className="size-5 text-aksen" aria-hidden />
          <p className="mt-2 font-semibold text-kopi">Email</p>
          <p className="text-sm text-abu-hangat">{settings.profile.email}</p>
        </a>
      </div>
      <div className="mt-4 rounded-card border border-aksen/25 bg-blush/30 p-4">
        <p className="flex items-center gap-2 font-semibold text-kopi">
          <Sparkles className="size-4 text-aksen" aria-hidden /> Tanya {MEREK.asisten.nama}
        </p>
        <p className="mt-1 text-sm text-kopi/85">Rekomendasi produk, shade, dan stok per cabang, langsung dari katalog. Tekan tombol {MEREK.asisten.tombol} di kanan bawah.</p>
      </div>
      <h2 className="mt-8 font-serif text-2xl text-kopi">Cabang</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {stores
          .filter((s) => s.type === "toko")
          .map((s) => (
            <li key={s.id} className="rounded-card border border-garis bg-putih p-4 text-sm">
              <p className="font-semibold text-kopi">{s.name}</p>
              <p className="mt-1 flex items-start gap-1.5 text-abu-hangat">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {s.address}, {s.district}, {s.city}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-abu-hangat">
                <Clock className="size-3.5 shrink-0" aria-hidden /> {s.hoursLabel} WIB
              </p>
              {s.phone ? <p className="mt-1 text-abu-hangat">{s.phone}</p> : null}
            </li>
          ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/toko">Lihat peta dan jam buka</Link>
        </Button>
      </div>
      <p className="mt-8 text-xs text-abu-hangat">
        Ini toko demo buatan {env.studioName}: nomor dan alamat di atas fiktif.{" "}
        <Link href="/tentang-demo" className="font-semibold text-aksen hover:underline">
          Tentang demo
        </Link>
        .
      </p>
    </HelpPage>
  );
}
