// Hanya dipakai di server. Nilai publik diteruskan ke komponen lewat props.
export const env = {
  demoMode: process.env.DEMO_MODE === "true",
  studioName: process.env.STUDIO_NAME?.trim() || "Studio",
  studioUrl: process.env.STUDIO_URL?.trim() || "#",
};
