import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { LogoutButton } from "@/components/account/logout-buttons";

// Data akun selalu per pembeli dan dibaca di dalam Suspense tiap halaman; tidak ada "use cache" di sini.
export const metadata: Metadata = { title: { template: "%s · Akunmu", default: "Akunmu" }, robots: { index: false } };

export default function AkunLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="container-rona py-6 md:py-10">
      <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden md:block" aria-label="Menu akun">
          <div className="sticky top-[140px]">
            <p className="px-3 pb-2 font-serif text-xl text-kopi">Akunmu</p>
            <AccountNav variant="side" />
            <LogoutButton className="mt-3 w-full justify-start px-3" />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
