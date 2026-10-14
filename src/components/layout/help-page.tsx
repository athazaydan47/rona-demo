import Link from "next/link";
import { HELP_LINKS, POLICY_LINKS } from "@/lib/content/bantuan";
import { cn } from "@/lib/utils";

// Kerangka seragam halaman bantuan dan kebijakan: judul, pengantar, isi, dan navigasi antar halaman bantuan.
export function HelpPage({ eyebrow = "Bantuan", title, intro, current, children, wide = false }: { eyebrow?: string; title: string; intro?: string; current: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={cn("container-rona py-8 md:py-12", wide ? "" : "max-w-5xl")}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-rona uppercase">{eyebrow}</p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-balance text-kopi md:text-4xl">{title}</h1>
          {intro ? <p className="mt-3 max-w-2xl text-base text-abu-hangat">{intro}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        <nav aria-label="Halaman bantuan lain" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold tracking-wide text-kopi uppercase">Bantuan</p>
          <ul className="mt-2 space-y-1">
            {HELP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={l.href === current ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-lg px-2 py-1.5 text-sm", l.href === current ? "bg-blush/60 font-semibold text-rona-gelap" : "text-abu-hangat hover:text-kopi")}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs font-semibold tracking-wide text-kopi uppercase">Kebijakan</p>
          <ul className="mt-2 space-y-1">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={l.href === current ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-lg px-2 py-1.5 text-sm", l.href === current ? "bg-blush/60 font-semibold text-rona-gelap" : "text-abu-hangat hover:text-kopi")}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

// Daftar bagian berjudul (paragraf atau butir) dengan tipografi yang sama di semua halaman kebijakan.
export function HelpSections({ sections }: { sections: { title: string; paragraphs?: string[]; items?: string[] }[] }) {
  return (
    <div className="space-y-8 text-sm leading-relaxed text-kopi">
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="font-serif text-2xl text-kopi">{s.title}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="mt-2 text-kopi/90">
              {p}
            </p>
          ))}
          {s.items ? (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-kopi/90">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
