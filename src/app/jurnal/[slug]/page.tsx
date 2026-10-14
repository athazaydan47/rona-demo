import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { getProductCards } from "@/lib/catalog/catalog-queries";
import { getArticle } from "@/lib/catalog/queries";
import { formatDateWib } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  return { title: a?.title ?? "Artikel", description: a?.excerpt };
}

// Markdown sangat sederhana: "## " jadi judul bagian, baris lain jadi paragraf.
function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith("## ")) {
        return (
          <h2 key={i} className="mt-8 font-serif text-2xl text-kopi">
            {block.slice(3)}
          </h2>
        );
      }
      return (
        <p key={i} className="mt-4 text-base leading-7 text-kopi/90">
          {block}
        </p>
      );
    });
}

async function LinkedProducts({ ids }: { ids: number[] }) {
  if (ids.length === 0) return null;
  const products = await getProductCards({ kind: "ids", ids }, "relevan", 6);
  if (products.length === 0) return null;
  return (
    <aside className="mt-10 border-t border-garis pt-8">
      <h2 className="font-serif text-2xl text-kopi">Produk di artikel ini</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {products.map((p) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

async function ArticleContent({ params }: Props) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  return (
    <article className="container-toko max-w-3xl py-6 md:py-10">
      <Breadcrumb items={[{ label: "Jurnal", href: "/jurnal" }, { label: article.title }]} className="mb-4" />
      <p className="text-xs text-abu-hangat">
        {article.publishedAt ? formatDateWib(article.publishedAt) : ""} · {article.author}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">{article.title}</h1>
      <p className="mt-4 text-lg text-abu-hangat">{article.excerpt}</p>
      <div>{renderBody(article.body)}</div>
      <Suspense
        fallback={
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <LinkedProducts ids={article.linkedProductIds} />
      </Suspense>
    </article>
  );
}

// params adalah data runtime pada rute dinamis: dibaca di dalam Suspense supaya shell statis tetap ada.
export default function ArticlePage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container-toko max-w-3xl py-6 md:py-10" aria-busy>
          <div className="h-4 w-40 animate-pulse rounded bg-garis/70" />
          <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-garis/70" />
          <div className="mt-4 h-6 w-full animate-pulse rounded bg-garis/70" />
        </div>
      }
    >
      <ArticleContent {...props} />
    </Suspense>
  );
}
