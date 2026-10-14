// Token akses pesanan tamu yang diingat perangkat (Fase 8B: satu tempat untuk baca dan tulis). Cookie httpOnly berisi
// paling banyak 10 token terakhir dipisah titik, supaya tamu bisa membuka pesanannya lagi tanpa tautan.
import { cookies } from "next/headers";
import { ORDERS_COOKIE } from "@/lib/cart/cookie";
import { cookieSecure } from "@/lib/cookie-secure";

const MAKS_TOKEN = 10;
const UMUR_DETIK = 60 * 60 * 24 * 90;

export async function tokenPesananTersimpan(): Promise<string[]> {
  return ((await cookies()).get(ORDERS_COOKIE)?.value ?? "").split(".").filter(Boolean);
}

export async function ingatTokenPesanan(token: string) {
  const jar = await cookies();
  const prev = (jar.get(ORDERS_COOKIE)?.value ?? "").split(".").filter((t) => t && t !== token).slice(-(MAKS_TOKEN - 1));
  jar.set(ORDERS_COOKIE, [...prev, token].join("."), { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: UMUR_DETIK });
}
