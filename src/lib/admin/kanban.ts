// Pemetaan papan kanban ke state machine. Murni (tanpa database) supaya bisa dipakai di browser dan diuji.
import { canTransition, statusLabels, type OrderMethod, type OrderStatus } from "@/lib/orders/status";

export const KANBAN_ACTIVE: OrderStatus[] = ["menunggu_pembayaran", "dibayar", "diproses", "siap_diambil", "dikirim"];
// Kolom akhir dibuat sempit dan terlipat (jumlah 14 hari terakhir dan tautan ke tabel).
export const KANBAN_FINAL: OrderStatus[] = ["selesai", "dibatalkan", "diretur"];
export const KANBAN_COLUMNS: OrderStatus[] = [...KANBAN_ACTIVE, ...KANBAN_FINAL];
export const KANBAN_FINAL_DAYS = 14;

export type MoveContext = { status: OrderStatus; method: OrderMethod; paymentMethod: string | null };
export type MovePlan =
  | { ok: true; steps: OrderStatus[]; needs: "resi" | "alasan" | null; label: string; payAtStore?: boolean; permission: "pesanan.ubah_status" | "pesanan.batalkan" }
  | { ok: false; reason: string };

// Pemetaan seret kartu kanban ke state machine. Hanya transisi sah (plus aksi gabungan yang diizinkan BRIEF).
export function planMove(o: MoveContext, to: OrderStatus): MovePlan {
  const from = o.status;
  if (from === to) return { ok: false, reason: "Pesanan sudah di kolom ini." };
  const ctx = { method: o.method, paymentMethod: o.paymentMethod };
  const payAtStore = o.method === "ambil" && o.paymentMethod === "bayar_di_toko";
  // Bayar di Toko: lunas dan sudah diambil dalam satu aksi.
  if (payAtStore && from === "menunggu_pembayaran" && to === "selesai") return { ok: true, steps: ["dibayar", "selesai"], needs: null, label: "Tandai lunas dan sudah diambil", payAtStore: true, permission: "pesanan.ubah_status" };
  if (from === "menunggu_pembayaran" && to === "dibayar") {
    if (!payAtStore) return { ok: false, reason: "Pembayaran online dikonfirmasi otomatis oleh sistem pembayaran, bukan oleh staf." };
    return { ok: true, steps: ["dibayar"], needs: null, label: "Tandai lunas", permission: "pesanan.ubah_status" };
  }
  // Ambil di toko: Siapkan pesanan (Dibayar, Diproses, Siap Diambil).
  if (o.method === "ambil" && from === "dibayar" && to === "siap_diambil") return { ok: true, steps: ["diproses", "siap_diambil"], needs: null, label: "Siapkan pesanan", permission: "pesanan.ubah_status" };
  if (!canTransition(from, to, ctx)) {
    if (to === "siap_diambil" && o.method === "kirim") return { ok: false, reason: "Pesanan kirim tidak melewati Siap Diambil." };
    if (to === "dikirim" && o.method === "ambil") return { ok: false, reason: "Pesanan Ambil di Toko tidak dikirim kurir." };
    return { ok: false, reason: `Status tidak bisa berubah dari ${statusLabels[from]} ke ${statusLabels[to]}.` };
  }
  if (to === "dibatalkan") return { ok: true, steps: ["dibatalkan"], needs: "alasan", label: "Batalkan pesanan", permission: "pesanan.batalkan" };
  if (to === "diretur") return { ok: true, steps: ["diretur"], needs: "alasan", label: "Setujui retur", permission: "pesanan.ubah_status" };
  if (to === "dikirim") return { ok: true, steps: ["dikirim"], needs: "resi", label: "Kirim pesanan", permission: "pesanan.ubah_status" };
  const labels: Partial<Record<OrderStatus, string>> = { diproses: "Proses pesanan", siap_diambil: "Tandai siap diambil", selesai: o.method === "ambil" ? "Tandai sudah diambil" : "Tandai selesai" };
  return { ok: true, steps: [to], needs: null, label: labels[to] ?? statusLabels[to], permission: "pesanan.ubah_status" };
}

// Tombol aksi di detail pesanan: tujuan yang sah dari status sekarang.
export function availableActions(o: MoveContext): { to: OrderStatus; plan: Extract<MovePlan, { ok: true }> }[] {
  const targets: OrderStatus[] = ["dibayar", "diproses", "siap_diambil", "dikirim", "selesai", "dibatalkan", "diretur"];
  const out: { to: OrderStatus; plan: Extract<MovePlan, { ok: true }> }[] = [];
  for (const to of targets) {
    const plan = planMove(o, to);
    if (plan.ok) out.push({ to, plan });
  }
  // Untuk ambil di toko dari Dibayar, "Siapkan pesanan" sudah mencakup Diproses.
  if (o.method === "ambil" && o.status === "dibayar") return out.filter((a) => a.to !== "diproses");
  return out;
}

