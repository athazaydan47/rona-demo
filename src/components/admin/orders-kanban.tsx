"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/components/order/order-parts";
import { courierName } from "@/lib/admin/couriers";
import { emptyColumnText, initialKanbanTab, KANBAN_FINAL, KANBAN_FINAL_DAYS, KANBAN_TAB_COOKIE, planMove } from "@/lib/admin/kanban";
import { statusLabels, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";
import { OrderCardBody, type CardOrder } from "./order-card";
import { useStatusChange } from "./status-change";

// Cookie sesi (tanpa masa berlaku): hilang saat browser ditutup.
function rememberTab(staffId: number, status: OrderStatus) {
  document.cookie = `${KANBAN_TAB_COOKIE}=${staffId}:${status}; path=/admin; samesite=lax`;
}

export type KanbanColumn = { status: OrderStatus; total: number; orders: CardOrder[] };

export function OrdersKanban({ columns, staffId, rememberedTab = null }: { columns: KanbanColumn[]; staffId: number; rememberedTab?: OrderStatus | null }) {
  const [dragging, setDragging] = useState<CardOrder | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [tab, setTabState] = useState<OrderStatus>(() => initialKanbanTab(columns, rememberedTab));
  // Pilihan tab diingat per staf selama sesi browser (cookie tanpa masa berlaku).
  const setTab = (s: OrderStatus) => {
    setTabState(s);
    rememberTab(staffId, s);
  };
  const change = useStatusChange((ok, message) => setNotice(ok ? { tone: "ok", text: "Status pesanan diperbarui." } : { tone: "error", text: message ?? "Gagal." }));

  const drop = (o: CardOrder, to: OrderStatus) => {
    setOver(null);
    setDragging(null);
    if (o.status === to) return;
    const plan = planMove({ status: o.status as OrderStatus, method: o.method, paymentMethod: o.paymentMethod }, to);
    // Transisi tidak sah: kartu tetap di kolomnya dan alasannya ditampilkan.
    if (!plan.ok) return setNotice({ tone: "error", text: `${o.number}: ${plan.reason}` });
    if (plan.permission === "pesanan.batalkan" ? !o.canCancel : !o.canChange) return setNotice({ tone: "error", text: `${o.number}: kamu tidak punya izin untuk aksi ini.` });
    setNotice(null);
    change.request({ number: o.number, from: o.status as OrderStatus, to, plan, courier: o.courier ? courierName(o.courier) : null });
  };

  const current = columns.find((c) => c.status === tab) ?? columns[0];
  return (
    <div>
      {notice ? (
        <p className={cn("mb-3 rounded-lg px-3 py-2 text-sm", notice.tone === "error" ? "bg-[#F7E3E1] text-bahaya" : "bg-[#E5F2EA] text-sukses")} role={notice.tone === "error" ? "alert" : "status"} data-testid="kanban-pesan">
          {notice.text}
        </p>
      ) : null}

      {/* HP: tab status dengan daftar kartu. */}
      <div className="lg:hidden">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex gap-2" role="tablist" aria-label="Status pesanan">
            {columns.map((c) => (
              <button key={c.status} type="button" role="tab" aria-selected={tab === c.status} onClick={() => setTab(c.status)} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-sm", tab === c.status ? "border-kopi bg-kopi text-putih" : "border-garis bg-putih text-kopi")}>
                {statusLabels[c.status]} <span className="tabular-nums opacity-80">{c.total}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 space-y-2" role="tabpanel">
          {current.orders.map((o) => (
            <li key={o.id} className="rounded-xl border border-garis bg-putih p-3">
              <OrderCardBody o={o} />
            </li>
          ))}
          {KANBAN_FINAL.includes(current.status) ? (
            <li className="rounded-xl border border-dashed border-garis bg-putih p-6 text-center text-sm text-abu-hangat">
              {current.total} pesanan {statusLabels[current.status].toLowerCase()} dalam {KANBAN_FINAL_DAYS} hari terakhir.{" "}
              <a href={`/admin/pesanan?tampilan=tabel&status=${current.status}`} className="font-semibold text-rona">
                Lihat di tabel
              </a>
            </li>
          ) : current.orders.length === 0 ? (
            <li className="rounded-xl border border-dashed border-garis p-6 text-center text-sm text-abu-hangat" data-testid="kanban-kosong">
              {emptyColumnText(current.status)}
            </li>
          ) : null}
        </ul>
      </div>

      {/* Desktop: papan kanban, kartu bisa diseret antar kolom untuk transisi yang sah. */}
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="grid min-w-[1160px] grid-cols-[repeat(5,minmax(200px,1fr))_repeat(3,92px)] gap-3">
          {columns.map((c) => {
            const valid = dragging ? planMove({ status: dragging.status as OrderStatus, method: dragging.method, paymentMethod: dragging.paymentMethod }, c.status).ok : false;
            if (KANBAN_FINAL.includes(c.status)) {
              return (
                <section
                  key={c.status}
                  aria-label={statusLabels[c.status]}
                  data-kolom={c.status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(c.status);
                  }}
                  onDragLeave={() => setOver((v) => (v === c.status ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging) drop(dragging, c.status);
                  }}
                  className={cn("flex min-h-[60dvh] flex-col items-center gap-2 rounded-xl border bg-porselen/40 px-1.5 py-3 text-center transition-colors", dragging ? (valid ? "border-sukses/50 bg-[#EEF7F1]" : "border-garis opacity-50") : "border-garis", over === c.status && valid && "ring-2 ring-sukses/40")}
                >
                  <Badge variant={statusTone[c.status]} className="max-w-full truncate">
                    {statusLabels[c.status]}
                  </Badge>
                  <span className="font-serif text-2xl text-kopi tabular-nums">{c.total}</span>
                  <span className="text-[10px] leading-tight text-abu-hangat">{KANBAN_FINAL_DAYS} hari terakhir</span>
                  <a href={`/admin/pesanan?tampilan=tabel&status=${c.status}`} className="text-[11px] font-semibold text-rona hover:underline">
                    Lihat tabel
                  </a>
                  {dragging && valid ? <span className="mt-auto text-[10px] text-sukses">Lepas di sini</span> : null}
                </section>
              );
            }
            return (
              <section
                key={c.status}
                aria-label={statusLabels[c.status]}
                data-kolom={c.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(c.status);
                }}
                onDragLeave={() => setOver((v) => (v === c.status ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) drop(dragging, c.status);
                }}
                className={cn("flex min-h-[60dvh] flex-col rounded-xl border bg-porselen/60 transition-colors", dragging && dragging.status !== c.status ? (valid ? "border-sukses/50 bg-[#EEF7F1]" : "border-garis opacity-60") : "border-garis", over === c.status && valid && "ring-2 ring-sukses/40")}
              >
                <h2 className="flex items-center justify-between gap-2 px-3 py-2">
                  <Badge variant={statusTone[c.status]}>{statusLabels[c.status]}</Badge>
                  <span className="text-xs font-semibold text-abu-hangat tabular-nums">{c.total}</span>
                </h2>
                <ul className="flex-1 space-y-2 px-2 pb-2">
                  {c.orders.map((o) => (
                    <li
                      key={o.id}
                      draggable={o.canChange || o.canCancel}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", o.number);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(o);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      data-pesanan={o.number}
                      className={cn("rounded-lg border border-garis bg-putih p-2.5 shadow-[0_1px_2px_rgb(42_31_29/0.05)]", (o.canChange || o.canCancel) && "cursor-grab active:cursor-grabbing", dragging?.id === o.id && "opacity-50")}
                    >
                      <OrderCardBody o={o} />
                    </li>
                  ))}
                  {c.total > c.orders.length ? <li className="px-1 text-center text-[11px] text-abu-hangat">dan {c.total - c.orders.length} lainnya di tampilan tabel</li> : null}
                  {c.orders.length === 0 ? <li className="px-2 py-4 text-center text-xs text-abu-hangat">{emptyColumnText(c.status)}</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      {change.dialog}
    </div>
  );
}
