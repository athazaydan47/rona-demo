// Aturan koneksi database untuk skrip (migrasi, seed, reset) dan penjaga reset. Murni, diuji di connection.test.ts.

// Skrip migrasi memakai koneksi langsung (direct, tanpa pooler) bila tersedia; bila tidak, DATABASE_URL.
export function directUrl(env: Record<string, string | undefined> = process.env) {
  return env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL?.trim() || "";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function databaseHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isLocalDatabase(url: string) {
  return LOCAL_HOSTS.has(databaseHost(url));
}

export const RESET_CONFIRMATION = "rona-demo";

// db:reset menghapus seluruh data. Ke host selain localhost atau 127.0.0.1 wajib konfirmasi CONFIRM_RESET=rona-demo.
export function assertResetAllowed(url: string, env: Record<string, string | undefined> = process.env, command = "db:reset") {
  if (!url) throw new Error("DATABASE_URL belum diisi. Salin .env.example ke .env.local.");
  if (isLocalDatabase(url)) return;
  if (env.CONFIRM_RESET === RESET_CONFIRMATION) return;
  const host = databaseHost(url) || "(alamat tidak terbaca)";
  throw new Error(
    [
      `${command} ditolak: database tujuan ada di host ${host}, bukan localhost atau 127.0.0.1.`,
      `Perintah ini MENGHAPUS SEMUA data lalu mengisi ulang data demo.`,
      `Bila memang itu yang kamu mau (misal database Neon untuk demo), jalankan ulang dengan:`,
      `  CONFIRM_RESET=${RESET_CONFIRMATION} npm run ${command}`,
    ].join("\n"),
  );
}
