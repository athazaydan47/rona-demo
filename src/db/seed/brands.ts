export const brandSeed = [
  {
    slug: "kirana-lab",
    name: "Kirana Lab",
    color: "#2F5D62",
    tagline: "Serum dan essence berbasis riset untuk kulit tropis",
    description:
      "Kirana Lab adalah merek fiktif yang fokus pada serum, toner, dan essence dengan formula ringan untuk iklim lembap. Semua produk di sini hanya untuk demo.",
    priceMin: 59000,
    priceMax: 189000,
  },
  {
    slug: "embun",
    name: "Embun",
    color: "#5B8DB8",
    tagline: "Hidrasi lembut sepanjang hari",
    description:
      "Embun (fiktif) membuat pelembap, face mist, dan produk hidrasi yang terasa seperti embun pagi di kulit.",
    priceMin: 39000,
    priceMax: 129000,
  },
  {
    slug: "teduh",
    name: "Teduh",
    color: "#8FA58E",
    tagline: "Tenang untuk kulit sensitif",
    description:
      "Teduh (fiktif) dirancang untuk kulit yang mudah merah dan perih: cleanser lembut dan barrier cream tanpa pewangi.",
    priceMin: 35000,
    priceMax: 99000,
  },
  {
    slug: "surya-shield",
    name: "Surya Shield",
    color: "#E0A227",
    tagline: "Perlindungan matahari yang nyaman dipakai",
    description:
      "Surya Shield (fiktif) membuat sunscreen gel, stick, dan spray yang tidak lengket dan tidak whitecast.",
    priceMin: 39000,
    priceMax: 119000,
  },
  {
    slug: "pualam",
    name: "Pualam",
    color: "#B98A6A",
    tagline: "Complexion yang menyatu dengan kulit Indonesia",
    description:
      "Pualam (fiktif) membuat cushion, foundation, dan bedak dengan rentang shade yang luas untuk undertone warm, neutral, dan cool.",
    priceMin: 79000,
    priceMax: 219000,
  },
  {
    slug: "lumi",
    name: "Lumi",
    color: "#C2416B",
    tagline: "Warna bibir yang hidup, tahan lama",
    description:
      "Lumi (fiktif) hadir dengan lipstick, lip tint, dan lip cream dengan pigmentasi tinggi dan rasa nyaman di bibir.",
    priceMin: 29000,
    priceMax: 99000,
  },
  {
    slug: "dayu-cosmetics",
    name: "Dayu Cosmetics",
    color: "#3B3A4A",
    tagline: "Mata yang bicara",
    description:
      "Dayu Cosmetics (fiktif) berfokus pada mascara, eyeliner, dan palet eyeshadow dengan tekstur yang mudah dibaurkan.",
    priceMin: 39000,
    priceMax: 149000,
  },
  {
    slug: "mekar",
    name: "Mekar",
    color: "#D98E8E",
    tagline: "Tubuh wangi, kulit lembut",
    description:
      "Mekar (fiktif) membuat body lotion, scrub, dan body serum dengan aroma bunga tropis yang lembut.",
    priceMin: 29000,
    priceMax: 89000,
  },
  {
    slug: "arunika",
    name: "Arunika",
    color: "#7A4E8C",
    tagline: "Parfum untuk momen yang ingin diingat",
    description:
      "Arunika (fiktif) merancang eau de parfum dengan karakter floral, woody, dan gourmand yang tahan di cuaca panas.",
    priceMin: 89000,
    priceMax: 299000,
  },
  {
    slug: "senja",
    name: "Senja",
    color: "#E07A5F",
    tagline: "Body mist ringan untuk sehari-hari",
    description:
      "Senja (fiktif) membuat body mist dengan aroma yang segar dan tidak menusuk, cocok disemprot ulang sepanjang hari.",
    priceMin: 39000,
    priceMax: 99000,
  },
  {
    slug: "kalis",
    name: "Kalis",
    color: "#4F6D4A",
    tagline: "Rambut sehat dari akar",
    description:
      "Kalis (fiktif) menghadirkan shampoo dan hair treatment untuk rambut rontok, berketombe, dan kering.",
    priceMin: 35000,
    priceMax: 129000,
  },
  {
    slug: "nara-men",
    name: "Nara Men",
    color: "#2E4057",
    tagline: "Perawatan pria tanpa ribet",
    description:
      "Nara Men (fiktif) membuat facial wash, pomade, dan parfum pria dengan langkah sederhana.",
    priceMin: 35000,
    priceMax: 119000,
  },
] as const;

export type BrandSlug = (typeof brandSeed)[number]["slug"];
