import type { ProductKind } from "./types";

export const reviewerNames = [
  "Ayu Lestari", "Dinda Prameswari", "Rizky Maulana", "Nadia Safitri", "Putri Anjani",
  "Salsabila Rahma", "Intan Permata", "Fajar Nugroho", "Citra Dewi", "Laras Ayuningtyas",
  "Maya Kusuma", "Sekar Arum", "Bagas Pratama", "Rina Wulandari", "Dewi Kartika",
  "Anisa Fitriani", "Yoga Saputra", "Tiara Maharani", "Kirana Putri", "Hana Rahmawati",
  "Nabila Zahra", "Galih Prakoso", "Mega Puspita", "Tasya Amelia", "Ratna Sari",
  "Farhan Hidayat", "Vina Oktaviani", "Dita Anggraini", "Siska Nuraini", "Wulan Ramadhani",
  "Zahra Khairunnisa", "Rafi Alfarizi", "Gita Savitri", "Lintang Pertiwi", "Ajeng Pramesti",
  "Nisa Aulia", "Bima Setiawan", "Ratih Kumala", "Dhea Ananda", "Jihan Nabilah",
];

export const skinTypesForReview = ["normal", "kering", "berminyak", "kombinasi", "sensitif"];

type ReviewTemplate = { rating: 5 | 4 | 3; text: string };

const general: ReviewTemplate[] = [
  { rating: 5, text: "Sudah repurchase ketiga kali. Cocok banget di kulitku yang {skin}, nggak ada reaksi aneh." },
  { rating: 5, text: "Pengiriman dari Rona cepat, packing aman. Produknya sesuai deskripsi dan wanginya lembut." },
  { rating: 4, text: "Bagus, cuma kemasannya agak besar buat dibawa bepergian. Hasilnya tetap oke." },
  { rating: 4, text: "Teksturnya enak dan cepat meresap. Harganya pas untuk kualitas segini." },
  { rating: 3, text: "Standar sih menurutku, nggak ada yang istimewa tapi juga nggak mengecewakan." },
  { rating: 5, text: "Ambil di Rona Dinoyo, mbaknya ramah dan bantu pilih. Produknya sesuai ekspektasi." },
  { rating: 4, text: "Dipakai dua minggu, kulit terasa lebih nyaman. Kasih bintang 4 karena masih nunggu hasil jangka panjang." },
];

