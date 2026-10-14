// Proxy (Node.js):
// 1. Memastikan /p/[slug] yang tidak ada mengembalikan HTTP 404 sungguhan.
// 2. /akun tanpa cookie sesi diarahkan ke /masuk, dan /admin tanpa cookie staf ke /admin/masuk, lalu kembali lagi.
// 3. Cookie sesi diperpanjang 30 hari saat pembeli aktif (paling sering sekali sehari, lewat cookie penanda).
//    Masa berlaku di database diperpanjang terpisah oleh readSession.
// Dengan Cache Components, slug yang tidak diprarender langsung dikirim sebagai App Shell (status 200),
// jadi pengecekan keberadaan produk dilakukan di sini sebelum routing, lalu direwrite ke rute 404 statis.
import { NextResponse, type NextRequest } from "next/server";
import postgres from "postgres";

const TTL_MS = 60_000;
// Hasil "tidak ada" hanya diingat sebentar supaya produk yang baru diaktifkan admin segera bisa dibuka.
const MISS_TTL_MS = 5_000;
const cache = new Map<string, { exists: boolean; at: number }>();
let sql: ReturnType<typeof postgres> | null = null;

function client() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    // Proxy cukup satu koneksi (pooled), hanya untuk cek keberadaan slug.
    sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  }
  return sql;
}

async function productExists(slug: string) {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < (hit.exists ? TTL_MS : MISS_TTL_MS)) return hit.exists;
  const db = client();
  if (!db) return true; // tanpa koneksi, biarkan halaman yang memutuskan
  try {
    const rows = await db`select 1 from products where slug = ${slug} and status = 'aktif' limit 1`;
    const exists = rows.length > 0;
    cache.set(slug, { exists, at: Date.now() });
    return exists;
  } catch {
    return true;
  }
}

const SESSION_COOKIE = "rona_sesi";
const STAFF_COOKIE = "rona_staf";
const SESSION_FRESH_COOKIE = "rona_sesi_segar";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function refreshSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || request.cookies.get(SESSION_FRESH_COOKIE)) return response;
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  response.cookies.set(SESSION_COOKIE, token, { ...opts, maxAge: SESSION_MAX_AGE });
  response.cookies.set(SESSION_FRESH_COOKIE, "1", { ...opts, maxAge: 24 * 60 * 60 });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Panel admin: tanpa cookie sesi staf langsung ke /admin/masuk, lalu kembali ke halaman tujuan.
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/masuk" && !request.cookies.get(STAFF_COOKIE)) {
    const url = new URL("/admin/masuk", request.url);
    url.searchParams.set("kembali", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (pathname === "/akun" || pathname.startsWith("/akun/")) {
    if (!request.cookies.get(SESSION_COOKIE)) {
      const url = new URL("/masuk", request.url);
      url.searchParams.set("kembali", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }
  const match = pathname.match(/^\/p\/([^/]+)$/);
  if (match) {
    const slug = decodeURIComponent(match[1]).toLowerCase();
    if (!/^[a-z0-9-]{1,120}$/.test(slug) || !(await productExists(slug))) {
      return NextResponse.rewrite(new URL("/produk-tidak-ada", request.url));
    }
  }
  return refreshSession(request, NextResponse.next());
}

export const config = {
  // Semua halaman, kecuali aset statis dan API.
  matcher: ["/((?!_next/|api/|images/|favicon.ico|robots.txt|.*\\.[a-z0-9]+$).*)"],
};
