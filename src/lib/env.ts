// Hanya dipakai di server. Nilai publik diteruskan ke komponen lewat props.
export const env = {
  demoMode: process.env.DEMO_MODE === "true",
  studioName: process.env.STUDIO_NAME?.trim() || "Studio",
  studioUrl: process.env.STUDIO_URL?.trim() || "#",
  // Nomor WA studio (format 62...), untuk ajakan di /tentang-demo. Kosong: tombol WA tidak ditampilkan.
  studioWa: (process.env.STUDIO_WA ?? "").replace(/\D/g, ""),
};
