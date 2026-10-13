import type { VariantSpec } from "./types";

// Skala complexion 10 shade untuk kulit Indonesia: dari kuning langsat terang sampai sawo matang gelap.
export const complexion10: VariantSpec[] = [
  { name: "01C Porselen", hex: "#F4DECB", undertone: "cool", depth: 1 },
  { name: "02N Gading", hex: "#F1D6B9", undertone: "neutral", depth: 1 },
  { name: "03W Langsat Terang", hex: "#ECCDA9", undertone: "warm", depth: 2 },
  { name: "04N Langsat", hex: "#E4BF9A", undertone: "neutral", depth: 2 },
  { name: "05W Madu", hex: "#DAB085", undertone: "warm", depth: 3 },
  { name: "06N Pasir", hex: "#D0A47B", undertone: "neutral", depth: 3 },
  { name: "07W Sawo Muda", hex: "#C5956B", undertone: "warm", depth: 4 },
  { name: "08N Karamel", hex: "#B6855D", undertone: "neutral", depth: 4 },
  { name: "09W Sawo Matang", hex: "#A1724E", undertone: "warm", depth: 5 },
  { name: "10N Kayu Manis", hex: "#865A3C", undertone: "neutral", depth: 6 },
];

export const complexion8: VariantSpec[] = [
  { name: "1 Gading", hex: "#F2D8BE", undertone: "cool", depth: 1 },
  { name: "2 Langsat Terang", hex: "#ECCDA9", undertone: "warm", depth: 2 },
  { name: "3 Langsat", hex: "#E3BE98", undertone: "neutral", depth: 2 },
  { name: "4 Madu", hex: "#D9AF86", undertone: "warm", depth: 3 },
  { name: "5 Pasir", hex: "#CFA47C", undertone: "neutral", depth: 3 },
  { name: "6 Sawo Muda", hex: "#C4946A", undertone: "warm", depth: 4 },
  { name: "7 Karamel", hex: "#B2805A", undertone: "neutral", depth: 5 },
  { name: "8 Sawo Matang", hex: "#98693F", undertone: "warm", depth: 6 },
];

export const powder6: VariantSpec[] = [
  { name: "Terang", hex: "#F0D5BB", undertone: "neutral", depth: 1 },
  { name: "Natural", hex: "#E6C4A3", undertone: "warm", depth: 2 },
  { name: "Madu", hex: "#D8B08A", undertone: "warm", depth: 3 },
  { name: "Pasir", hex: "#CDA27A", undertone: "neutral", depth: 4 },
  { name: "Karamel", hex: "#B5855D", undertone: "neutral", depth: 5 },
  { name: "Sawo Matang", hex: "#9A6B45", undertone: "warm", depth: 6 },
];

export const translucent3: VariantSpec[] = [
  { name: "Translucent", hex: "#F3E7DA", undertone: "neutral", depth: 2 },
  { name: "Natural Beige", hex: "#E2C3A3", undertone: "warm", depth: 3 },
  { name: "Deep", hex: "#BD8F67", undertone: "neutral", depth: 5 },
];

export const tinted4: VariantSpec[] = [
  { name: "Light", hex: "#EFD2B5", undertone: "neutral", depth: 1 },
  { name: "Natural", hex: "#E0BA96", undertone: "warm", depth: 2 },
  { name: "Medium", hex: "#CFA27A", undertone: "neutral", depth: 4 },
  { name: "Tan", hex: "#B2835B", undertone: "warm", depth: 5 },
];

