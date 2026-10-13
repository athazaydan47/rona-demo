import Link from "next/link";
import { RotateCcw, ShieldCheck, Video } from "lucide-react";

export function ReturnPolicy() {
  return (
    <aside className="rounded-card border border-garis bg-porselen p-5" aria-labelledby="retur-heading">
      <h2 id="retur-heading" className="font-serif text-xl text-kopi">
        Retur dan jaminan
      </h2>
      <ul className="mt-3 space-y-2.5 text-sm text-kopi/90">
        <li className="flex gap-2.5">
          <Video className="mt-0.5 size-4 shrink-0 text-rona" aria-hidden />
          <span>Retur diterima maksimal 2 x 24 jam setelah paket sampai, wajib menyertakan video unboxing tanpa jeda dari paket masih tersegel.</span>
        </li>
        <li className="flex gap-2.5">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-rona" aria-hidden />
          <span>Berlaku untuk produk rusak, salah kirim, atau segel terbuka. Shade yang ternyata kurang cocok tidak bisa diretur, jadi manfaatkan Shade Finder dulu.</span>
        </li>
        <li className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-rona" aria-hidden />
          <span>Semua produk asli dari distributor resmi (dalam cerita demo ini) dan dikemas dengan bubble wrap.</span>
        </li>
      </ul>
      <Link href="/kebijakan/retur" className="mt-3 inline-block text-sm font-semibold text-rona hover:underline">
        Baca kebijakan retur lengkap
      </Link>
    </aside>
  );
}
