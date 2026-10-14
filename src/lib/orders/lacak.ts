// Lacak pesanan (satu aturan untuk halaman /lacak dan chat asisten, Fase 8C): nomor pesanan dan nomor WA saat memesan
// harus cocok, atau pembeli yang masuk membuka pesanan miliknya sendiri. Batas tebakan per IP dan per nomor pesanan di
// database. Pesan untuk nomor yang tidak ada dan nomor WA yang salah sama, supaya keberadaan pesanan tidak bocor.
import type { AnyDb } from "@/lib/db-types";
import { POLA_NOMOR_PESANAN, contohNomorPesanan } from "@/config/merek";
import { BATAS, hashKey, rateLimit } from "@/lib/security/rate-limit";
import { formatDateTimeWib } from "@/lib/format";
import { getOrderDetail, type OrderDetail } from "./queries";
import { normalizePhone } from "./rules";
import { statusLabels, type OrderStatus } from "./status";

export type LacakInput = { nomor: string; wa?: string | null; customerId?: number | null; ipKey: string; now?: Date };
export type LacakHasil = { ok: true; order: OrderDetail } | { ok: false; alasan: "format" | "wa" | "tidak_cocok" | "terbatas"; pesan: string };

export const PESAN_TIDAK_COCOK = "Pesanan tidak ditemukan. Cek lagi nomor pesanan dan nomor WhatsApp yang kamu pakai saat memesan.";

export async function lacakPesanan(db: AnyDb, input: LacakInput): Promise<LacakHasil> {
  const nomor = String(input.nomor ?? "").trim().toUpperCase();
  if (!POLA_NOMOR_PESANAN.test(nomor)) return { ok: false, alasan: "format", pesan: `Format nomor pesanan: ${contohNomorPesanan()}.` };
  const phone = input.wa ? normalizePhone(String(input.wa)) : null;
  if (!input.customerId && !phone) return { ok: false, alasan: "wa", pesan: input.wa ? "Nomor WhatsApp tidak valid." : "Sebutkan juga nomor WhatsApp yang kamu pakai saat memesan, ya." };
  const [perIp, perNomor] = [BATAS.lacakPerIp, BATAS.lacakPerNomor];
  const a = await rateLimit(db, `lacak:ip:${input.ipKey}`, perIp.limit, perIp.windowMs, input.now);
  const b = await rateLimit(db, `lacak:nomor:${hashKey(nomor)}`, perNomor.limit, perNomor.windowMs, input.now);
  if (!a.ok || !b.ok) return { ok: false, alasan: "terbatas", pesan: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(Math.max(a.retryAfterSec, b.retryAfterSec) / 60)} menit, ya.` };
  const order = await getOrderDetail(db, nomor);
  // Pembeli yang masuk cukup nomor pesanan miliknya; selain itu nomor WA harus sama dengan yang tercatat.
  const milikSendiri = Boolean(order && input.customerId && order.customerId === input.customerId);
  if (!order || (!milikSendiri && (!phone || order.phone !== phone))) return { ok: false, alasan: "tidak_cocok", pesan: input.customerId && !phone ? "Pesanan itu tidak ada di akunmu. Sebutkan juga nomor WhatsApp saat memesan bila memesan tanpa masuk." : PESAN_TIDAK_COCOK };
  return { ok: true, order };
}

// Kartu status untuk chat asisten: status, metode, lini masa singkat, dan jumlah barang. Tanpa nama, nomor WA, email,
// alamat, atau isi catatan.
export type KartuPesananData = { nomor: string; status: string; statusLabel: string; metode: "kirim" | "ambil"; cabang: string | null; kurir: string | null; resi: string | null; dibuat: string; jumlahBarang: number; total: number; lini: { label: string; waktu: string }[]; href: string };

export function kartuPesanan(order: OrderDetail): KartuPesananData {
  const label = (s: string) => statusLabels[s as OrderStatus] ?? s;
  return {
    nomor: order.number,
    status: order.status,
    statusLabel: label(order.status),
    metode: order.method,
    cabang: order.method === "ambil" ? order.location.name : null,
    kurir: order.method === "kirim" ? [order.courier, order.service].filter(Boolean).join(" ") || null : null,
    resi: order.shipment?.trackingNumber ?? null,
    dibuat: formatDateTimeWib(order.createdAt),
    jumlahBarang: order.items.reduce((s, i) => s + i.quantity, 0),
    total: order.pricing.total,
    lini: order.history.slice(-5).map((h) => ({ label: label(h.toStatus), waktu: formatDateTimeWib(h.at) })),
    href: `/pesanan/${order.number}?t=${order.accessToken}`,
  };
}
