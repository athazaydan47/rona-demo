// Hanya dipakai di server. Nilai publik diteruskan ke komponen lewat props. Bawaan studio dari src/config/merek.ts.
import { MEREK } from "@/config/merek";

export const env = {
  demoMode: process.env.DEMO_MODE === "true",
  studioName: process.env.STUDIO_NAME?.trim() || MEREK.studio.nama,
  studioUrl: process.env.STUDIO_URL?.trim() || MEREK.studio.url || "#",
  // Nomor WA studio (format 62...), untuk ajakan di /tentang-demo. Kosong: tombol WA tidak ditampilkan.
  studioWa: (process.env.STUDIO_WA || MEREK.studio.wa).replace(/\D/g, ""),
};
