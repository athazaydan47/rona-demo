import { timingSafeEqual } from "node:crypto";

// Vercel Cron mengirim header "Authorization: Bearer <CRON_SECRET>" bila env CRON_SECRET diisi.
// Penjadwal lain atau pemanggilan manual memakai header yang sama, lewat GET atau POST.
export function isAuthorizedCron(authorization: string | null | undefined, secret: string | undefined) {
  if (!secret) return false;
  const given = (authorization ?? "").trim();
  const expected = `Bearer ${secret}`;
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
