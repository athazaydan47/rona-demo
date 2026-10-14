"use client";

// Galat di root layout (jarang): tampilan minimal dengan warna Rona, tanpa bergantung pada layout.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#faf7f5", color: "#2a1f1d" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b8475d", fontWeight: 600 }}>Ada yang tersendat</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 28, margin: "8px 0" }}>Rona belum bisa dibuka</h1>
          <p style={{ color: "#6e615d" }}>Coba muat ulang sebentar lagi. Data belanjamu tetap aman.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 9999, border: 0, background: "#b8475d", color: "#fff", fontWeight: 600 }}>
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
