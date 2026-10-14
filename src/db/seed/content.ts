import { ROLE_SLUGS, ROLE_TEMPLATES, type RoleSlug } from "../../lib/admin/permissions";
import { DEFAULT_SETTINGS, settingsRows } from "../../lib/settings";
export const articleSeed = [
  {
    slug: "cara-memilih-shade-cushion-untuk-kulit-sawo-matang",
    title: "Cara memilih shade cushion untuk kulit sawo matang",
    excerpt:
      "Shade terlalu terang bikin wajah abu-abu, terlalu gelap bikin kusam. Ini cara cepat menemukan yang pas tanpa coba semua.",
    author: "Tim Rona",
    products: ["pualam-velvet-matte-cushion-spf-50", "pualam-second-skin-foundation", "pualam-translucent-loose-powder"],
    body: `## Kenali dulu kedalaman dan undertone

Kedalaman kulit (terang sampai gelap) itu beda dengan undertone (warm, neutral, cool). Dua orang dengan kedalaman sama bisa butuh shade berbeda karena undertonenya beda.

Cara cepat cek undertone: lihat urat di pergelangan tangan di bawah cahaya alami. Kehijauan berarti warm, kebiruan berarti cool, campuran berarti neutral.

## Tes di rahang, bukan di tangan

Oleskan tiga shade terdekat di garis rahang, tunggu 10 menit supaya oksidasi selesai, lalu lihat mana yang paling menyatu ke leher. Di Rona, kamu bisa pakai fitur Cari shade-ku di halaman produk untuk menyaring kandidatnya.

## Kalau ragu, ambil yang sedikit lebih gelap

Shade yang sedikit lebih gelap biasanya lebih menyatu dengan leher daripada yang lebih terang. Kamu juga bisa menyamakannya dengan bedak tabur.`,
  },
  {
    slug: "rutinitas-pagi-5-menit-untuk-kulit-berminyak",
    title: "Rutinitas pagi 5 menit untuk kulit berminyak",
    excerpt: "Empat langkah ringan yang cukup untuk cuaca Malang yang panas dan lembap.",
    author: "Tim Rona",
    products: ["teduh-low-ph-gel-wash", "kirana-lab-niacinamide-pore-toner", "embun-water-gel-moisturizer", "surya-shield-gel-sunscreen-spf-50-pa"],
    body: `## 1. Cuci muka dengan gel wash pH rendah

Pembersih yang terlalu keras justru memicu kulit memproduksi minyak lebih banyak. Pilih gel wash dengan pH sekitar 5.5.

## 2. Toner niacinamide

Satu lapis toner niacinamide membantu mengontrol minyak sepanjang hari dan menyamarkan pori.

## 3. Pelembap gel

Kulit berminyak tetap butuh pelembap. Pilih tekstur gel yang bebas minyak supaya tidak menambah kilap.

## 4. Sunscreen gel SPF 50

Langkah paling penting. Sunscreen gel tanpa whitecast nyaman dipakai di bawah cushion dan tidak menggumpal.`,
  },
  {
    slug: "lip-tint-vs-lip-cream-mana-yang-cocok-untukmu",
    title: "Lip tint vs lip cream: mana yang cocok untukmu?",
    excerpt: "Dua produk bibir paling laris di Rona, dibedah dari tekstur, ketahanan, sampai cara hapusnya.",
    author: "Tim Rona",
    products: ["lumi-water-tint", "lumi-cloud-lip-cream", "lumi-honey-lip-balm"],
    body: `## Lip tint: segar dan tahan lama

Tint meresap ke bibir sehingga warnanya bertahan walau sudah makan. Cocok untuk tampilan natural dan gradasi. Kekurangannya: bisa terasa kering bila bibir sedang pecah-pecah, jadi pakai lip balm dulu.

## Lip cream: pigmen penuh dan matte

Lip cream memberi warna penuh dalam satu lapis dengan hasil matte. Cocok untuk acara atau tampilan bold. Pilih formula yang ringan supaya tidak terasa berat.

## Tips dari kami

Pakai tint sebagai dasar, lalu lip cream tipis di bagian tengah. Kalau lip cream pudar, warna tint masih bertahan di bawahnya.`,
  },
  {
    slug: "kenapa-sunscreen-harus-dipakai-ulang",
    title: "Kenapa sunscreen harus dipakai ulang, dan caranya di atas makeup",
    excerpt: "SPF 50 bukan tameng seharian. Begini cara pakai ulang tanpa merusak cushion.",
    author: "Tim Rona",
    products: ["surya-shield-daily-mist-spf-30", "surya-shield-sun-stick-spf-50", "surya-shield-gel-sunscreen-spf-50-pa"],
    body: `## Perlindungan sunscreen menurun seiring waktu

Keringat, minyak, dan gesekan membuat lapisan sunscreen menipis. Setelah 2 sampai 3 jam di luar ruangan, perlindungannya sudah jauh berkurang.

## Pakai ulang di atas makeup

Ada dua cara yang praktis: sunscreen mist yang disemprot dari jarak 20 cm, atau sun stick yang diusap pelan ke area pipi, hidung, dan dahi. Keduanya tidak menggeser cushion bila dipakai tipis.

## Jumlahnya tetap penting

Untuk aplikasi pertama di pagi hari, pakai dua ruas jari untuk wajah dan leher. Pakai ulang boleh lebih tipis, yang penting rutin.`,
  },
];

