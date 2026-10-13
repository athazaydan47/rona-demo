"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { ORDERS_COOKIE } from "@/lib/cart/cookie";
import { canAccessOrder, getOrderDetail } from "./queries";
import { normalizePhone } from "./rules";
import { expireIfDue } from "./service";
import { siteUrl } from "@/lib/site";

async function cookieTokens() {
  return ((await cookies()).get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean);
}

async function rememberToken(token: string) {
  const jar = await cookies();
  const prev = (jar.get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean).filter((t) => t !== token).slice(-9);
  jar.set(ORDERS_COOKIE, [...prev, token].join("."), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

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
  if (!/^RONA-\d{4}-\d{6,}$/.test(number)) return { error: "Format nomor pesanan: RONA-2610-000123." };
  if (!phone) return { error: "Nomor WhatsApp tidak valid." };
  const order = await getOrderDetail(db, number);
  if (!order || order.phone !== phone) return { error: "Pesanan tidak ditemukan. Cek lagi nomor pesanan dan nomor WhatsApp yang kamu pakai saat memesan." };
  await rememberToken(order.accessToken);
  redirect(`/pesanan/${order.number}?t=${order.accessToken}`);
}
