// Kirim galat dari halaman galat ke server (Fase 8B). Hanya pesan singkat, digest, dan path; tanpa query, cookie,
// atau isi halaman. Server mencatatnya dan meneruskan ke Sentry bila SENTRY_DSN diisi. Gagal kirim diabaikan.
export function laporGalatKlien(error: Error & { digest?: string }) {
  try {
    void fetch("/api/galat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pesan: error.message?.slice(0, 300), digest: error.digest, url: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // abaikan
  }
}
