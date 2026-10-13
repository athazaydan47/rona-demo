"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { refreshAccountStatus, useAccountStatus } from "@/lib/auth/client-status";

function Badge({ count, className }: { count: number; className: string }) {
  if (count <= 0) return null;
  return (
    <span className={className} aria-hidden>
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Refresher() {
  const pathname = usePathname();
  useEffect(() => {
    void refreshAccountStatus();
  }, [pathname]);
  return null;
}

// Ikon akun: ke /akun bila sudah masuk, ke /masuk bila belum. Badge = notifikasi belum dibaca.
export function AccountIconLink({ className, badgeClassName }: { className: string; badgeClassName: string }) {
  const status = useAccountStatus();
  const unread = status?.unread ?? 0;
  const label = status?.loggedIn ? `Akun${unread ? `, ${unread} notifikasi belum dibaca` : ""}` : "Masuk";
  return (
    <Link href={status?.loggedIn ? "/akun" : "/masuk"} className={className} aria-label={label} data-testid="ikon-akun" data-masuk={status?.loggedIn ? "ya" : "tidak"}>
      <User className="size-5" />
      <Badge count={unread} className={badgeClassName} />
      <Suspense fallback={null}>
        <Refresher />
      </Suspense>
    </Link>
  );
}

export function useAccountBadge() {
  const status = useAccountStatus();
  return { loggedIn: Boolean(status?.loggedIn), unread: status?.unread ?? 0 };
}

export { Badge as UnreadBadge };
