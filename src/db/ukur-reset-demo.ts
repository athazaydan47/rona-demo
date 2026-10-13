// Ukur durasi reset data demo (jalur yang sama dengan cron harian), termasuk jumlah kueri.
//   DEMO_MODE=true npm run demo:ukur-reset                 database dari .env.local (pooled, seperti di Vercel)
//   LATENSI_MS=30 DEMO_MODE=true npm run demo:ukur-reset   simulasi jaringan: setiap paket ditunda 30 ms per arah
// Ke host selain localhost wajib CONFIRM_RESET=rona-demo karena seluruh data diganti.
import { config } from "dotenv";
config({ path: ".env.local" });

import net from "node:net";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { assertResetAllowed } from "./connection";
import type { AnyDb } from "../lib/db-types";
import { resetDemoData } from "../lib/demo/reset";

// Proxy TCP sederhana yang menunda setiap potongan data, untuk meniru jarak ke database jauh.
function latencyProxy(targetHost: string, targetPort: number, delayMs: number): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = net.createServer((client) => {
      const upstream = net.connect(targetPort, targetHost);
      const pipe = (from: net.Socket, to: net.Socket) => from.on("data", (chunk) => setTimeout(() => to.write(chunk), delayMs));
      pipe(client, upstream);
      pipe(upstream, client);
      const end = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on("close", end).on("error", end);
      upstream.on("close", end).on("error", end);
    });
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, close: () => server.close() }));
  });
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  assertResetAllowed(url, process.env, "demo:ukur-reset");
  const delay = Number(process.env.LATENSI_MS ?? 0);
  let connUrl = url;
  let proxy: { port: number; close: () => void } | null = null;
  if (delay > 0) {
    const u = new URL(url);
    proxy = await latencyProxy(u.hostname, Number(u.port || 5432), delay);
    u.hostname = "127.0.0.1";
    u.port = String(proxy.port);
    connUrl = u.toString();
  }
  let queries = 0;
  const client = postgres(connUrl, { max: 1, prepare: false, onnotice: () => {}, debug: () => void (queries += 1) });
  const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as AnyDb;
  try {
    const r = await resetDemoData(db, { source: "uji" });
    console.log(`Reset data demo selesai dalam ${r.durationMs} ms (kosongkan ${r.truncateMs} ms, seed ${r.seedMs} ms), ${queries} kueri${delay ? `, latensi tiruan ${delay} ms per arah` : ""}.`);
    console.log(`Isi: ${r.summary.products} produk, ${r.summary.variants} varian, ${r.summary.inventory} baris stok, ${r.summary.reviews} ulasan, ${r.summary.demoOrders} pesanan demo. Foto: ${r.photos.kind}, ${r.photos.deleted} dihapus.`);
  } finally {
    await client.end();
    proxy?.close();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
