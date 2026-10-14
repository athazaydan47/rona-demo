// Diagnosis link video sungguhan (Fase 8C), tanpa AI dan tanpa database:
//   npm run cek:tiktok -- https://vt.tiktok.com/ZSgewBdCV/ https://www.youtube.com/shorts/zuoAuMkPOSY
// Untuk setiap link: klasifikasi, lalu setiap tahap (tautan pendek, oEmbed dengan percobaan ulang, halaman video)
// beserta status HTTP dan lamanya, dan hasil akhirnya (caption, kreator, sumber). Memakai fungsi yang sama dengan
// server (src/lib/ai/oembed.ts), jadi hasilnya mewakili apa yang dialami pembeli dari jaringan ini.
import { ambilInfoVideo, classifyLink, pesanGagalLink } from "../src/lib/ai/oembed";

async function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!urls.length) {
    console.error("Pakai: npm run cek:tiktok -- <url> [url lain ...]");
    process.exit(2);
  }
  let gagal = 0;
  for (const url of urls) {
    console.log(`\n${url}`);
    const link = classifyLink(url);
    console.log(`  klasifikasi: ${link.kind}${"videoId" in link && link.videoId ? `, id ${link.videoId}` : ""}${"short" in link && link.short ? ", tautan pendek" : ""}`);
    if (link.kind !== "tiktok" && link.kind !== "youtube") {
      gagal++;
      console.log("  hasil: bukan link TikTok atau YouTube (pembeli diarahkan ke screenshot)");
      continue;
    }
    const t0 = Date.now();
    const r = await ambilInfoVideo(link);
    for (const j of r.jejak) console.log(`  ${j.tahap.padEnd(14)} ${String(j.status ?? "-").padEnd(4)} ${String(j.ms).padStart(5)} ms  ${j.catatan ?? ""}`);
    if (r.ok) {
      console.log(`  hasil: OK lewat ${r.sumber} dalam ${Date.now() - t0} ms`);
      console.log(`  caption: ${r.info.title.slice(0, 120)}`);
      console.log(`  kreator: ${r.info.author ?? "-"}, sampul: ${r.info.thumbnailUrl ? "ada" : "tidak ada"}`);
    } else {
      gagal++;
      console.log(`  hasil: GAGAL di tahap ${r.gagal.tahap} (status ${r.gagal.status ?? "-"}, ${r.gagal.kode}) dalam ${Date.now() - t0} ms`);
      console.log(`  pesan ke pembeli: ${pesanGagalLink(r.gagal)}`);
    }
  }
  console.log(`\n${urls.length - gagal} dari ${urls.length} link berhasil dibaca.`);
  process.exit(gagal ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
