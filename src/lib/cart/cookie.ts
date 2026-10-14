import { namaCookie } from "@/config/merek";
// Nama cookie token keranjang tamu (httpOnly). Dipisah karena file "use server" hanya boleh mengekspor fungsi async.
export const CART_COOKIE = namaCookie("cart");
export const ORDERS_COOKIE = namaCookie("pesanan");
