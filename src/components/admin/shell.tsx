"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { FlaskConical, LogOut, MoreHorizontal, Search, X } from "lucide-react";
import { staffLogoutAction } from "@/lib/admin/actions";
import type { NavKey } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";
import { AdminSearch, openAdminSearch } from "./search";
import { NAV_ICONS } from "./nav-icons";

export type ShellItem = { key: NavKey; href: string; label: string; soon?: boolean };
export type ShellStaff = { name: string; roleName: string; scope: string };

const isActive = (pathname: string | null, href: string) => (pathname ? (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)) : false);

function SideLinks({ items, pathname }: { items: ShellItem[]; pathname: string | null }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const Icon = NAV_ICONS[it.key];
        const active = isActive(pathname, it.href);
        return (
          <li key={it.key}>
            <Link href={it.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-kopi text-putih" : "text-kopi/85 hover:bg-blush/50")}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{it.label}</span>
              {it.soon ? <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", active ? "bg-putih/20" : "bg-porselen text-abu-hangat")}>Segera</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PathAware({ render }: { render: (pathname: string | null) => React.ReactNode }) {
  return <>{render(usePathname())}</>;
}

function WithPath({ render }: { render: (pathname: string | null) => React.ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <PathAware render={render} />
    </Suspense>
  );
}

export function AdminShell({ items, mobilePrimary, staff, demoMode, children }: { items: ShellItem[]; mobilePrimary: NavKey[]; staff: ShellStaff; demoMode: boolean; children: React.ReactNode }) {
  const [more, setMore] = useState(false);
  const primary = mobilePrimary.map((k) => items.find((i) => i.key === k)).filter((i): i is ShellItem => Boolean(i)).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openAdminSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-garis bg-putih lg:flex lg:flex-col" aria-label="Menu admin">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="px-5 pt-5 pb-4">
            <Link href="/admin" className="flex items-baseline gap-2">
              <span className="font-serif text-2xl text-kopi">Rona</span>
              <span className="text-[10px] font-bold tracking-[0.24em] text-rona uppercase">Admin</span>
            </Link>
          </div>
          <button type="button" onClick={openAdminSearch} className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-garis bg-porselen px-3 py-2 text-left text-sm text-abu-hangat hover:border-kopi/25">
            <Search className="size-4" aria-hidden /> <span className="flex-1">Cari</span>
            <kbd className="rounded border border-garis bg-putih px-1.5 text-[10px] font-semibold">⌘K</kbd>
          </button>
          <nav className="flex-1 overflow-y-auto px-3" aria-label="Menu utama admin">
            <WithPath render={(p) => <SideLinks items={items} pathname={p} />} />
          </nav>
          <div className="border-t border-garis p-3">
            {demoMode ? (
              <p className="mb-2 flex items-center gap-1.5 rounded-md bg-[#FBF4E6] px-2 py-1 text-[11px] font-semibold text-[#7A5A1E]">
                <FlaskConical className="size-3.5" aria-hidden /> Mode demo, data fiktif
              </p>
            ) : null}
            <p className="truncate text-sm font-semibold text-kopi" data-testid="staf-nama">
              {staff.name}
            </p>
            <p className="truncate text-xs text-abu-hangat">
              {staff.roleName} · {staff.scope}
            </p>
            <form action={staffLogoutAction}>
              <button type="submit" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rona hover:underline">
                <LogOut className="size-3.5" aria-hidden /> Keluar
              </button>
            </form>
            <Link href="/" className="mt-1 block text-xs text-abu-hangat hover:text-kopi">
              Lihat toko
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-garis bg-putih/95 px-4 backdrop-blur lg:hidden">
          <Link href="/admin" className="flex items-baseline gap-1.5">
            <span className="font-serif text-xl text-kopi">Rona</span>
            <span className="text-[9px] font-bold tracking-[0.22em] text-rona uppercase">Admin</span>
          </Link>
          {demoMode ? <span className="rounded-full bg-[#FBF4E6] px-2 py-0.5 text-[10px] font-semibold text-[#7A5A1E]">Demo</span> : null}
          <span className="ml-auto max-w-32 truncate text-xs text-abu-hangat">{staff.name}</span>
          <button type="button" onClick={openAdminSearch} className="grid size-10 place-items-center rounded-full hover:bg-blush/50" aria-label="Cari pesanan, produk, pelanggan">
            <Search className="size-5" />
          </button>
        </header>
        <main className="px-4 pt-4 pb-24 lg:px-8 lg:pt-6 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-garis bg-putih/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Menu bawah admin">
        <WithPath
          render={(p) => (
            <ul className="flex h-16 items-stretch">
              {primary.map((it) => {
                const Icon = NAV_ICONS[it.key];
                const active = isActive(p, it.href);
                return (
                  <li key={it.key} className="flex-1">
                    <Link href={it.href} aria-current={active ? "page" : undefined} className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-rona" : "text-abu-hangat")}>
                      <Icon className="size-5" aria-hidden />
                      <span className="max-w-full truncate px-1">{it.label === "Staf dan izin" ? "Staf" : it.label === "Log aktivitas" ? "Log" : it.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="flex-1">
                <button type="button" onClick={() => setMore(true)} className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium", rest.some((r) => isActive(p, r.href)) ? "text-rona" : "text-abu-hangat")}>
                  <MoreHorizontal className="size-5" aria-hidden />
                  Lainnya
                </button>
              </li>
            </ul>
          )}
        />
      </nav>

      <Dialog.Root open={more} onOpenChange={setMore}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40 lg:hidden" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[20px] bg-putih p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <Dialog.Title className="font-serif text-xl text-kopi">Menu lainnya</Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Semua menu admin sesuai izinmu.</Dialog.Description>
            <div onClick={() => setMore(false)}>
              <WithPath render={(p) => <SideLinks items={rest} pathname={p} />} />
            </div>
            <div className="mt-3 border-t border-garis pt-3 text-sm">
              <p className="font-semibold text-kopi">{staff.name}</p>
              <p className="text-xs text-abu-hangat">
                {staff.roleName} · {staff.scope}
              </p>
              <form action={staffLogoutAction}>
                <button type="submit" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-rona">
                  <LogOut className="size-4" aria-hidden /> Keluar
                </button>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AdminSearch />
    </div>
  );
}
