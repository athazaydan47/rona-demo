// Staf untuk satu request, hanya dari cookie sesi staf.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db/client";
import { now } from "@/lib/clock";
import { readStaffSession, STAFF_COOKIE } from "./auth";
import type { StaffPrincipal } from "./permissions";

export const currentStaff = cache(async (): Promise<StaffPrincipal | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  return readStaffSession(db, token, now());
});

export async function requireStaff(path: string): Promise<StaffPrincipal> {
  const s = await currentStaff();
  if (!s) redirect(`/admin/masuk?kembali=${encodeURIComponent(path)}`);
  return s;
}

export const staffCookieOptions = (expires: Date) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires });
