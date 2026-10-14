// Pengurai kata sehari-hari ke filter berbasis kamus (tanpa AI). Dipakai model mock (uji, cuplik, Playwright)
// supaya jawaban mock tetap melewati fungsi katalog sungguhan. Bukan pengganti AI di produksi.
import type { Interpretation } from "./interpret";

const has = (q: string, re: RegExp) => re.test(q);

const CATEGORY_WORDS: [RegExp, string][] = [
  [/lip ?tint|liptint/, "lip-tint"],
  [/lip ?cream|lipcream|lip matte cair/, "lip-cream"],
  [/lip ?gloss/, "lip-gloss"],
  [/lip ?balm/, "lip-balm-dan-lip-care"],
  [/lipstik|lipstick|gincu/, "lipstick"],
  [/cushion|kusyen/, "cushion"],
  [/foundation|alas bedak/, "foundation"],
  [/concealer/, "concealer"],
  [/bedak|powder/, "bedak"],
  [/blush|perona pipi/, "blush"],
  [/tinted sunscreen|sunscreen berwarna/, "tinted-sunscreen"],
  [/sunscreen badan|sunscreen tubuh|body sunscreen/, "sunscreen-tubuh"],
  [/sunscreen|sunblock|tabir surya|\bspf\b/, "sunscreen-wajah"],
  [/serum|essence/, "serum-dan-essence"],
  [/toner/, "toner"],
  [/pelembap|pelembab|moisturi[sz]er|krim malam|night cream/, "pelembap"],
  [/sabun muka|cuci muka|facial wash|pembersih|cleanser|face wash/, "pembersih"],
  [/masker|sheet mask/, "masker"],
  [/maskara|mascara/, "mascara"],
  [/eyeliner/, "eyeliner"],
  [/eyeshadow|eye shadow/, "eyeshadow"],
  [/body mist/, "body-mist"],
  [/body lotion|lotion badan/, "body-lotion"],
  [/shampo|sampo|shampoo/, "shampoo"],
  [/deodoran|deodorant/, "deodoran"],
  [/eau de parfum|\bedp\b|parfum wanita/, "eau-de-parfum"],
];

const SKIN: [RegExp, string][] = [
  [/berminyak|minyakan|oily|muka minyak|kulit minyak/, "berminyak"],
  [/kulit kering|\bdry\b|kulitku kering/, "kering"],
  [/sensitif|gampang merah|mudah iritasi/, "sensitif"],
  [/kombinasi/, "kombinasi"],
];
const CONCERN: [RegExp, string][] = [
  [/jerawat|acne|beruntusan|bruntusan/, "jerawat"],
  [/kusam|dull/, "kusam"],
  [/pori/, "pori"],
  [/kerutan|keriput|anti ?aging|penuaan|garis halus/, "penuaan"],
  [/dehidrasi|kulit haus/, "dehidrasi"],
];
const FINISH: [RegExp, string][] = [
  [/\bmatte?\b/, "matte"],
  [/\bsatin\b|kondangan|pesta|nikahan/, "satin"],
  [/glowy|\bglow\b|dewy/, "glowy"],
];
const ATTR: [RegExp, string][] = [
  [/(ga|gak|nggak|tidak|enggak) (bikin )?(bibir |kulit )?kering|melembap|lembab|lembap/, "melembapkan"],
  [/tahan lama|awet|seharian/, "tahan_lama"],
  [/(ga|gak|nggak|tidak) lengket|ringan|lightweight/, "ringan"],
  [/tanpa (parfum|pewangi)|(ga|gak|tidak) wangi|fragrance ?free/, "tanpa_parfum"],
  [/waterproof|tahan air|tahan keringat/, "tahan_air"],
  [/mencerahkan|cerah|glowing/, "mencerahkan"],
  [/menenangkan|kemerahan|calming/, "menenangkan"],
];

