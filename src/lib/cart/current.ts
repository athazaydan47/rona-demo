// Keranjang untuk request ini: keranjang akun bila pembeli sudah masuk, selain itu keranjang tamu dari cookie.
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { currentCustomer } from "@/lib/auth/current";
import { CART_COOKIE } from "./cookie";
import { createCart, ensureCustomerCart, findCartByCustomer, findCartByToken } from "./service";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function resolveCart(create: boolean): Promise<{ id: number; voucherCode: string | null } | null> {
  const customer = await currentCustomer();
  if (customer) return create ? ensureCustomerCart(db, customer.customerId) : findCartByCustomer(db, customer.customerId);
  const jar = await cookies();
  const found = await findCartByToken(db, jar.get(CART_COOKIE)?.value);
  if (found || !create) return found;
  const cart = await createCart(db);
  jar.set(CART_COOKIE, cart.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: COOKIE_MAX_AGE });
  return { id: cart.id, voucherCode: null };
}