export const lipstick10: VariantSpec[] = [
  { name: "01 Nude Kopi Susu", hex: "#B9826A", undertone: "warm", depth: 2 },
  { name: "02 Peach Hangat", hex: "#D98268", undertone: "warm", depth: 2 },
  { name: "03 Mawar Muda", hex: "#C9707E", undertone: "cool", depth: 1 },
  { name: "04 Bata", hex: "#B4533B", undertone: "warm", depth: 4 },
  { name: "05 Mawar Tua", hex: "#B8475D", undertone: "neutral", depth: 3 },
  { name: "06 Merah Ceri", hex: "#A91C32", undertone: "cool", depth: 3 },
  { name: "07 Koral", hex: "#E0634D", undertone: "warm", depth: 3 },
  { name: "08 Magenta", hex: "#A62667", undertone: "cool", depth: 4 },
  { name: "09 Plum", hex: "#6E2B48", undertone: "cool", depth: 5 },
  { name: "10 Cokelat Kayu", hex: "#7E4A3A", undertone: "warm", depth: 6 },
];

export const lipstick8: VariantSpec[] = [
  { name: "Latte", hex: "#C08C72", undertone: "warm", depth: 1 },
  { name: "Mauve Lembut", hex: "#B5788A", undertone: "cool", depth: 2 },
  { name: "Peach Senja", hex: "#D77B63", undertone: "warm", depth: 2 },
  { name: "Mawar", hex: "#C25A6E", undertone: "neutral", depth: 3 },
  { name: "Bata Hangat", hex: "#B05A42", undertone: "warm", depth: 4 },
  { name: "Merah Delima", hex: "#A7232E", undertone: "cool", depth: 4 },
  { name: "Berry", hex: "#8E2F5B", undertone: "cool", depth: 5 },
  { name: "Cokelat Mocha", hex: "#7A4636", undertone: "warm", depth: 6 },
];

export const tint8: VariantSpec[] = [
  { name: "Peach Fizz", hex: "#E58A6E", undertone: "warm", depth: 1 },
  { name: "Pink Lemonade", hex: "#E0718C", undertone: "cool", depth: 1 },
  { name: "Koral Jeruk", hex: "#E2654A", undertone: "warm", depth: 2 },
  { name: "Mawar Segar", hex: "#CF4F68", undertone: "neutral", depth: 3 },
  { name: "Merah Semangka", hex: "#D23A4A", undertone: "neutral", depth: 3 },
  { name: "Ceri Hitam", hex: "#9B1F3D", undertone: "cool", depth: 4 },
  { name: "Bata Manis", hex: "#B9513E", undertone: "warm", depth: 5 },
  { name: "Anggur", hex: "#7D2E57", undertone: "cool", depth: 6 },
];

export const tint6: VariantSpec[] = [
  { name: "Jambu Air", hex: "#E86F82", undertone: "cool", depth: 1 },
  { name: "Mangga Muda", hex: "#E58358", undertone: "warm", depth: 2 },
  { name: "Stroberi", hex: "#D6435A", undertone: "neutral", depth: 3 },
  { name: "Jeruk Bali", hex: "#DD5F4F", undertone: "warm", depth: 3 },
  { name: "Delima", hex: "#B22E45", undertone: "cool", depth: 4 },
  { name: "Manggis", hex: "#7E2C5A", undertone: "cool", depth: 5 },
];

export const lipcream8: VariantSpec[] = [
  { name: "01 Kopi Susu", hex: "#B7826B", undertone: "warm", depth: 2 },
  { name: "02 Gula Aren", hex: "#A66F58", undertone: "warm", depth: 3 },
  { name: "03 Dusty Rose", hex: "#B86B78", undertone: "cool", depth: 2 },
  { name: "04 Terakota", hex: "#B45B44", undertone: "warm", depth: 4 },
  { name: "05 Mawar Tua", hex: "#B1455C", undertone: "neutral", depth: 3 },
  { name: "06 Merah Marun", hex: "#8F2435", undertone: "cool", depth: 4 },
  { name: "07 Anggur Ungu", hex: "#73305B", undertone: "cool", depth: 5 },
  { name: "08 Cokelat Tua", hex: "#6F4034", undertone: "warm", depth: 6 },
];

