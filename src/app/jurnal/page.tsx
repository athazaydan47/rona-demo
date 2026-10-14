import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { getArticles } from "@/lib/catalog/queries";
import { formatDateWib } from "@/lib/format";
import { MEREK } from "@/config/merek";

export const metadata: Metadata = { title: "Jurnal", description: `Artikel kecantikan singkat dari tim ${MEREK.nama}.` };

export default async function JournalPage() {
  const articles = await getArticles(20);
  return (
    <section className="container-toko py-6 md:py-8">
      <Breadcrumb items={[{ label: "Jurnal" }]} className="mb-3" />
      <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">Jurnal {MEREK.nama}</h1>
      <p className="mt-2 max-w-2xl text-sm text-abu-hangat md:text-base">Tips singkat yang bisa langsung dipraktikkan, dengan produk yang bisa dibeli dari dalam artikel.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/jurnal/${a.slug}`} className="group block h-full rounded-card border border-garis bg-putih p-6 shadow-soft transition-[transform,box-shadow] duration-250 ease-soft hover:-translate-y-0.5 hover:shadow-lift">
              <p className="text-xs text-abu-hangat">
                {a.publishedAt ? formatDateWib(a.publishedAt) : ""} · {a.author}
              </p>
              <h2 className="mt-2 font-serif text-2xl leading-snug text-kopi group-hover:text-aksen-gelap">{a.title}</h2>
              <p className="mt-2 text-sm text-abu-hangat">{a.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
