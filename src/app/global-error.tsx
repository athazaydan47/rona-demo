"use client";

import { useEffect } from "react";
import { MEREK } from "@/config/merek";
import { laporGalatKlien } from "@/lib/galat-klien";

// Galat di root layout (jarang): tampilan minimal dengan warna merek, tanpa bergantung pada layout.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    laporGalatKlien(error);
  }, [error]);
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif", background: MEREK.palet.porselen, color: MEREK.palet.kopi }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: MEREK.palet.aksen, fontWeight: 600 }}>Ada yang tersendat</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 28, margin: "8px 0" }}>{MEREK.nama} belum bisa dibuka</h1>
          <p style={{ color: MEREK.palet.abuHangat }}>Coba muat ulang sebentar lagi. Data belanjamu tetap aman.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 9999, border: 0, background: MEREK.palet.aksen, color: "#fff", fontWeight: 600 }}>
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
