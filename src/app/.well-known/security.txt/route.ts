// /.well-known/security.txt (RFC 9116, Fase 8B): cara melaporkan celah keamanan. Kontak dan alamat dari konfigurasi
// merek dan NEXT_PUBLIC_SITE_URL, jadi ikut berganti saat reskin. Masa berlaku selalu satu tahun ke depan.
import { connection } from "next/server";
import { MEREK } from "@/config/merek";
import { siteUrl } from "@/lib/site";

export async function GET() {
  await connection();
  const expires = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const body = [
    `# Kebijakan pelaporan celah keamanan ${MEREK.namaLengkap}.`,
    "# Mohon laporkan lewat email; jangan menguji dengan cara yang mengganggu pengunjung lain (tanpa DoS, tanpa spam",
    "# notifikasi, tanpa mengakses data orang lain).",
    `Contact: mailto:${MEREK.kontak.email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: id, en",
    `Canonical: ${siteUrl()}/.well-known/security.txt`,
    `Policy: ${siteUrl()}/kebijakan/privasi`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
