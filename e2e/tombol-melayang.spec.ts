import { expect, test, type Page } from "@playwright/test";
import { sql } from "./helpers";

// Aturan global tombol melayang "Tanya Rona": selalu di atas bilah bawah yang menempel dan tidak pernah menutupi tombol
// aksi utama. Diperiksa di 375 dan 1440 px, di atas, tengah, dan bawah halaman.
const profile = Buffer.from(JSON.stringify({ skinType: "berminyak", concerns: ["jerawat"], sensitivity: "rendah", budget: 150000, routine: "dasar", depth: 3, undertone: "warm", source: "kuis", updatedAt: new Date().toISOString() }), "utf8").toString("base64url");

async function overlaps(page: Page) {
  return page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>("[data-testid=tombol-advisor]");
    if (!btn) return { missing: true, hits: [] as string[] };
    const st = getComputedStyle(btn);
    if (st.visibility === "hidden" || Number(st.opacity) === 0) return { missing: false, hits: [] as string[] };
    const b = btn.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-bilah-bawah], [data-aksi-utama]")) {
      if (el.closest("[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!r.width || !r.height || s.visibility === "hidden" || s.display === "none") continue;
      if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
      if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) hits.push(`${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 40)}`);
    }
    return { missing: false, hits };
  });
}

for (const width of [375, 1440]) {
  test(`tombol Tanya Rona tidak menutupi bilah bawah dan tombol utama (${width} px)`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 }, baseURL: "http://localhost:3210" });
    await context.addCookies([{ name: "rona_profil_kulit", value: profile, url: "http://localhost:3210" }]);
    const page = await context.newPage();
    const [p] = await sql<{ slug: string }[]>`select p.slug from products p join variants v on v.product_id = p.id join inventory i on i.variant_id = v.id join locations l on l.id = i.location_id where p.status = 'aktif' and l.type = 'gudang' and i.on_hand - i.reserved > 3 group by p.slug order by p.slug limit 1`;
    // Isi keranjang supaya ringkasan dan tombol checkout tampil.
    await page.goto(`/p/${p.slug}`);
    await page.getByRole("button", { name: "Tambah ke Keranjang" }).first().click();
    await page.keyboard.press("Escape");

    const pages = ["/", "/c/bibir", `/p/${p.slug}`, "/keranjang", "/rutinitas", "/kuis-kulit", "/cari?q=cushion", "/padanan-shade", "/cari-dari-video"];
    const problems: string[] = [];
    for (const url of pages) {
      await page.goto(url, { waitUntil: "load" });
      await expect(page.getByTestId("tombol-advisor")).toBeAttached();
      for (const at of [0, 0.5, 1]) {
        await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f), at);
        await page.waitForTimeout(650);
        const r = await overlaps(page);
        if (r.hits.length) problems.push(`${url} @${at * 100}%: ${r.hits.join(" | ")}`);
      }
    }
    expect(problems).toEqual([]);
    await context.close();
  });
}
