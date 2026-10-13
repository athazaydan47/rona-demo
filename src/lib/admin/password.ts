// Hash kata sandi staf dengan scrypt bawaan node:crypto: memory-hard (disarankan OWASP bila Argon2 tidak tersedia),
// tanpa pustaka native sehingga pasti jalan di fungsi serverless Vercel. Format: scrypt$N$r$p$salt$hash (hex).
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(password: string, salt: string, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, KEYLEN, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  let salt: string;
  let hash: string;
  let opts: ScryptOptions;
  if (parts.length === 6 && parts[0] === "scrypt") {
    [, , , , salt, hash] = parts;
    opts = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  } else if (parts.length === 3 && parts[0] === "scrypt") {
    // Format lama dari seed Fase 1: scrypt$salt$hash dengan parameter bawaan.
    [, salt, hash] = parts;
    opts = { N: 16384, r: 8, p: 1 };
  } else return false;
  const expected = Buffer.from(hash, "hex");
  const given = await scrypt(password, salt, opts);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Hash tiruan supaya waktu respons untuk email yang tidak terdaftar sama dengan yang terdaftar.
export const DUMMY_HASH = "scrypt$16384$8$1$00000000000000000000000000000000$" + "0".repeat(64);

export function validateNewPassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 10) return "Kata sandi minimal 10 karakter.";
  if (pw.length > 200) return "Kata sandi terlalu panjang.";
  return null;
}
