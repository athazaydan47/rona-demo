import type { Metadata } from "next";
import Link from "next/link";
import { HelpPage } from "@/components/layout/help-page";
import { PRIVASI } from "@/lib/content/bantuan";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Kebijakan privasi", description: `Data yang disimpan ${MEREK.namaLengkap} (toko demo), termasuk foto dan link yang kamu kirim ke fitur AI, cookie, dan hakmu sesuai UU PDP.` };

const ANCHORS = ["data", "foto", "cookie", "hak", "kontak"];

export default function PrivasiPage() {
  return (
    <HelpPage eyebrow="Kebijakan" title={`Data kamu di ${MEREK.namaLengkap}`} intro={`${MEREK.namaLengkap} adalah toko demo dengan data fiktif. Meski begitu, data yang kamu masukkan kami perlakukan dengan hati-hati, dan fitur foto atau link selalu opsional.`} current="/kebijakan/privasi">
      <div className="space-y-8 text-sm leading-relaxed text-kopi">
        {PRIVASI.map((s, i) => (
          <section key={s.title} id={ANCHORS[i]} className="scroll-mt-28">
            <h2 className="font-serif text-2xl text-kopi">{s.title}</h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-2 text-kopi/90">
                {p}
              </p>
            ))}
            {s.items ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-kopi/90">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-abu-hangat">
        Lihat juga{" "}
        <Link href="/tentang-demo" className="font-semibold text-aksen hover:underline">
          Tentang demo
        </Link>
        .
      </p>
    </HelpPage>
  );
}