// "di bawah 100 ribu", "dibawah 150rb", "maks 200k", "budget 100 ribu", "murah"
export function parsePriceMax(q: string): number | null {
  const m = /(?:di ?bawah|maks(?:imal)?|budget|kurang dari|<|under|sampai)\s*(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(ribu|rb|k|jt|juta)?/i.exec(q);
  if (m) {
    const n = Number(m[1].replace(/[.,]/g, ""));
    const unit = (m[2] ?? "").toLowerCase();
    const value = unit === "jt" || unit === "juta" ? n * 1_000_000 : unit ? n * 1000 : n >= 1000 ? n : n * 1000;
    return value >= 10_000 && value <= 5_000_000 ? value : null;
  }
  if (/\bmurah\b|terjangkau|hemat/.test(q)) return 75_000;
  return null;
}

const STOP = new Set(["yang", "buat", "untuk", "utk", "ga", "gak", "nggak", "enggak", "tidak", "bikin", "dong", "ya", "aku", "kamu", "mau", "cari", "ada", "di", "ke", "dan", "atau", "yg", "dengan", "pakai", "pake", "bisa", "rekomendasi", "rekomen", "apa", "kak", "min", "sih", "deh", "nih", "biar", "supaya", "tapi", "juga", "lagi", "kulit", "muka", "wajah", "bibir", "bawah", "ribu", "rb", "harga", "budget", "murah"]);

export function parseQueryRules(raw: string, brands: { slug: string; name: string }[] = []): Interpretation {
  const q = raw.toLowerCase();
  const kategori = CATEGORY_WORDS.find(([re]) => has(q, re))?.[1] ?? null;
  const pick = (list: [RegExp, string][]) => [...new Set(list.filter(([re]) => has(q, re)).map(([, v]) => v))];
  const merek = brands.filter((b) => q.includes(b.name.toLowerCase())).map((b) => b.slug);
  const out: Interpretation = {
    kategori,
    merek,
    jenisKulit: pick(SKIN),
    masalah: pick(CONCERN),
    finish: pick(FINISH).slice(0, 1),
    undertone: /sawo matang|kuning langsat|warm/.test(q) ? ["warm"] : /\bcool\b|kulit putih pink/.test(q) ? ["cool"] : [],
    spf: kategori?.startsWith("sunscreen") || /\bspf\b/.test(q) ? true : false,
    hargaMaks: parsePriceMax(q),
    atribut: pick(ATTR),
    kataKunci: "",
  };
  if (!kategori && !merek.length) {
    out.kataKunci = q
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
      .slice(0, 3)
      .join(" ");
  }
  return out;
}

// Pola untuk keputusan model mock Advisor.
export const MEDICAL_INTENT = /meradang|bernanah|ruam|alergi|gatal|bengkak|luka|infeksi|obat|resep dokter|jerawat parah|jerawat batu|kistik|eksim|psoriasis|flek hitam parah|iritasi berat|perih terus/;
export const OFF_TOPIC = /\b(resep masakan|masak|politik|presiden|pemilu|bola|sepak ?bola|cuaca|coding|program|matematika|saham|kripto|film|lagu|pacar|tugas sekolah|pr sekolah)\b/;
export const INJECTION = /abaikan (semua )?(instruksi|aturan)|ignore (all |previous |the )?(instructions|rules)|lupakan (semua )?(aturan|instruksi)|system prompt|kamu sekarang adalah|jailbreak|developer mode/;
export const REAL_BRANDS = ["Wardah", "Maybelline", "Somethinc", "Emina", "Make Over", "Skintific", "Azarine", "Avoskin", "Garnier", "L'Oreal", "Pixy", "Implora", "Hanasui", "Glad2Glow", "The Ordinary", "Cetaphil", "Biore", "Nivea", "MAC", "Fenty", "Laneige", "Innisfree", "Pond's", "Scarlett", "MS Glow"];
export const realBrandIn = (q: string) => REAL_BRANDS.find((b) => new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")}\\b`, "i").test(q)) ?? null;
