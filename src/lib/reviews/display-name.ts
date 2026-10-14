// Nama tampilan ulasan dan sapaan balasan (murni). "Zahra Khairunnisa" tampil sebagai "Zahra K." dan disapa "Kak Zahra".
export function reviewerDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Pembeli Rona";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Sapaan di balasan publik: nama panggilan saja. Nama tampilan "Zahra K." dan nama lengkap sama-sama menjadi "Kak Zahra".
export function greetingName(name: string, sapaan = "Kak") {
  const first = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^(kak|sis|bu|pak|mbak|mas)$/i.test(w))[0];
  if (!first || /^pembeli$/i.test(first)) return sapaan;
  const clean = first.replace(/[^\p{L}\p{N}'-]/gu, "");
  return clean ? `${sapaan} ${clean.charAt(0).toUpperCase()}${clean.slice(1)}` : sapaan;
}
