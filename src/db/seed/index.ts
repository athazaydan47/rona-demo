import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import type { AnyDb } from "../../lib/db-types";
import { assertResetAllowed, directUrl } from "../connection";
import { articleSeed, staffSeed, voucherSeed } from "./content";
import { seedAll } from "./all";

export { seedAll };

export async function runSeed(url = directUrl()) {
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  try {
    const r = await seedAll(db as unknown as AnyDb, new Date());
    console.log(
      `Seed selesai: ${r.brands} merek, ${r.categories} kategori, ${r.locations} lokasi, ${r.products} produk, ${r.variants} varian, ${r.inventory} baris stok, ${r.reviews} ulasan, 8 slot flash sale, ${voucherSeed.length} voucher, ${articleSeed.length} artikel, ${staffSeed.length} akun staf, riwayat ${r.historyOrders} pesanan dari ${r.historyCustomers} pelanggan, pembeli demo dengan ${r.demoOrders} pesanan.`,
    );
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1]?.endsWith("seed/index.ts") || process.argv[1]?.endsWith("seed");
if (isMain) {
  // db:seed langsung ke host jauh juga butuh konfirmasi, sama seperti db:reset.
  Promise.resolve()
    .then(() => assertResetAllowed(directUrl(), process.env, "db:seed"))
    .then(() => runSeed())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
