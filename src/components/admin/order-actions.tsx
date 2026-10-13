"use client";

import { Button } from "@/components/ui/button";
import type { MovePlan } from "@/lib/admin/kanban";
import type { OrderStatus } from "@/lib/orders/status";
import { useStatusChange } from "./status-change";

export type ActionButton = { to: OrderStatus; plan: Extract<MovePlan, { ok: true }> };

// Tombol aksi sesuai status dan izin (dihitung di server). Server tetap memeriksa ulang izin dan status asal.
export function OrderAdminActions({ number, status, actions, courier }: { number: string; status: OrderStatus; actions: ActionButton[]; courier: string | null }) {
  const change = useStatusChange();
  if (!actions.length) return <p className="text-sm text-abu-hangat">Tidak ada aksi untuk status ini.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.to}
            size="sm"
            variant={a.to === "dibatalkan" ? "outline" : a.to === "diretur" ? "outline" : "primary"}
            className={a.to === "dibatalkan" ? "text-bahaya" : undefined}
            disabled={change.busy}
            onClick={() => change.request({ number, from: status, to: a.to, plan: a.plan, courier })}
          >
            {a.plan.label}
          </Button>
        ))}
      </div>
      {change.error ? (
        <p className="text-sm text-bahaya" role="alert">
          {change.error}
        </p>
      ) : null}
      {change.dialog}
    </div>
  );
}
