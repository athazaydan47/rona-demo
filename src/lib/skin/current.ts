// Profil kulit pengunjung saat ini: dari akun bila masuk, selain itu dari cookie tamu.
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { SkinProfile } from "@/db/schema/customers";
import { db } from "@/db/client";
import { getProfile, saveSkinProfile } from "@/lib/account/profile";
import { currentCustomer } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { decodeProfileCookie, encodeProfileCookie, PROFILE_COOKIE, PROFILE_COOKIE_MAX_AGE, shouldAdoptGuestProfile } from "./profile";
import { cookieSecure } from "@/lib/cookie-secure";

export async function currentSkinProfile(): Promise<SkinProfile | null> {
  // Data per pengunjung dan jam: hanya saat request, tidak ikut prerender.
  await connection();
  const me = await currentCustomer();
  if (me) {
    const p = await getProfile(db, me.customerId);
    if (p?.skinProfile) return p.skinProfile;
  }
  return decodeProfileCookie((await cookies()).get(PROFILE_COOKIE)?.value, now());
}

// Simpan profil: ke akun bila masuk, selain itu ke cookie tamu (digabung ke akun saat masuk). Hanya di server action.
export async function storeSkinProfile(profile: SkinProfile) {
  const me = await currentCustomer();
  if (me) {
    await saveSkinProfile(db, me.customerId, profile);
    return "akun" as const;
  }
  (await cookies()).set(PROFILE_COOKIE, encodeProfileCookie(profile), { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: PROFILE_COOKIE_MAX_AGE });
  return "cookie" as const;
}

// Dipanggil setelah masuk: profil tamu dipakai bila akun belum punya profil atau profil tamu lebih baru.
export async function adoptGuestProfile(customerId: number) {
  const jar = await cookies();
  const guest = decodeProfileCookie(jar.get(PROFILE_COOKIE)?.value, now());
  if (!guest) return;
  const p = await getProfile(db, customerId);
  if (shouldAdoptGuestProfile(p?.skinProfile, guest)) await saveSkinProfile(db, customerId, guest);
  jar.delete(PROFILE_COOKIE);
}
