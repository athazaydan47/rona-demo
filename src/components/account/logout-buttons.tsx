"use client";

import { useTransition } from "react";
import { Loader2, LogOut, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction, logoutAllAction } from "@/lib/auth/actions";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" className={className} disabled={pending} onClick={() => start(() => logoutAction())}>
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />} Keluar
    </Button>
  );
}

export function LogoutAllButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Keluar dari semua perangkat? Kamu perlu masuk lagi dengan OTP di setiap perangkat.")) start(() => logoutAllAction());
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <MonitorSmartphone />} Keluar dari semua perangkat
    </Button>
  );
}
