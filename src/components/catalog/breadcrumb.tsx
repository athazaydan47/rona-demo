import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Jejak navigasi" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-abu-hangat">
        <li>
          <Link href="/" className="inline-flex min-h-8 items-center hover:text-aksen-gelap">
            Beranda
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="size-3" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-8 items-center hover:text-aksen-gelap">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-kopi" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
