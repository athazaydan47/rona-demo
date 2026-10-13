// URL situs untuk tautan absolut (notifikasi, berbagi, JSON-LD, gambar OG).
// Urutan: NEXT_PUBLIC_SITE_URL, domain produksi Vercel, URL deployment Vercel, lalu localhost hanya untuk lokal.
export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;
  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment}`;
  return "http://localhost:3000";
}