export const voucherSeed = [
  {
    code: "RONABARU",
    title: "Potongan Rp 20.000 untuk pembeli baru",
    description: "Minimal belanja Rp 100.000. Berlaku untuk semua produk.",
    type: "nominal" as const,
    value: 20000,
    maxDiscount: null,
    minSpend: 100000,
    quota: 500,
    quotaPerCustomer: 1,
    scope: {},
    stackWithFlash: true,
    isPublic: true,
  },
  {
    code: "HEMAT15",
    title: "Diskon 15% maksimal Rp 30.000",
    description: "Minimal belanja Rp 150.000. Tidak bisa digabung dengan flash sale.",
    type: "persen" as const,
    value: 15,
    maxDiscount: 30000,
    minSpend: 150000,
    quota: 300,
    quotaPerCustomer: 2,
    scope: {},
    stackWithFlash: false,
    isPublic: true,
  },
  {
    code: "ONGKIRRONA",
    title: "Gratis ongkir sampai Rp 20.000",
    description: "Minimal belanja Rp 150.000 untuk pengiriman ke seluruh Indonesia.",
    type: "ongkir" as const,
    value: 20000,
    maxDiscount: 20000,
    minSpend: 150000,
    quota: 1000,
    quotaPerCustomer: 3,
    scope: {},
    stackWithFlash: true,
    isPublic: true,
  },
  {
    code: "LUMI10",
    title: "Diskon 10% semua produk Lumi",
    description: "Maksimal potongan Rp 15.000, hanya untuk produk merek Lumi.",
    type: "persen" as const,
    value: 10,
    maxDiscount: 15000,
    minSpend: 50000,
    quota: 200,
    quotaPerCustomer: 1,
    scope: { brandSlugs: ["lumi"] },
    stackWithFlash: false,
    isPublic: false,
  },
];

// Peran bawaan; izin sebenarnya diambil dari ROLE_TEMPLATES di kode (src/lib/admin/permissions.ts).
export const roleSeed = ROLE_SLUGS.map((slug) => ({
  slug,
  name: ROLE_TEMPLATES[slug].name,
  description: ROLE_TEMPLATES[slug].description,
  defaultPermissions: [...ROLE_TEMPLATES[slug].permissions],
}));

// Akun staf demo. Daftar lokasi kosong berarti mengampu semua lokasi.
export const staffSeed: { name: string; email: string; role: RoleSlug; locations: string[] }[] = [
  { name: "Owner Demo", email: "owner@rona.demo", role: "owner", locations: [] },
  { name: "Admin Online Demo", email: "admin@rona.demo", role: "admin_online", locations: [] },
  { name: "Staf Dinoyo Demo", email: "dinoyo@rona.demo", role: "staf_cabang", locations: ["dinoyo"] },
  { name: "Gudang Demo", email: "gudang@rona.demo", role: "gudang", locations: [] },
];

// Pengaturan awal: sama dengan nilai bawaan di src/lib/settings (aturan BRIEF), ditambah pesan PromoBar.
export const settingsSeed: Record<string, unknown> = {
  ...settingsRows(DEFAULT_SETTINGS),
  "promo.bar": [
    "Gratis ongkir min. Rp 150.000",
    "Pesan sebelum 15.00, dikirim hari ini",
    "Ambil di toko: siap dalam 2 jam",
  ],
  "poin.aturan": { perRupiah: 1000, nilaiPoin: 1, maksPersenSubtotal: 50, bonusUlasanPertama: 50 },
};

// Banner beranda berupa komposisi ProductArt (tanpa foto). Urutan menentukan yang tampil lebih dulu di hero.
export const bannerSeed = [
  {
    title: "Temukan rona terbaikmu.",
    subtitle: "Satu produk, banyak shade. Stok terlihat per cabang. Rekomendasi yang hanya datang dari katalog kami sendiri.",
    imageUrl: null,
    art: { items: [{ packaging: "serum_dropper", shade: "#D9EBE7", brandColor: "#2F5D62", brandName: "Kirana Lab" }, { packaging: "cushion", shade: "#DAB085", brandColor: "#B98A6A", brandName: "Pualam" }, { packaging: "lipstick", shade: "#B8475D", brandColor: "#C2416B", brandName: "Lumi" }], background: "#F4DCDF" },
    ctaLabel: "Cari shade-mu",
    href: "/c/makeup-wajah",
    sortOrder: 0,
  },
  {
    title: "Kulit tenang, hari lebih ringan",
    subtitle: "Rutinitas sederhana untuk kulit sensitif dan berminyak, dari pembersih sampai tabir surya.",
    imageUrl: null,
    art: { items: [{ packaging: "toner_bottle", shade: "#E8F0DE", brandColor: "#4F6A4E", brandName: "Teduh" }, { packaging: "serum_dropper", shade: "#F3E1C7", brandColor: "#2F5D62", brandName: "Kirana Lab" }, { packaging: "sunscreen_tube", shade: "#FBE7B8", brandColor: "#E0A227", brandName: "Surya Shield" }], background: "#E8EFE7" },
    ctaLabel: "Lihat skincare",
    href: "/c/skincare",
    sortOrder: 1,
  },
  {
    title: "Ambil hari ini di toko terdekat",
    subtitle: "Tiga cabang di Malang, stok terlihat sebelum kamu datang.",
    imageUrl: null,
    art: { items: [{ packaging: "lip_tint", shade: "#D9506A", brandColor: "#C2416B", brandName: "Lumi" }, { packaging: "eyeshadow_palette", shade: "#C5714F", brandColor: "#3B3A4A", brandName: "Dayu Cosmetics" }, { packaging: "perfume_bottle", shade: "#E8F0DE", brandColor: "#7A4E8C", brandName: "Arunika" }], background: "#FBF4E6" },
    ctaLabel: "Lihat cabang",
    href: "/toko",
    sortOrder: 2,
  },
];
