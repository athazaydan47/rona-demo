import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import type { CategoryNode, StoreLocation } from "@/lib/catalog/queries";
import { HELP_LINKS as helpLinks, POLICY_LINKS as policyLinks } from "@/lib/content/bantuan";

type FooterProps = {
  categories: CategoryNode[];
  locations: StoreLocation[];
  studio: { name: string; url: string };
  demoMode: boolean;
};

const paymentMethods = ["QRIS", "BCA", "BNI", "BRI", "Mandiri", "Bayar di Toko"];

const linkClass = "text-sm text-abu-hangat transition-colors hover:text-rona-gelap";

export function Footer({ categories, locations, studio, demoMode }: FooterProps) {
  const stores = locations.filter((l) => l.type === "toko");
  const warehouse = locations.find((l) => l.type === "gudang");
  const year = 2026;

  return (
    <footer className="mt-16 border-t border-garis bg-putih">
      <div className="container-rona py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link href="/" className="font-serif text-3xl font-medium tracking-tight text-kopi">
              Rona
            </Link>
            <p className="mt-3 max-w-xs text-sm text-abu-hangat">
              Toko kosmetik multi-merek dengan tiga cabang di Malang dan toko online. Cocok dulu, baru beli.
            </p>
            <div className="mt-6">
              <p className="text-xs font-semibold tracking-wide text-kopi uppercase">Metode bayar</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {paymentMethods.map((m) => (
                  <li key={m} className="rounded-md border border-garis bg-porselen px-2 py-1 text-xs font-semibold text-abu-hangat">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8">
            <div>
              <h3 className="text-sm font-semibold text-kopi">Kategori</h3>
              <ul className="mt-3 space-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/c/${c.slug}`} className={linkClass}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-kopi">Bantuan</h3>
              <ul className="mt-3 space-y-2">
                {helpLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <h3 className="mt-6 text-sm font-semibold text-kopi">Kebijakan</h3>
              <ul className="mt-3 space-y-2">
                {policyLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <h3 className="text-sm font-semibold text-kopi">Cabang dan jam buka</h3>
              <ul className="mt-3 space-y-3">
                {stores.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="font-medium text-kopi">{s.name}</p>
                    <p className="flex items-start gap-1.5 text-abu-hangat">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        {s.address}, {s.district}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5 text-abu-hangat">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      {s.hoursLabel} WIB
                    </p>
                  </li>
                ))}
                {warehouse ? (
                  <li className="text-sm">
                    <p className="font-medium text-kopi">{warehouse.name}</p>
                    <p className="text-abu-hangat">{warehouse.hoursLabel}. Pesan sebelum 15.00 WIB, dikirim hari itu.</p>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-garis pt-6 text-xs text-abu-hangat sm:flex-row sm:items-center sm:justify-between">
          <p>
            {year} Rona Beauty. Toko demo dengan data fiktif.{" "}
            <Link href="/tentang-demo" className="font-semibold text-rona-gelap hover:underline">
              Tentang demo
            </Link>
            {" · "}
            <Link href="/kebijakan/privasi" className="font-semibold text-rona-gelap hover:underline">
              Kebijakan privasi
            </Link>
            {demoMode ? null : " "}
          </p>
          <p>
            Dibangun oleh{" "}
            {studio.url && studio.url !== "#" ? (
              <a href={studio.url} target="_blank" rel="noreferrer" className="font-semibold text-kopi hover:text-rona-gelap">
                {studio.name}
              </a>
            ) : (
              <span className="font-semibold text-kopi">{studio.name}</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
