// Memastikan halaman produk yang tidak ada mengembalikan HTTP 404 sungguhan, bukan 200 dengan isi 404.
//   npm run cek:404            (server di http://localhost:3000, ubah lewat env CUPLIK_URL)
const base = (process.env.CUPLIK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cases = [
  { path: "/p/produk-yang-tidak-ada-xyz", expect: 404 },
  { path: "/p/pualam-velvet-matte-cushion-spf-50", expect: 200 },
];
let failed = 0;
for (const c of cases) {
  let status = 0;
  try {
    const res = await fetch(base + c.path, { redirect: "manual" });
    status = res.status;
    await res.arrayBuffer();
  } catch (err) {
    console.error(`Gagal menghubungi ${base}${c.path}: ${err?.message ?? err}`);
    process.exit(1);
  }
  const ok = status === c.expect;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK " : "GAGAL"} ${c.path} -> ${status} (harap ${c.expect})`);
}
process.exit(failed ? 1 : 0);