export const gloss5: VariantSpec[] = [
  { name: "Bening", hex: "#F3D9D4", undertone: "neutral", depth: 1 },
  { name: "Peach Glaze", hex: "#E9A08C", undertone: "warm", depth: 2 },
  { name: "Pink Glaze", hex: "#E58FA5", undertone: "cool", depth: 2 },
  { name: "Mawar Glaze", hex: "#CF6A82", undertone: "neutral", depth: 3 },
  { name: "Bata Glaze", hex: "#C66E5C", undertone: "warm", depth: 4 },
];

export const blush6: VariantSpec[] = [
  { name: "Peach Pagi", hex: "#F0A08A", undertone: "warm", depth: 1 },
  { name: "Pink Jambu", hex: "#EC8FA3", undertone: "cool", depth: 1 },
  { name: "Koral", hex: "#E7806E", undertone: "warm", depth: 3 },
  { name: "Mawar", hex: "#D4687E", undertone: "neutral", depth: 3 },
  { name: "Terakota", hex: "#C9705A", undertone: "warm", depth: 5 },
  { name: "Berry", hex: "#B2516E", undertone: "cool", depth: 5 },
];

export const blush5: VariantSpec[] = [
  { name: "Soft Peach", hex: "#F2AD95", undertone: "warm", depth: 1 },
  { name: "Rosy", hex: "#E7899B", undertone: "cool", depth: 2 },
  { name: "Apricot", hex: "#E89273", undertone: "warm", depth: 3 },
  { name: "Mauve", hex: "#C27A8E", undertone: "cool", depth: 4 },
  { name: "Brick", hex: "#C0624F", undertone: "warm", depth: 5 },
];

export const highlighter3: VariantSpec[] = [
  { name: "Mutiara", hex: "#F6E7D6", undertone: "cool", depth: 1 },
  { name: "Champagne", hex: "#EBCDA2", undertone: "warm", depth: 3 },
  { name: "Emas Tembaga", hex: "#D6A071", undertone: "warm", depth: 5 },
];

export const contour4: VariantSpec[] = [
  { name: "Light", hex: "#C9A082", undertone: "neutral", depth: 1 },
  { name: "Medium", hex: "#AF8260", undertone: "warm", depth: 3 },
  { name: "Tan", hex: "#916649", undertone: "neutral", depth: 5 },
  { name: "Deep", hex: "#6F4A33", undertone: "warm", depth: 6 },
];

export const brow4: VariantSpec[] = [
  { name: "Cokelat Muda", hex: "#8E6B4F", undertone: "warm", depth: 1 },
  { name: "Cokelat", hex: "#6E5039", undertone: "neutral", depth: 3 },
  { name: "Cokelat Tua", hex: "#4F3826", undertone: "neutral", depth: 5 },
  { name: "Abu Hitam", hex: "#3A3633", undertone: "cool", depth: 6 },
];

export const liner3: VariantSpec[] = [
  { name: "Hitam Pekat", hex: "#1C1A1A", undertone: "neutral", depth: 3 },
  { name: "Cokelat", hex: "#5A3E2F", undertone: "warm", depth: 3 },
  { name: "Burgundy", hex: "#6A2A3C", undertone: "cool", depth: 3 },
];

export const liner4: VariantSpec[] = [
  { name: "Hitam", hex: "#1E1C1C", undertone: "neutral", depth: 3 },
  { name: "Cokelat Hangat", hex: "#6B4A36", undertone: "warm", depth: 3 },
  { name: "Hijau Lumut", hex: "#3F5A45", undertone: "cool", depth: 3 },
  { name: "Navy", hex: "#2B3A5C", undertone: "cool", depth: 3 },
];

export const single = (name: string, hex: string): VariantSpec[] => [{ name, hex }];

export const sizes = (hex: string, small: string, large: string, delta: number, smallWeight: number, largeWeight: number): VariantSpec[] => [
  { name: small, hex, weightGram: smallWeight },
  { name: large, hex, weightGram: largeWeight, priceDelta: delta },
];
