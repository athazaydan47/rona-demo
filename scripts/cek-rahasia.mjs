// Pindai seluruh riwayat git untuk rahasia yang tidak sengaja ter-commit (Fase 8B). Hanya melapor; riwayat tidak
// pernah ditulis ulang otomatis. Bila ada temuan: putar ulang (ganti) rahasianya dulu, lihat docs/OPERASIONAL.md.
//   npm run cek:rahasia
import { execSync } from "node:child_process";

const POLA = [
  ["Kunci Google/Gemini", /AIza[0-9A-Za-z_-]{30,}/],
  ["Kunci Resend", /\bre_[A-Za-z0-9]{20,}/],
  ["Token Vercel Blob", /vercel_blob_rw_[A-Za-z0-9]{10,}/],
  ["Token GitHub", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Kunci privat", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Connection string berkata sandi", /postgres(?:ql)?:\/\/[^:@/\s"']+:[^@/\s"'<*]{6,}@(?!localhost|127\.0\.0\.1)/],
  ["Nilai env rahasia", /\b(?:GEMINI_API_KEY|CF_AIG_TOKEN|SESSION_SECRET|CRON_SECRET|PAYMENT_WEBHOOK_SECRET|RESEND_API_KEY|BLOB_READ_WRITE_TOKEN|SENTRY_DSN)=["']?[A-Za-z0-9_\-+/=.:@]{12,}/],
];

const commits = execSync("git rev-list --all", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const envFiles = execSync("git log --all --full-history --name-only --pretty=format: -- '.env' '.env.local' '.env.production' '.env.development'", { encoding: "utf8" }).trim();
const log = execSync("git log -p --all --no-color", { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const temuan = [];
let commit = "";
for (const line of log.split("\n")) {
  if (line.startsWith("commit ")) commit = line.slice(7, 15);
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  for (const [nama, re] of POLA) if (re.test(line)) temuan.push(`${commit} ${nama}: ${line.slice(1, 90).replace(re, "[disamarkan]")}`);
}
console.log(`${commits.length} commit dipindai.`);
if (envFiles) console.log(`PERINGATAN: berkas env pernah di-commit: ${envFiles.split("\n").filter(Boolean).join(", ")}`);
for (const t of temuan) console.log(`TEMUAN ${t}`);
console.log(temuan.length || envFiles ? `${temuan.length} temuan.` : "Tidak ada rahasia di riwayat git.");
process.exit(temuan.length || envFiles ? 1 : 0);
