"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { ingatTokenPesanan, tokenPesananTersimpan } from "./token-cookie";
import { canAccessOrder, getOrderDetail } from "./queries";
import { expireIfDue } from "./service";
import { siteUrl } from "@/lib/site";
import { clientIp, hashKey } from "@/lib/security/rate-limit";
import { lacakPesanan } from "./lacak";

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

// Lacak tanpa login: nomor pesanan + nomor WA yang dipakai saat memesan. Aturannya di lacakPesanan (sama dengan chat asisten).
export async function trackOrderAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const r = await lacakPesanan(db, { nomor: String(formData.get("nomor") ?? ""), wa: String(formData.get("wa") ?? "") || " ", ipKey: hashKey(clientIp(await headers())) });
  if (!r.ok) return { error: r.alasan === "wa" ? "Nomor WhatsApp tidak valid." : r.pesan };
  await rememberToken(r.order.accessToken);
  redirect(`/pesanan/${r.order.number}?t=${r.order.accessToken}`);
}
