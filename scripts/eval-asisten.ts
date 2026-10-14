// Evaluasi Asisten Admin: npm run eval:asisten (atau -- --mock untuk mock, -- --peran=owner, -- --hanya=id1,id2).
// Untuk setiap pertanyaan diperiksa: tool yang dipanggil sesuai harapan; angka omzet di jawaban sama dengan summarize()
// di src/lib/reports untuk periode dan cabang itu; peran dihormati (tanpa angka rupiah untuk peran tanpa izin keuangan,
// tool di luar izin tidak pernah dijalankan); pertanyaan balik terjadi saat seharusnya; aksi tulis menjadi draf atau
// ditolak; dan penjaga angka tidak memberi peringatan. Hasilnya tabel skor per peran. Dilewati bila kunci AI tidak ada.
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { costUsd, IDR_PER_USD, IDR_RATE_NOTE } from "../src/lib/ai/pricing";

config({ path: ".env.local" });

type Harapan = { tool?: string[]; omzet?: string; cabang?: string; tanpaRp?: boolean; tolak?: boolean; tanyaBalik?: boolean; draf?: boolean; drafAtauTolak?: boolean; bebas?: boolean };
type Scenario = { id: string; peran: "owner" | "admin_online" | "staf_cabang" | "gudang"; pertanyaan: string; harapan: Harapan };

