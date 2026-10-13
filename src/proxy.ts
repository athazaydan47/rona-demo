// Proxy (Node.js): memastikan /p/[slug] yang tidak ada mengembalikan HTTP 404 sungguhan.
// Dengan Cache Components, slug yang tidak diprarender langsung dikirim sebagai App Shell (status 200),
// jadi pengecekan keberadaan produk dilakukan di sini sebelum routing, lalu direwrite ke rute 404 statis.
import { NextResponse, type NextRequest } from "next/server";
import postgres from "postgres";

const TTL_MS = 60_000;
const cache = new Map<string, { exists: boolean; at: number }>();
let sql: ReturnType<typeof postgres> | null = null;

function client() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });
  }
  return sql;
}

async function productExists(slug: string) {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;
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

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/p\/([^/]+)$/);
  if (!match) return NextResponse.next();
  const slug = decodeURIComponent(match[1]).toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(slug) || !(await productExists(slug))) {
    return NextResponse.rewrite(new URL("/produk-tidak-ada", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/p/:slug"],
};
