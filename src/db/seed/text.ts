import type { ProductKind } from "./types";

// Templat teks per jenis produk. Semua fiktif, ditulis untuk demo.
type KindText = {
  ingredients: (active: string[]) => string;
  howToUse: string;
};

const joinActive = (active: string[]) =>
  active.length ? `Bahan aktif utama: ${active.join(", ")}.` : "";

const base = (
  list: string,
) =>
  `${list} Tanpa paraben, tanpa alkohol denat, dan tidak diuji pada hewan. Daftar lengkap ada di kemasan. (Produk demo, formula fiktif.)`;

export const kindText: Record<ProductKind, KindText> = {
  cleanser: {
    ingredients: (a) =>
      base(`Aqua, Cocamidopropyl Betaine, Glycerin, Sodium Cocoyl Isethionate, Panthenol, Allantoin. ${joinActive(a)}`),
    howToUse:
      "Basahi wajah, tuang secukupnya ke telapak tangan, busakan lalu pijat lembut 30 sampai 60 detik. Bilas dengan air. Pakai pagi dan malam.",
  },
  toner: {
    ingredients: (a) =>
      base(`Aqua, Butylene Glycol, Glycerin, Betaine, Sodium Hyaluronate, Panthenol. ${joinActive(a)}`),
    howToUse:
      "Setelah membersihkan wajah, tuang ke kapas atau telapak tangan lalu tepuk lembut ke seluruh wajah. Lanjutkan dengan serum dan pelembap.",
  },
  serum: {
    ingredients: (a) =>
      base(`Aqua, Propanediol, Glycerin, Pentylene Glycol, Sodium Hyaluronate, Carbomer, Ethylhexylglycerin. ${joinActive(a)}`),
    howToUse:
      "Teteskan 2 sampai 3 tetes ke telapak tangan, ratakan ke wajah yang sudah dibersihkan dan ditoner. Tunggu meresap sebelum pelembap. Untuk produk malam, cukup 2 sampai 3 kali seminggu di awal pemakaian.",
  },
  moisturizer: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Squalane, Shea Butter, Dimethicone. ${joinActive(a)}`),
    howToUse:
      "Ambil seukuran kacang, titik-titik ke dahi, pipi, hidung, dan dagu, lalu ratakan sambil ditepuk. Pakai sebagai langkah terakhir skincare sebelum sunscreen di pagi hari.",
  },
  sheetmask: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Butylene Glycol, Sodium Hyaluronate, Trehalose, Allantoin. ${joinActive(a)}`),
    howToUse:
      "Buka sachet, bentangkan lembaran ke wajah bersih, rapikan ke lekuk wajah. Diamkan 15 sampai 20 menit, lepas, lalu tepuk sisa essence sampai meresap. Tidak perlu dibilas.",
  },
  eyecream: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Caffeine, Niacinamide, Sodium Hyaluronate, Peptide Complex. ${joinActive(a)}`),
    howToUse:
      "Ambil sebesar biji beras, tepuk lembut dengan jari manis di sekitar tulang mata. Hindari menggosok. Pakai pagi dan malam.",
  },
  spot: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Salicylic Acid, Centella Asiatica Extract, Zinc PCA, Allantoin. ${joinActive(a)}`),
    howToUse:
      "Oleskan tipis hanya pada jerawat yang sedang meradang setelah pelembap. Pakai malam hari. Bila terasa perih berlebihan, hentikan pemakaian.",
  },
  exfoliant: {
    ingredients: (a) =>
      base(`Aqua, Butylene Glycol, Salicylic Acid, Betaine, Sodium Hyaluronate, Panthenol. ${joinActive(a)}`),
    howToUse:
      "Tuang ke kapas, usap lembut ke area berminyak dan berpori, hindari area mata. Mulai 2 kali seminggu di malam hari, naikkan perlahan. Wajib sunscreen di pagi hari.",
  },
  bundle: {
    ingredients: (a) => base(`Isi paket mengikuti kandungan masing-masing produk. ${joinActive(a)}`),
    howToUse:
      "Pakai berurutan: pembersih, toner, lalu pelembap. Pagi ditutup dengan sunscreen. Kartu rutinitas ada di dalam kotak.",
  },
  cushion: {
    ingredients: (a) =>
      base(`Aqua, Cyclopentasiloxane, Titanium Dioxide, Ethylhexyl Methoxycinnamate, Niacinamide, Glycerin, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Tekan puff ke cushion sekali, tepuk ke tengah wajah lalu ke tepi. Tambahkan lapisan tipis di area yang perlu lebih tertutup. Isi ulang tersedia terpisah.",
  },
  foundation: {
    ingredients: (a) =>
      base(`Aqua, Cyclopentasiloxane, Isododecane, Titanium Dioxide, Glycerin, Silica, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Kocok botol, pompa 1 sampai 2 kali, ratakan dengan spons lembap atau kuas dari tengah wajah ke luar. Set dengan bedak bila kulit berminyak.",
  },
  powder: {
    ingredients: (a) =>
      base(`Talc, Mica, Silica, Zinc Stearate, Boron Nitride, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Ambil secukupnya dengan puff atau kuas, tepuk tipis ke area T dan bawah mata. Bisa dipakai sendiri untuk hasil natural atau untuk mengunci foundation.",
  },
  concealer: {
    ingredients: (a) =>
      base(`Aqua, Cyclopentasiloxane, Glycerin, Titanium Dioxide, Caffeine, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Oleskan tipis berbentuk segitiga terbalik di bawah mata, titik-titik di noda, lalu baurkan dengan jari atau spons. Set dengan bedak tipis.",
  },
  blush: {
    ingredients: (a) =>
      base(`Mica, Caprylic/Capric Triglyceride, Dimethicone, Silica, Iron Oxides, Tocopherol. ${joinActive(a)}`),
    howToUse:
      "Ambil sedikit dengan jari atau kuas, tepuk ke bagian tertinggi pipi lalu baurkan ke arah pelipis. Lapisi tipis supaya mudah dikontrol.",
  },
  highlighter: {
    ingredients: (a) => base(`Mica, Synthetic Fluorphlogopite, Dimethicone, Silica, Tin Oxide. ${joinActive(a)}`),
    howToUse:
      "Sapukan dengan kuas kecil ke tulang pipi, batang hidung, dan ujung alis. Untuk kilau lebih, tepuk dengan jari.",
  },
  contour: {
    ingredients: (a) =>
      base(`Caprylic/Capric Triglyceride, Ozokerite, Candelilla Wax, Silica, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Goreskan di bawah tulang pipi, garis rahang, dan sisi hidung, lalu baurkan ke atas dengan spons atau kuas. Lebih tipis lebih baik.",
  },
  primer: {
    ingredients: (a) => base(`Dimethicone, Dimethicone Crosspolymer, Silica, Niacinamide, Tocopherol. ${joinActive(a)}`),
    howToUse:
      "Setelah pelembap dan sunscreen, ambil seukuran kacang, tepuk ke area pori dan T zone. Tunggu 30 detik sebelum foundation.",
  },
  settingspray: {
    ingredients: (a) => base(`Aqua, Alcohol, PVP, Glycerin, Sodium Hyaluronate, Panthenol. ${joinActive(a)}`),
    howToUse:
      "Pegang 20 cm dari wajah, semprot membentuk huruf X dan T dengan mata tertutup. Biarkan kering sendiri, jangan dikipas.",
  },
  mascara: {
    ingredients: (a) =>
      base(`Aqua, Beeswax, Carnauba Wax, Acrylates Copolymer, Panthenol, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Sapukan dari pangkal ke ujung bulu mata dengan gerakan zig-zag. Tunggu 10 detik sebelum lapisan kedua. Bersihkan dengan pembersih berbasis minyak.",
  },
  liner: {
    ingredients: (a) => base(`Aqua, Acrylates Copolymer, Butylene Glycol, Carbon Black, Panthenol. ${joinActive(a)}`),
    howToUse:
      "Tarik garis tipis dari tengah kelopak ke ujung mata, lalu sambung ke sudut dalam. Untuk wing, tarik dari sudut luar ke arah ujung alis.",
  },
  eyeshadow: {
    ingredients: (a) => base(`Talc, Mica, Dimethicone, Magnesium Stearate, Silica, Iron Oxides, Tin Oxide. ${joinActive(a)}`),
    howToUse:
      "Mulai dari warna paling terang di seluruh kelopak, warna transisi di lipatan, warna gelap di sudut luar. Baurkan dengan kuas bersih. Shimmer ditepuk dengan jari.",
  },
  brow: {
    ingredients: (a) => base(`Hydrogenated Vegetable Oil, Carnauba Wax, Kaolin, Iron Oxides, Tocopherol. ${joinActive(a)}`),
    howToUse:
      "Sikat alis ke atas, isi celah dengan goresan tipis mengikuti arah tumbuh rambut, tegaskan ekor alis, lalu sikat lagi untuk membaurkan.",
  },
  lash: {
    ingredients: (a) => base(`Serat sintetis, pita katun, lem lateks tersedia terpisah. ${joinActive(a)}`),
    howToUse:
      "Ukur dan potong sesuai panjang mata, oleskan lem tipis, tunggu 20 detik sampai lengket, tempel sedekat mungkin ke garis bulu mata. Bisa dipakai ulang sampai 10 kali.",
  },
  lipstick: {
    ingredients: (a) =>
      base(`Caprylic/Capric Triglyceride, Candelilla Wax, Isononyl Isononanoate, Silica, Tocopherol, Iron Oxides, CI 15850. ${joinActive(a)}`),
    howToUse:
      "Bentuk tepi bibir dengan ujung lipstick, lalu isi bagian dalam. Untuk hasil tahan lama, blot dengan tisu dan ulangi satu lapis.",
  },
  tint: {
    ingredients: (a) => base(`Aqua, Glycerin, Butylene Glycol, Propanediol, Sodium Hyaluronate, CI 16035, CI 42090. ${joinActive(a)}`),
    howToUse:
      "Oleskan dari tengah bibir lalu baurkan ke tepi dengan jari untuk efek gradasi. Tunggu 1 menit sebelum makan atau minum.",
  },
  lipcream: {
    ingredients: (a) =>
      base(`Isododecane, Trimethylsiloxysilicate, Dimethicone, Silica, Squalane, Tocopherol, Iron Oxides. ${joinActive(a)}`),
    howToUse:
      "Oleskan satu lapis tipis dengan aplikator, tunggu 30 detik sampai set. Lapisan kedua hanya bila ingin warna lebih pekat.",
  },
  gloss: {
    ingredients: (a) =>
      base(`Polybutene, Hydrogenated Polyisobutene, Octyldodecanol, Tocopherol, Mica. ${joinActive(a)}`),
    howToUse:
      "Pakai sendiri untuk tampilan segar atau di atas lipstick untuk kilau. Tepuk di tengah bibir supaya terlihat lebih penuh.",
  },
  balm: {
    ingredients: (a) => base(`Ricinus Communis Seed Oil, Beeswax, Shea Butter, Mel, Tocopherol. ${joinActive(a)}`),
    howToUse:
      "Oleskan kapan pun bibir terasa kering, terutama sebelum tidur dan sebelum memakai lipstick matte.",
  },
  sunscreen: {
    ingredients: (a) =>
      base(`Aqua, Ethylhexyl Methoxycinnamate, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Niacinamide, Glycerin. ${joinActive(a)}`),
    howToUse:
      "Pakai sebanyak dua ruas jari untuk wajah dan leher sebagai langkah terakhir pagi hari. Ulangi tiap 2 sampai 3 jam bila beraktivitas di luar ruangan.",
  },
  bodylotion: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Cetearyl Alcohol, Shea Butter, Caprylic/Capric Triglyceride, Parfum. ${joinActive(a)}`),
    howToUse:
      "Pijat ke seluruh tubuh setelah mandi saat kulit masih sedikit lembap. Fokus pada siku, lutut, dan tumit.",
  },
  bodywash: {
    ingredients: (a) =>
      base(`Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Parfum, Citric Acid. ${joinActive(a)}`),
    howToUse: "Tuang ke shower puff, busakan, usap ke seluruh tubuh, lalu bilas sampai bersih.",
  },
  scrub: {
    ingredients: (a) =>
      base(`Coffea Arabica Seed Powder, Sucrose, Cocos Nucifera Oil, Glycerin, Parfum. ${joinActive(a)}`),
    howToUse:
      "Pakai 2 kali seminggu pada kulit basah. Pijat melingkar 2 sampai 3 menit, bilas. Lanjutkan dengan body lotion.",
  },
  deo: {
    ingredients: (a) =>
      base(`Aqua, Glycerin, Sodium Bicarbonate, Zinc Ricinoleate, Parfum, Aloe Vera Extract. ${joinActive(a)}`),
    howToUse: "Oleskan pada ketiak yang kering setelah mandi. Tunggu meresap sebelum berpakaian.",
  },
  shampoo: {
    ingredients: (a) =>
      base(`Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Panthenol, Glycerin, Parfum. ${joinActive(a)}`),
    howToUse:
      "Basahi rambut, tuang secukupnya, pijat kulit kepala dengan ujung jari 1 sampai 2 menit, bilas. Ulangi bila perlu.",
  },
  hairmask: {
    ingredients: (a) =>
      base(`Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Argania Spinosa Kernel Oil, Hydrolyzed Keratin. ${joinActive(a)}`),
    howToUse:
      "Setelah keramas, peras rambut, oleskan dari tengah sampai ujung rambut. Diamkan 5 sampai 10 menit, bilas. Pakai 1 sampai 2 kali seminggu.",
  },
  hairserum: {
    ingredients: (a) =>
      base(`Cyclopentasiloxane, Dimethiconol, Argania Spinosa Kernel Oil, Parfum, Tocopherol. ${joinActive(a)}`),
    howToUse:
      "Pompa 1 sampai 2 kali ke telapak tangan, ratakan ke rambut setengah kering dari tengah sampai ujung. Hindari kulit kepala.",
  },
  perfume: {
    ingredients: (a) => base(`Alcohol Denat., Parfum, Aqua, Linalool, Limonene, Citronellol. ${joinActive(a)}`),
    howToUse:
      "Semprot ke titik nadi: pergelangan tangan, leher, dan belakang telinga. Jangan digosok supaya aroma berkembang alami. Simpan jauh dari sinar matahari.",
  },
  mist: {
    ingredients: (a) => base(`Aqua, Alcohol Denat., Parfum, Glycerin, Limonene, Linalool. ${joinActive(a)}`),
    howToUse:
      "Semprot ke tubuh dan pakaian dari jarak 15 cm. Bisa diulang sepanjang hari karena ringan.",
  },
  pomade: {
    ingredients: (a) => base(`Aqua, PVP, Ceteareth-25, Glycerin, Parfum, Castor Oil. ${joinActive(a)}`),
    howToUse:
      "Ambil seukuran kacang, gosok di telapak tangan sampai rata, aplikasikan ke rambut setengah kering, sisir sesuai gaya. Mudah dibilas dengan air.",
  },
};

export const detailTemplate = (kind: ProductKind) =>
  kind === "perfume" || kind === "mist"
    ? "Simpan di tempat sejuk, jauhkan dari api. Produk demo: nomor BPOM, barcode, dan registrasi di sini fiktif."
    : "Simpan di suhu ruang, jauh dari sinar matahari langsung. Produk demo: nomor BPOM, barcode, dan registrasi di sini fiktif.";
