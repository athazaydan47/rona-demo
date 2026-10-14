// Pilihan jawaban kuis kulit (aman dipakai di browser).
export const SKIN_TYPE_OPTIONS = [
  { value: "normal", label: "Normal", hint: "Jarang berminyak atau kering" },
  { value: "kering", label: "Kering", hint: "Terasa ketarik, kadang mengelupas" },
  { value: "berminyak", label: "Berminyak", hint: "Mengilap di seluruh wajah siang hari" },
  { value: "kombinasi", label: "Kombinasi", hint: "Berminyak di dahi dan hidung saja" },
  { value: "sensitif", label: "Sensitif", hint: "Mudah merah, perih, atau gatal" },
] as const;

export const CONCERN_OPTIONS = [
  { value: "jerawat", label: "Jerawat" },
  { value: "kusam", label: "Kusam" },
  { value: "pori", label: "Pori-pori" },
  { value: "penuaan", label: "Garis halus" },
  { value: "dehidrasi", label: "Dehidrasi" },
] as const;

export const SENSITIVITY_OPTIONS = [
  { value: "rendah", label: "Jarang bereaksi", hint: "Produk baru hampir selalu aman" },
  { value: "sedang", label: "Kadang bereaksi", hint: "Sesekali merah atau perih" },
  { value: "tinggi", label: "Sering bereaksi", hint: "Harus hati-hati memilih produk" },
] as const;

export const BUDGET_OPTIONS = [
  { value: 75_000, label: "Sampai Rp 75 ribu" },
  { value: 150_000, label: "Sampai Rp 150 ribu" },
  { value: 250_000, label: "Sampai Rp 250 ribu" },
  { value: 1_000_000, label: "Bebas" },
] as const;

export const ROUTINE_OPTIONS = [
  { value: "belum", label: "Belum rutin, kadang cuci muka saja" },
  { value: "dasar", label: "Pembersih dan pelembap" },
  { value: "sunscreen", label: "Pembersih, pelembap, dan sunscreen" },
  { value: "lengkap", label: "Lengkap pagi dan malam, termasuk serum" },
] as const;
