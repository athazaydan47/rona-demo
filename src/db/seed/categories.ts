// Persis seperti tabel Arsitektur informasi di BRIEF.
export const categorySeed = [
  {
    name: "Skincare",
    slug: "skincare",
    description: "Pembersih sampai masker untuk rutinitas harianmu.",
    children: [
      "Pembersih",
      "Toner",
      "Serum dan Essence",
      "Pelembap",
      "Masker",
      "Perawatan Mata",
      "Perawatan Jerawat",
      "Paket Skincare",
    ],
  },
  {
    name: "Makeup Wajah",
    slug: "makeup-wajah",
    description: "Cushion, foundation, dan bedak dengan shade untuk kulit Indonesia.",
    children: [
      "Cushion",
      "Foundation",
      "Bedak",
      "Concealer",
      "Blush",
      "Highlighter dan Contour",
      "Primer dan Setting Spray",
    ],
  },
  {
    name: "Makeup Mata",
    slug: "makeup-mata",
    description: "Mascara, eyeliner, dan eyeshadow untuk tampilan mata yang hidup.",
    children: ["Mascara", "Eyeliner", "Eyeshadow", "Alis", "Bulu Mata"],
  },
  {
    name: "Bibir",
    slug: "bibir",
    description: "Lipstick, lip tint, sampai lip balm.",
    children: ["Lipstick", "Lip Tint", "Lip Cream", "Lip Gloss", "Lip Balm dan Lip Care"],
  },
  {
    name: "Sun Care",
    slug: "sun-care",
    description: "Sunscreen wajah dan tubuh yang nyaman di iklim tropis.",
    children: ["Sunscreen Wajah", "Sunscreen Tubuh", "Tinted Sunscreen"],
  },
  {
    name: "Body dan Hair",
    slug: "body-dan-hair",
    description: "Perawatan tubuh dan rambut dari ujung kepala sampai kaki.",
    children: ["Body Lotion", "Body Wash", "Scrub", "Deodoran", "Shampoo", "Hair Treatment"],
  },
  {
    name: "Fragrance",
    slug: "fragrance",
    description: "Eau de parfum dan body mist.",
    children: ["Eau de Parfum", "Body Mist"],
  },
  {
    name: "Pria",
    slug: "pria",
    description: "Perawatan khusus pria, tanpa ribet.",
    children: ["Skincare Pria", "Rambut Pria", "Parfum Pria"],
  },
] as const;