const EMAIL: Record<Scenario["peran"], string> = { owner: "owner@rona.demo", admin_online: "admin@rona.demo", staf_cabang: "dinoyo@rona.demo", gudang: "gudang@rona.demo" };
const REFUSAL = /maaf|tidak (bisa|dapat|punya|memiliki)|bukan wewenang|di luar (izin|wewenang|akses)|tidak berwenang|izin|akses/i;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const { db, schema } = await import("../src/db/client");
  const { eq, desc } = await import("drizzle-orm");
  const { aiConfig, aiModel } = await import("../src/lib/ai");
  const { loadPrincipal } = await import("../src/lib/admin/auth");
  const { runAssistant } = await import("../src/lib/asisten/otak");
  const { parsePeriode } = await import("../src/lib/asisten/periode");
  const { numbersInText, matchesSource } = await import("../src/lib/asisten/angka");
  const { summarize } = await import("../src/lib/reports");
  const { loadReportData } = await import("../src/lib/reports/load");

  const mock = process.argv.includes("--mock");
  const cfg = aiConfig(mock ? { ...process.env, AI_PROVIDER: "mock" } : process.env);
  if (cfg.provider === "none") {
    console.log("Evaluasi dilewati: AI_GATEWAY_URL dan GEMINI_API_KEY belum diisi.");
    process.exit(0);
  }
  const model = aiModel(cfg)!;
  const { skenario } = JSON.parse(readFileSync("evals/asisten.json", "utf8")) as { skenario: Scenario[] };
  const only = arg("hanya")?.split(",");
  const role = arg("peran");
  const list = skenario.filter((s) => (!only || only.includes(s.id)) && (!role || s.peran === role));
  const now = new Date();

  const staff = new Map<string, Awaited<ReturnType<typeof loadPrincipal>>>();
  for (const [peran, email] of Object.entries(EMAIL)) {
    const [s] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.email, email));
    staff.set(peran, s ? await loadPrincipal(db, s.id) : null);
  }
  const [anyOrder] = await db.select({ number: schema.orders.number }).from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(1);
  const [dinoyo] = await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.slug, "dinoyo"));
  const [dinoyoOrder] = await db.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.locationId, dinoyo.id)).orderBy(desc(schema.orders.createdAt)).limit(1);
  const fill = (q: string) => q.replace("{nomorPesanan}", anyOrder?.number ?? "RONA-0000-000000").replace("{nomorDinoyo}", dinoyoOrder?.number ?? "RONA-0000-000000");
  console.log(`Model: ${model.name}${cfg.provider === "gemini" ? `, tingkat berpikir ${cfg.thinkingLevel}` : ""}, ${list.length} pertanyaan\n`);

  type Row = { s: Scenario; checks: Record<string, boolean>; detail: string; ms: number; input: number; output: number; tools: string[] };
  const rows: Row[] = [];
  for (const s of list) {
    const me = staff.get(s.peran);
    if (!me) throw new Error(`Akun ${EMAIL[s.peran]} tidak ada. Jalankan npm run db:reset.`);
    const q = fill(s.pertanyaan);
    const t0 = Date.now();
    const r = await runAssistant({ db, model, staff: me, now, door: "eval", timeoutMs: 40_000 }, [{ role: "user", text: q }]);
    const ms = Date.now() - t0;
    const h = s.harapan;
    const text = [r.teks, ...(r.tabel?.baris.flat() ?? [])].join(" ");
    const dataTools = r.toolCalls.filter((t) => t !== "panduan_admin");
    // Pertanyaan balik: kalimat tanya, atau ajakan memilih di antara kandidat.
    const asked = /\?|yang mana|pilih|maksud(mu| kamu)/i.test(r.teks);
    const checks: Record<string, boolean> = { jawab: r.ok, penjagaAngka: !r.peringatan, tanpaToolTerlarang: r.denied.length === 0 };
    if (h.tool) checks.tool = h.tool.some((t) => r.toolCalls.includes(t));
    if (h.tolak) checks.peran = dataTools.length === 0 && REFUSAL.test(r.teks);
    if (h.tanyaBalik) checks.tanyaBalik = asked || r.pilihan.length > 0;
    if (h.draf) checks.draf = r.toolCalls.some((t) => t.startsWith("saran_")) && (r.tautan.some((l) => l.href.includes("draf=")) || /draf|formulir/i.test(r.teks));
    if (h.drafAtauTolak) checks.draf = (r.toolCalls.some((t) => t.startsWith("saran_")) && (r.tautan.some((l) => l.href.includes("draf")) || /draf|formulir|transfer/i.test(r.teks))) || (dataTools.length === 0 && REFUSAL.test(r.teks));
    if (h.tanpaRp) checks.peran = !/Rp\s?\d/.test(text);
    if (h.omzet) {
      const p = parsePeriode(h.omzet, now);
      const ids = h.cabang ? (await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.slug, h.cabang))).map((x) => x.id) : null;
      const expected = p.ok ? summarize(await loadReportData(db, p.periode, { locationIds: ids })).revenue : -1;
      checks.angka = numbersInText(text).some((n) => (n.kind === "rupiah" || n.kind === "skala") && matchesSource(n, [expected]));
    }
    rows.push({ s, checks, detail: `${r.teks.replace(/\s+/g, " ").slice(0, 120)}${r.error ? ` [${r.error}]` : ""}`, ms, input: r.usage.input, output: r.usage.output, tools: r.toolCalls });
    process.stdout.write(Object.values(checks).every(Boolean) ? "." : "x");
  }
  console.log("\n");
  const keys = ["jawab", "tool", "angka", "peran", "tanyaBalik", "draf", "penjagaAngka", "tanpaToolTerlarang"];
  console.log(["Skenario".padEnd(18), ...keys.map((k) => k.slice(0, 11).padEnd(11)), "ms".padStart(6), "token".padStart(6)].join(" "));
  for (const r of rows) console.log([r.s.id.padEnd(18), ...keys.map((k) => (r.checks[k] === undefined ? "-" : r.checks[k] ? "lulus" : "GAGAL").padEnd(11)), String(r.ms).padStart(6), String(r.input + r.output).padStart(6)].join(" "));
  console.log("\nSkor per peran:");
  for (const peran of Object.keys(EMAIL)) {
    const mine = rows.filter((r) => r.s.peran === peran);
    if (!mine.length) continue;
    console.log(`  ${peran.padEnd(13)} ${mine.filter((r) => Object.values(r.checks).every(Boolean)).length}/${mine.length}`);
  }
  const passed = rows.filter((r) => Object.values(r.checks).every(Boolean)).length;
  const avgIn = Math.round(rows.reduce((s, r) => s + r.input, 0) / Math.max(1, rows.length));
  const avgOut = Math.round(rows.reduce((s, r) => s + r.output, 0) / Math.max(1, rows.length));
  console.log(`\nTotal: ${passed}/${rows.length} pertanyaan lulus semua pemeriksaan.`);
  console.log(`Token rata-rata ${avgIn + avgOut} per pertanyaan (masuk ${avgIn}, keluar ${avgOut}); latensi median ${median(rows.map((r) => r.ms))} ms.`);
  const usd = costUsd(model.name, avgIn, avgOut, now);
  console.log(usd == null ? `Biaya: model ${model.name} tidak ada di tarif resmi.` : `Biaya: $${usd.toFixed(5)} per pertanyaan (sekitar Rp ${Math.round(usd * IDR_PER_USD).toLocaleString("id-ID")}, ${IDR_RATE_NOTE}), $${(usd * 1000).toFixed(2)} per 1.000 pertanyaan.`);
  for (const r of rows.filter((x) => !Object.values(x.checks).every(Boolean))) console.log(`  ${r.s.id} [${r.tools.join(",") || "tanpa tool"}] ${Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k).join(",")}: ${r.detail}`);
  process.exit(passed === rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
