import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Judul halaman akun. Di HP ada tautan kembali ke daftar menu akun.
export function AccountPageHead({ title, description, back = true, children }: { title: string; description?: string; back?: boolean; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href="/akun" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-aksen md:hidden">
          <ChevronLeft className="size-4" aria-hidden /> Akun
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium text-kopi md:text-4xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-abu-hangat">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-10 w-48 animate-pulse rounded-lg bg-garis/60" />
      <div className="h-40 animate-pulse rounded-card bg-garis/50" />
      <div className="h-40 animate-pulse rounded-card bg-garis/50" />
    </div>
  );
}