const byKind: Partial<Record<ProductKind, ReviewTemplate[]>> = {
  cushion: [
    { rating: 5, text: "Shade {shade} pas banget buat kulitku, nggak abu-abu dan nggak kuning. Tahan dari pagi sampai sore di Malang yang panas." },
    { rating: 5, text: "Akhirnya nemu cushion yang shade-nya cocok buat sawo matang. {shade} menyatu banget." },
    { rating: 4, text: "Coverage medium, cukup nutup bekas jerawat tipis. Agak oksidasi sedikit setelah 6 jam tapi masih oke." },
    { rating: 3, text: "Shade {shade} ternyata sedikit terlalu terang di aku, harusnya ambil satu tingkat lebih gelap." },
  ],
  foundation: [
    { rating: 5, text: "Finish-nya kayak kulit sendiri. {shade} cocok untuk undertone warm-ku." },
    { rating: 4, text: "Pump-nya enak, satu pump cukup buat seluruh wajah. Tahan 8 jam di kantor ber-AC." },
    { rating: 4, text: "Nggak oksidasi, cuma butuh bedak buat area T karena kulitku {skin}." },
  ],
  powder: [
    { rating: 5, text: "Halus banget, nggak cakey. Cocok buat touch-up siang." },
    { rating: 4, text: "Bedaknya ringan, cermin di kemasan berguna. Warna {shade} natural." },
  ],
  concealer: [
    { rating: 5, text: "Nutup lingkar mata tanpa creasing. Shade {shade} pas buat under eye." },
    { rating: 4, text: "Coverage tinggi, tapi harus cepat dibaurkan karena cepat set." },
  ],
  blush: [
    { rating: 5, text: "Warna {shade} bikin wajah segar tanpa kelihatan menor. Tahan seharian." },
    { rating: 4, text: "Gampang dibaurkan, pigmen pas. Kemasannya kecil tapi awet." },
  ],
  lipstick: [
    { rating: 5, text: "Shade {shade} cantik banget di bibir, nggak bikin kering walau matte. Sudah 3 shade yang aku punya." },
    { rating: 5, text: "Tahan sampai makan bakso, cuma pudar di bagian dalam bibir. Warna {shade} cocok untuk kulit sawo matang." },
    { rating: 4, text: "Pigmen bagus, tapi aroma sedikit manis. Warna {shade} lebih gelap sedikit dari foto." },
    { rating: 3, text: "Warnanya bagus, cuma agak transfer ke gelas. {shade} tetap favorit sih." },
  ],
  tint: [
    { rating: 5, text: "Tint {shade} warnanya segar, bertahan sampai sore walau sudah makan dan minum." },
    { rating: 5, text: "Favorit untuk harian. Nggak bikin bibir kering, warna {shade} natural." },
    { rating: 4, text: "Nempel lama, tapi harus cepat diratakan supaya nggak patchy." },
  ],
  lipcream: [
    { rating: 5, text: "Cloud banget teksturnya, ringan dan nggak transfer ke masker. {shade} jadi shade andalan." },
    { rating: 4, text: "Matte tapi nyaman, cuma perlu lip balm dulu kalau bibir lagi pecah-pecah." },
  ],
  serum: [
    { rating: 5, text: "Dua minggu pakai, bekas jerawat memudar dan kulit lebih cerah. Teksturnya ringan, cocok buat kulit {skin}." },
    { rating: 4, text: "Nggak lengket dan cepat meresap. Belum terlihat hasil besar tapi kulit terasa lebih halus." },
    { rating: 5, text: "Dikombinasikan dengan sunscreen Surya, kulit jadi lebih rata. Botolnya pipet, gampang diatur." },
  ],
  toner: [
    { rating: 5, text: "Minyak di T zone berkurang, pori terlihat lebih halus. Wajib di rutinitas pagiku." },
    { rating: 4, text: "Segar dan nggak perih di kulit {skin}. Botol 150 ml awet 2 bulan." },
  ],
  cleanser: [
    { rating: 5, text: "Bersih tanpa kesat, cocok untuk kulit {skin}. Busanya lembut dan nggak bikin perih di mata." },
    { rating: 4, text: "Enak dipakai pagi dan malam. Wanginya hampir nggak ada, aku suka." },
  ],
  moisturizer: [
    { rating: 5, text: "Teksturnya ringan dan dingin, nggak bikin wajah berminyak. Pas buat kulit {skin} di cuaca panas." },
    { rating: 4, text: "Melembapkan sampai pagi. Jar-nya 50 g awet, cuma mau ada spatula." },
  ],
  sunscreen: [
    { rating: 5, text: "Nggak ada whitecast di kulit sawo matang! Gel-nya ringan, cocok buat kulit {skin}." },
    { rating: 5, text: "Nyaman dipakai di bawah cushion, nggak menggulung. Sudah repurchase." },
    { rating: 4, text: "Enak banget, cuma agak cepat habis kalau dipakai leher juga." },
  ],
  sheetmask: [
    { rating: 5, text: "Essence-nya banyak, lembaran nempel rapat. Muka terasa kenyal setelah 20 menit." },
    { rating: 4, text: "Varian {shade} menenangkan setelah seharian di luar. Agak basah jadi perlu ditepuk lama." },
  ],
  mascara: [
    { rating: 5, text: "Bulu mata jadi tebal tanpa menggumpal. Tahan seharian dan gampang dibersihkan." },
    { rating: 4, text: "Lentik bertahan sampai sore, sikatnya enak. Warna {shade} natural." },
  ],
  liner: [
    { rating: 5, text: "Ujungnya tajam, bikin wing jadi gampang. Tahan air sungguhan." },
    { rating: 4, text: "Tinta pekat, cuma butuh sekali tarik. Warna {shade} bagus buat harian." },
  ],
  eyeshadow: [
    { rating: 5, text: "Palet {shade} warnanya lengkap buat harian sampai acara. Shimmer-nya halus, nggak fallout." },
    { rating: 4, text: "Pigmen oke, gampang dibaurkan. Kemasannya kokoh." },
  ],
  perfume: [
    { rating: 5, text: "Wanginya elegan dan tahan dari pagi sampai sore. Banyak yang nanya pakai parfum apa." },
    { rating: 4, text: "Enak dan nggak menusuk. Ukuran {shade} pas buat dicoba dulu." },
  ],
  mist: [
    { rating: 5, text: "Wangi {shade} segar dan ringan, enak disemprot ulang. Harganya ramah." },
    { rating: 4, text: "Tahan 3 sampai 4 jam, wajar untuk body mist. Botolnya cantik." },
  ],
  shampoo: [
    { rating: 5, text: "Rontok jauh berkurang setelah sebulan. Wanginya lembut dan rambut nggak kering." },
    { rating: 4, text: "Busanya cukup, rambut terasa ringan. Ukuran {shade} awet." },
  ],
  bodylotion: [
    { rating: 5, text: "Wangi {shade} tahan sampai siang, nggak lengket. Kulit jadi halus." },
    { rating: 4, text: "Meresap cepat, cocok dipakai sebelum berangkat kerja." },
  ],
};

export function reviewTemplatesFor(kind: ProductKind): ReviewTemplate[] {
  return [...(byKind[kind] ?? []), ...general];
}
