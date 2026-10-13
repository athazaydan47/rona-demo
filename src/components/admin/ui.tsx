import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHead({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-medium text-kopi md:text-3xl">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-abu-hangat">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Panel({ title, action, className, children, padded = true }: { title?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-garis bg-putih", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-garis px-4 py-2.5">
          <h2 className="text-sm font-semibold text-kopi">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

// Ditampilkan bila izin atau lokasi tidak cocok. Pengamannya tetap can() di server.
export function Denied({ message = "Kamu tidak punya akses ke halaman ini." }: { message?: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-garis bg-putih p-6 text-center" data-testid="akses-ditolak">
      <ShieldAlert className="mx-auto size-8 text-bahaya" aria-hidden />
      <h1 className="mt-2 font-serif text-2xl text-kopi">Akses ditolak</h1>
      <p className="mt-1 text-sm text-abu-hangat">{message}</p>
      <Link href="/admin" className="mt-4 inline-block text-sm font-semibold text-rona hover:underline">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

export function Pager({ page, pageCount, href }: { page: number; pageCount: number; href: (p: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Halaman">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-lg border border-garis bg-putih px-3 py-1.5 font-medium hover:border-kopi/30">
          Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-abu-hangat tabular-nums">
        Halaman {page} dari {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="rounded-lg border border-garis bg-putih px-3 py-1.5 font-medium hover:border-kopi/30">
          Berikutnya
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export const fieldClass = "h-10 w-full rounded-lg border border-garis bg-putih px-3 text-sm text-kopi outline-none focus-visible:border-rona focus-visible:shadow-ring";
export const thClass = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-abu-hangat uppercase";
export const tdClass = "px-3 py-2 align-middle";

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-garis/50" />
      ))}
    </div>
  );
}
