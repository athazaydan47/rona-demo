// Perayap tautan internal situs toko (Fase 8A): mulai dari beranda, ikuti semua tautan <a href> ke halaman yang sama
// asal (tanpa /admin dan /api), dan pastikan tidak ada tautan mati. Juga memastikan halaman produk yang tidak ada
// menjawab 404 sungguhan.
//   npm run cek:404            (server di http://localhost:3000, ubah lewat env CUPLIK_URL)
//   npm run cek:404 -- --maks=300
const base = (process.env.CUPLIK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const maxPages = Number(process.argv.find((a) => a.startsWith("--maks="))?.slice(7) ?? 400);
const SKIP = /^\/(admin|api|art\b|_next)|\.(png|jpg|svg|xlsx|pdf)(\?|$)|^\/p\/[^/]+\/og\.png/;
// Halaman yang butuh sesi atau bersifat aksi: cukup dicek tidak 404 atau 500 (boleh dialihkan ke /masuk).
const SESSION = /^\/(akun|checkout|pesanan\/)/;

const seen = new Set();
const queue = ["/", "/tentang-demo", "/faq", "/cara-belanja", "/toko", "/hubungi", "/cek-ongkir", "/kebijakan/retur", "/kebijakan/privasi", "/kebijakan/syarat", "/kebijakan/pengiriman", "/advisor", "/kuis-kulit", "/rutinitas", "/padanan-shade", "/cari-dari-video", "/lacak", "/masuk", "/promo", "/flash-sale", "/merek", "/jurnal", "/keranjang"];
const bad = [];
let crawled = 0;

function normalize(href, from) {
  try {
    const u = new URL(href, base + from);
    if (u.origin !== new URL(base).origin) return null;
    u.hash = "";
    const p = u.pathname.replace(/\/$/, "") || "/";
    return p + (u.search && !/^\/(c\/|cari|merek\/|promo)/.test(p) ? u.search : u.search.slice(0, 80));
  } catch {
    return null;
  }
}

while (queue.length && crawled < maxPages) {
  const path = queue.shift();
  if (seen.has(path) || SKIP.test(path)) continue;
  seen.add(path);
  crawled += 1;
  let res;
  try {
    res = await fetch(base + path, { redirect: "manual", headers: { "user-agent": "rona-cek-404" } });
  } catch (err) {
    bad.push(`${path} -> gagal dihubungi (${err?.message ?? err})`);
    continue;
  }
  const status = res.status;
  if (status >= 300 && status < 400) {
    const to = normalize(res.headers.get("location") ?? "/", path);
    if (!SESSION.test(path) && !/^\/kebijakan-privasi/.test(path)) bad.push(`${path} -> dialihkan ${status} ke ${to}`);
    if (to && !seen.has(to)) queue.push(to);
    continue;
  }
  if (status !== 200) {
    bad.push(`${path} -> ${status}`);
    continue;
  }
  const html = await res.text();
  // Isi 404 yang dikirim dengan status 200: periksa HTML yang tampak saja (payload RSC di <script> memuat not-found
  // sebagai cadangan di setiap halaman, jadi diabaikan).
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");
  if (/<title>Produk tidak ditemukan|<h1[^>]*>Halaman ini belum ada/.test(visible)) bad.push(`${path} -> isi 404 dengan status 200`);
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    const next = normalize(m[1].replace(/&amp;/g, "&"), path);
    if (next && !seen.has(next) && !SKIP.test(next)) queue.push(next);
  }
}

// Produk yang tidak ada harus 404 sungguhan.
const r404 = await fetch(base + "/p/produk-yang-tidak-ada-xyz", { redirect: "manual" });
if (r404.status !== 404) bad.push(`/p/produk-yang-tidak-ada-xyz -> ${r404.status} (harap 404)`);
await r404.arrayBuffer();

console.log(`${crawled} halaman dirayapi dari ${base}${queue.length ? `, ${queue.length} tautan belum sempat dicek (batas ${maxPages})` : ""}.`);
for (const b of bad) console.log(`GAGAL ${b}`);
console.log(bad.length ? `${bad.length} tautan bermasalah.` : "Tidak ada tautan mati.");
process.exit(bad.length ? 1 : 0);
