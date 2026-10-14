import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin, Navigation, PackageCheck, Phone } from "lucide-react";
import { HelpPage } from "@/components/layout/help-page";
import { StoreMap } from "@/components/store/store-map";
import { Button } from "@/components/ui/button";
import { DAY_ORDER, getStoreDetails, mapsRouteUrl } from "@/lib/content/toko";
import { MEREK } from "@/config/merek";
import { fiturAktif } from "@/config/fitur";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Toko kami", description: `Tiga cabang ${MEREK.namaLengkap} di Malang: alamat, jam buka per hari, peta, dan rute Google Maps. Ambil di Toko tersedia.` };

export default async function TokoPage() {
  // Fitur dimatikan di src/config/fitur.ts: halaman ini tidak ada.
  if (!fiturAktif("multiCabang")) notFound();
  const all = await getStoreDetails();
  const stores = all.filter((s) => s.type === "toko");
  const warehouse = all.find((s) => s.type === "gudang");
  const pins = stores.filter((s) => s.lat != null && s.lng != null).map((s) => ({ slug: s.slug, name: s.name, lat: s.lat!, lng: s.lng! }));
  return (
    <HelpPage title="Toko kami" intro="Tiga cabang di Malang. Cek stok per cabang di halaman produk, lalu pilih Ambil di Toko saat checkout." current="/toko" wide>
      {pins.length ? <StoreMap pins={pins} className="h-64 w-full overflow-hidden rounded-card border border-garis bg-porselen sm:h-80" /> : null}
      <ul className="mt-6 grid gap-4 md:grid-cols-3" data-testid="daftar-cabang">
        {stores.map((s) => (
          <li key={s.id} className="flex flex-col rounded-card border border-garis bg-putih p-4 sm:p-5">
            <h2 className="font-serif text-xl text-kopi">{s.name}</h2>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-abu-hangat">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {s.address}, {s.district}, {s.city}
              </span>
            </p>
            {s.phone ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-abu-hangat">
                <Phone className="size-4 shrink-0" aria-hidden /> {s.phone}
              </p>
            ) : null}
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Jam buka {s.name}</caption>
              <tbody>
                {DAY_ORDER.map((d) => {
                  const h = s.openingHours?.[d.key];
                  return (
                    <tr key={d.key} className="border-t border-garis">
                      <th scope="row" className="py-1 text-left font-medium text-kopi">
                        {d.label}
                      </th>
                      <td className="py-1 text-right text-abu-hangat tabular-nums">{h ? `${h.open} sampai ${h.close}` : "Tutup"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {s.closedDates.length ? <p className="mt-2 text-xs text-abu-hangat">Libur: {s.closedDates.join(", ")}.</p> : null}
            {s.canPickup ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sukses">
                <PackageCheck className="size-3.5" aria-hidden /> Bisa Ambil di Toko
              </p>
            ) : null}
            <Button asChild size="sm" variant="outline" className="mt-4 self-start">
              <a href={mapsRouteUrl(s)} target="_blank" rel="noopener noreferrer">
                <Navigation /> Rute di Google Maps
              </a>
            </Button>
          </li>
        ))}
      </ul>
      {warehouse ? (
        <p className="mt-6 flex items-start gap-2 text-sm text-abu-hangat">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {warehouse.name}: {warehouse.hoursLabel}. Pesanan kirim yang lunas sebelum 15.00 WIB berangkat hari itu juga.{" "}
            <Link href="/kebijakan/pengiriman" className="font-semibold text-aksen hover:underline">
              Tentang pengiriman
            </Link>
            .
          </span>
        </p>
      ) : null}
    </HelpPage>
  );
}
