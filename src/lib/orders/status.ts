// State machine status pesanan, persis tabel transisi di BRIEF, plus pengecualian Bayar di Toko.
export const ORDER_STATUSES = ["menunggu_pembayaran", "dibayar", "diproses", "dikirim", "siap_diambil", "selesai", "dibatalkan", "diretur"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderMethod = "kirim" | "ambil";

export const statusLabels: Record<OrderStatus, string> = {
  menunggu_pembayaran: "Menunggu Pembayaran",
  dibayar: "Dibayar",
  diproses: "Diproses",
  dikirim: "Dikirim",
  siap_diambil: "Siap Diambil",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
  diretur: "Diretur",
};

export const FINAL_STATUSES: OrderStatus[] = ["selesai", "dibatalkan", "diretur"];

type Rule = { from: OrderStatus; to: OrderStatus; method?: OrderMethod; trigger: string };

export const TRANSITIONS: Rule[] = [
  { from: "menunggu_pembayaran", to: "dibayar", trigger: "Konfirmasi pembayaran, atau staf menandai lunas untuk Bayar di Toko" },
  { from: "menunggu_pembayaran", to: "dibatalkan", trigger: "Lewat batas waktu tanpa pembayaran, atau dibatalkan admin" },
  { from: "dibayar", to: "diproses", trigger: "Admin mulai menyiapkan pesanan" },
  { from: "dibayar", to: "dibatalkan", trigger: "Dibatalkan admin" },
  { from: "diproses", to: "dikirim", method: "kirim", trigger: "Resi diinput" },
  { from: "diproses", to: "siap_diambil", method: "ambil", trigger: "Barang disiapkan di cabang" },
  { from: "diproses", to: "dibatalkan", trigger: "Dibatalkan admin sebelum barang keluar" },
  { from: "dikirim", to: "selesai", method: "kirim", trigger: "Pembeli konfirmasi diterima, atau otomatis 3 hari setelah terkirim" },
  { from: "siap_diambil", to: "selesai", method: "ambil", trigger: "Staf cabang menandai sudah diambil" },
  { from: "selesai", to: "diretur", trigger: "Pengajuan retur disetujui" },
];

export type TransitionContext = { method: OrderMethod; paymentMethod?: string | null; payAtStoreHandover?: boolean };

// Pengecualian BRIEF: Bayar di Toko boleh dibayar lalu langsung selesai dalam satu aksi staf (lunas dan sudah diambil).
function payAtStoreShortcut(from: OrderStatus, to: OrderStatus, ctx: TransitionContext) {
  return from === "dibayar" && to === "selesai" && ctx.method === "ambil" && ctx.paymentMethod === "bayar_di_toko" && ctx.payAtStoreHandover === true;
}

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext) {
  if (payAtStoreShortcut(from, to, ctx)) return true;
  return TRANSITIONS.some((r) => r.from === from && r.to === to && (!r.method || r.method === ctx.method));
}

export class TransitionError extends Error {
  constructor(
    public from: OrderStatus,
    public to: OrderStatus,
  ) {
    super(`Status tidak bisa berubah dari ${statusLabels[from]} ke ${statusLabels[to]}.`);
    this.name = "TransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext) {
  if (!canTransition(from, to, ctx)) throw new TransitionError(from, to);
}

export function nextStatuses(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  return TRANSITIONS.filter((r) => r.from === from && (!r.method || r.method === ctx.method)).map((r) => r.to);
}

// Langkah lini masa yang diharapkan untuk metode tertentu (untuk menampilkan langkah yang belum terjadi).
export function expectedFlow(method: OrderMethod): OrderStatus[] {
  return method === "kirim" ? ["menunggu_pembayaran", "dibayar", "diproses", "dikirim", "selesai"] : ["menunggu_pembayaran", "dibayar", "diproses", "siap_diambil", "selesai"];
}
