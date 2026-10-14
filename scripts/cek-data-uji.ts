// Tolak jalan bila database (DATABASE_URL dari .env.local) berisi data bernama uji (Fase 8B). Dipakai cuplik dan
// aset:portofolio supaya gambar hanya memperlihatkan data seed.
//   npx tsx scripts/cek-data-uji.ts
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("../src/db/schema");
  const { cariDataUji, ringkasDataUji } = await import("../src/lib/demo/data-uji");
  const client = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema, casing: "snake_case" });
    const temuan = await cariDataUji(db as never);
    if (temuan.length) {
      console.error(`Database berisi data uji (${ringkasDataUji(temuan)}), misal "${temuan[0].nilai}".`);
      console.error("Jalankan npm run db:reset (lalu npm run build bila server dari build lama), kemudian ulangi.");
      return 1;
    }
    return 0;
  } finally {
    await client.end();
  }
}

main().then((code) => process.exit(code), (e) => (console.error(e instanceof Error ? e.message : e), process.exit(1)));
