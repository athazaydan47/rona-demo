// Identitas pembeli untuk satu request, hanya dari cookie sesi (tidak pernah dari isian formulir).
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db/client";
import { now } from "@/lib/clock";
import { readSession, SESSION_COOKIE, SESSION_FRESH_COOKIE, SESSION_TTL_MS, type SessionCustomer } from "./session";
import { cookieSecure } from "@/lib/cookie-secure";

export const currentCustomer = cache(async (): Promise<SessionCustomer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSession(db, token, now());
});

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: cookieSecure(),
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
});

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  jar.set(SESSION_FRESH_COOKIE, "1", { ...sessionCookieOptions(), maxAge: 24 * 60 * 60 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SESSION_FRESH_COOKIE);
}
