// Penjelasan singkat bahan aktif untuk chip di tab Kandungan. Semua teks demo, bukan klaim medis.
const notes: [RegExp, string][] = [
  [/niacinamide/i, "Membantu mengontrol minyak, menyamarkan pori, dan meratakan warna kulit."],
  [/hyaluron/i, "Mengikat air di kulit supaya terasa kenyal dan lembap lebih lama."],
  [/centella|madecassoside/i, "Menenangkan kulit yang kemerahan dan membantu pemulihan setelah iritasi ringan."],
  [/salicylic|bha|betaine salicylate/i, "Larut minyak, masuk ke pori untuk membersihkan komedo. Mulai bertahap."],
  [/retinal|retinol|bakuchiol/i, "Mendorong pembaruan kulit untuk tekstur lebih halus. Pakai malam dan selalu sunscreen."],
  [/ceramide|cholesterol/i, "Memperkuat lapisan pelindung kulit supaya tidak mudah kering dan perih."],
  [/ascorbic|vitamin c|ferulic/i, "Antioksidan yang membantu kulit tampak lebih cerah dan segar."],
  [/tranexamic|arbutin|licorice/i, "Membantu menyamarkan noda gelap dan bekas jerawat secara bertahap."],
  [/caffeine/i, "Membantu mengurangi tampilan bengkak dan membuat area kulit terasa segar."],
  [/spf/i, "Perlindungan dari sinar UVB dan UVA. Pakai ulang tiap 2 sampai 3 jam di luar ruangan."],
  [/squalane|jojoba|argan|avocado|shea|coconut|castor/i, "Minyak pelembap ringan yang melembutkan tanpa rasa berat."],
  [/aloe|allantoin|panthenol|oat|beta-glucan/i, "Melembapkan dan menenangkan kulit yang sensitif."],
  [/zinc/i, "Membantu mengendalikan minyak berlebih dan menenangkan jerawat."],
  [/tea tree|mint/i, "Memberi sensasi segar dan membantu kulit atau kulit kepala yang gatal."],
  [/kaolin|bentonite|charcoal/i, "Menyerap minyak dan kotoran dari pori."],
  [/papain|rice|enzyme/i, "Eksfoliasi halus tanpa butiran, membantu kulit terasa lebih licin."],
  [/keratin|biotin|ginseng|urang/i, "Membantu memperkuat rambut dan kulit kepala."],
  [/peptide/i, "Rangkaian asam amino yang membantu kulit tampak lebih kencang."],
  [/mica|silica|tin oxide/i, "Mineral untuk tekstur halus dan kilau pada produk makeup."],
  [/wax|candelilla/i, "Memberi bentuk dan tekstur pada produk stik."],
  [/madu|honey/i, "Humektan alami yang menarik kelembapan ke bibir dan kulit."],
  [/vitamin e|tocopherol/i, "Antioksidan yang menjaga formula dan melembapkan."],
  [/glycerin|trehalose/i, "Humektan dasar yang menjaga kelembapan kulit."],
  [/bergamot|melati|jasmine|vanila|vanilla|kayu manis|amber|musk|vetiver|iris|cedar|sandalwood|tuberose|sea|citrus|teh hijau|green tea|fruit extract/i, "Nada aroma dalam komposisi wangi produk ini."],
];

export function ingredientNote(name: string) {
  for (const [re, text] of notes) if (re.test(name)) return text;
  return "Bahan pendukung formula. Rincian lengkap ada di kemasan produk.";
}
