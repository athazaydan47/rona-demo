// Perbarui ringkasan ulasan AI untuk semua produk yang daftar ulasannya berubah (sama dengan langkah cron harian).
// npm run ai:ringkasan, atau AI_PROVIDER=mock npm run ai:ringkasan untuk ringkasan mock.
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/client");
  const { aiModel } = await import("../src/lib/ai");
  const { refreshAllReviewSummaries } = await import("../src/lib/ai/review-summary");
  const model = aiModel("aiPembeli");
  if (!model) {
    console.log("AI tidak tersedia: isi AI_GATEWAY_URL dan GEMINI_API_KEY, atau pakai AI_PROVIDER=mock.");
    process.exit(0);
  }
  const r = await refreshAllReviewSummaries(db, model, new Date());
  console.log(`Ringkasan ulasan (${model.name}): ${r.dibuat} dibuat, ${r.sama} tidak berubah, ${r.dihapus} dihapus, ${r.gagal} gagal.`);
  process.exit(r.gagal ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
