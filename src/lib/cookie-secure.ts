// Atribut Secure untuk cookie sesi, keranjang, pesanan, dan profil kulit. Chrome menganggap localhost aman walau http,
// tetapi WebKit (Safari) membuang cookie Secure di http://localhost, sehingga build produksi lokal (uji Playwright
// WebKit, cuplik) kehilangan keranjang. Secure hanya saat benar-benar di balik https: Vercel atau NEXT_PUBLIC_SITE_URL https.
export const cookieSecure = () => process.env.VERCEL === "1" || (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
