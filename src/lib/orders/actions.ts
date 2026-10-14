"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { ingatTokenPesanan, tokenPesananTersimpan } from "./token-cookie";
import { canAccessOrder, getOrderDetail } from "./queries";
import { normalizePhone } from "./rules";
import { expireIfDue } from "./service";
import { siteUrl } from "@/lib/site";
import { POLA_NOMOR_PESANAN, contohNomorPesanan } from "@/config/merek";
import { BATAS, clientIp, hashKey, rateLimit } from "@/lib/security/rate-limit";

const cookieTokens = tokenPesananTersimpan;
const rememberToken = ingatTokenPesanan;

// Dipakai halaman bayar untuk memantau status (dengan pengecekan kedaluwarsa malas).
export async function orderStatusAction(number: string, token: string | null): Promise<{ status: string } | null> {
  if (typeof number !== "string" || number.length > 30) return null;
  await expireIfDue(db, number, undefined, siteUrl());
  const order = await getOrderDetail(db, number);
  if (!order || !canAccessOrder(order, token, await cookieTokens(), (await currentCustomer())?.customerId)) return null;
  return { status: order.status };
}

export type VerifyState = { error?: string };

// Lacak tanpa login: nomor pesanan + nomor WA yang dipakai saat memesan.
export async function trackOrderAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const number = String(formData.get("nomor") ?? "").trim().toUpperCase();
  const phone = normalizePhone(String(formData.get("wa") ?? ""));
  if (!POLA_NOMOR_PESANAN.test(number)) return { error: `Format nomor pesanan: ${contohNomorPesanan()}.` };
  if (!phone) return { error: "Nomor WhatsApp tidak valid." };
  // Batas tebakan (Fase 8B): per IP dan per nomor pesanan, di database supaya berlaku di semua instance.
  const ip = hashKey(clientIp(await headers()));
  const [perIp, perNomor] = [BATAS.lacakPerIp, BATAS.lacakPerNomor];
  const a = await rateLimit(db, `lacak:ip:${ip}`, perIp.limit, perIp.windowMs);
  const b = await rateLimit(db, `lacak:nomor:${hashKey(number)}`, perNomor.limit, perNomor.windowMs);
  if (!a.ok || !b.ok) return { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(Math.max(a.retryAfterSec, b.retryAfterSec) / 60)} menit, ya.` };
  const order = await getOrderDetail(db, number);
  if (!order || order.phone !== phone) return { error: "Pesanan tidak ditemukan. Cek lagi nomor pesanan dan nomor WhatsApp yang kamu pakai saat memesan." };
  await rememberToken(order.accessToken);
  redirect(`/pesanan/${order.number}?t=${order.accessToken}`);
}
