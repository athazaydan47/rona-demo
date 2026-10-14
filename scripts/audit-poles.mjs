// Audit poles (Fase 8A): buka setiap halaman toko dan admin di 375, 390, 768, dan 1440 px sebagai tamu, Pembeli Demo,
// dan empat peran staf, lalu kumpulkan temuan yang bisa diukur: status HTTP, galat konsol, overflow mendatar, teks
// dengan tanda pisah panjang, istilah yang tidak konsisten ("Order", "Anda"), teks mentah (undefined, NaN, [object),
// sasaran sentuh di bawah 32 px di HP (tautan teks di dalam kalimat dikecualikan), pelanggaran axe serius atau kritis (di
// 390 dan 1440 px), dan pelanggaran Content Security Policy (Fase 8B).
//   CUPLIK_URL=http://localhost:3211 node scripts/audit-poles.mjs
// Hasil: _review/audit-poles.json dan ringkasan di terminal. Dipakai untuk menyusun docs/AUDIT-POLES.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = (process.env.CUPLIK_URL ?? "http://localhost:3211").replace(/\/$/, "");
const WIDTHS = [375, 390, 768, 1440];
const STORE = ["/", "/c/bibir", "/c/semua?kulit=berminyak", "/p/pualam-velvet-matte-cushion-spf-50", "/cari?q=cusion", "/flash-sale", "/promo", "/merek", "/jurnal", "/keranjang", "/checkout", "/masuk", "/lacak", "/kuis-kulit", "/rutinitas", "/padanan-shade", "/cari-dari-video", "/advisor", "/tentang-demo", "/faq", "/cara-belanja", "/toko", "/hubungi", "/cek-ongkir", "/kebijakan/retur", "/kebijakan/privasi", "/kebijakan/syarat", "/kebijakan/pengiriman", "/halaman-tidak-ada"];
const ACCOUNT = ["/akun", "/akun/pesanan", "/akun/alamat", "/akun/poin", "/akun/wishlist", "/akun/notifikasi", "/akun/profil", "/akun/profil-kulit", "/akun/kabari-aku", "/keranjang", "/checkout"];
const ADMIN = ["/admin", "/admin/pesanan", "/admin/pesanan?tampilan=tabel", "/admin/stok", "/admin/produk", "/admin/kategori", "/admin/promo", "/admin/laporan", "/admin/pelanggan", "/admin/ulasan", "/admin/notifikasi", "/admin/staf", "/admin/log", "/admin/pengaturan", "/admin/kabar"];
const ROLES = [
  { name: "tamu", pages: STORE },
  { name: "pembeli-demo", pages: ACCOUNT, login: async (page) => {
    await page.goto(`${base}/masuk?kembali=%2Fakun`);
    await page.getByRole("button", { name: "Masuk sebagai Pembeli Demo" }).click();
    await page.waitForURL(/\/akun/);
  } },
  ...["Owner", "Admin Online", "Staf Cabang Dinoyo", "Gudang"].map((label) => ({ name: label.toLowerCase().replace(/ /g, "-"), pages: ADMIN, login: async (page) => {
    await page.goto(`${base}/admin/masuk?kembali=%2Fadmin`);
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForURL(/\/admin$/);
  } })),
];

// Penyaring untuk menjalankan sebagian saja: AUDIT_PERAN=tamu AUDIT_HALAMAN=/,/c/bibir AUDIT_LEBAR=390
const onlyRole = process.env.AUDIT_PERAN?.split(",");
const onlyPage = process.env.AUDIT_HALAMAN?.split(",");
const onlyWidth = process.env.AUDIT_LEBAR?.split(",").map(Number);
const findings = [];
const browser = await chromium.launch();
// Setiap peran berjalan di konteks sendiri secara paralel (maksimal 3 sekaligus) supaya audit selesai dalam belasan menit.
async function auditRole(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  // Fase 8B: catat pelanggaran CSP (mode enforce maupun report-only) di setiap halaman.
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI || "inline"} (${e.disposition})`));
  });
  const page = await context.newPage();
  if (role.login) await role.login(page);
  for (const path of role.pages) {
    if (onlyPage && !onlyPage.includes(path)) continue;
    for (const width of WIDTHS) {
      if (onlyWidth && !onlyWidth.includes(width)) continue;
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      const consoleErrors = [];
      const onConsole = (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); };
      page.on("console", onConsole);
      const f = { peran: role.name, halaman: path, lebar: width, masalah: [] };
      try {
        const res = await page.goto(base + path, { waitUntil: "load", timeout: 45_000 });
        const status = res?.status() ?? 0;
        const expect404 = path.includes("tidak-ada");
        if (expect404 ? status !== 404 : status !== 200) f.masalah.push(`status ${status}`);
        await page.waitForTimeout(700);
        const dom = await page.evaluate(() => {
          const out = {};
          const w = document.documentElement.clientWidth;
          out.overflow = document.documentElement.scrollWidth - w;
          out.pelakuOverflow = [];
          if (out.overflow > 1) {
            for (const el of document.querySelectorAll("body *")) {
              const r = el.getBoundingClientRect();
              if (r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
                const id = el.id ? `#${el.id}` : "";
                const cls = typeof el.className === "string" ? "." + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
                out.pelakuOverflow.push(`${el.tagName.toLowerCase()}${id}${cls} (${Math.round(r.right - w)}px)`);
                if (out.pelakuOverflow.length >= 3) break;
              }
            }
          }
          const text = document.body.innerText;
          out.emDash = (text.match(/\u2014/g) ?? []).length;
          out.order = (text.match(/\bOrder\b/g) ?? []).length;
          out.anda = (text.match(/\bAnda\b/g) ?? []).length;
          out.mentah = (text.match(/\bundefined\b|\bNaN\b|\[object |\bnull\b/g) ?? []).length;
          out.utama = (document.querySelector("main")?.innerText ?? "").trim().length;
          out.kecil = [];
          if (w < 500) {
            for (const el of document.querySelectorAll("main a, main button, main [role=button], header a, header button, nav a, nav button")) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight * 3) continue;
              if ((r.height < 32 || r.width < 32) && !el.closest("[aria-hidden=true]") && !el.querySelector("img, svg") && !(el.tagName === "A" && getComputedStyle(el).display === "inline")) {
                out.kecil.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
                if (out.kecil.length >= 4) break;
              }
            }
          }
          out.imgTanpaAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
          return out;
        });
        if (dom.overflow > 1) f.masalah.push(`overflow mendatar ${dom.overflow}px: ${dom.pelakuOverflow.join("; ")}`);
        if (dom.emDash) f.masalah.push(`${dom.emDash} tanda pisah panjang`);
        if (dom.order) f.masalah.push(`kata "Order" ${dom.order} kali`);
        if (dom.anda) f.masalah.push(`kata "Anda" ${dom.anda} kali`);
        if (dom.mentah) f.masalah.push(`teks mentah (undefined/NaN/null/object) ${dom.mentah} kali`);
        if (dom.utama < 40 && !expect404) f.masalah.push(`isi utama kosong (${dom.utama} karakter)`);
        if (dom.kecil.length) f.masalah.push(`sasaran sentuh kecil: ${dom.kecil.join("; ")}`);
        if (dom.imgTanpaAlt) f.masalah.push(`${dom.imgTanpaAlt} gambar tanpa alt`);
        if (consoleErrors.length) f.masalah.push(`galat konsol: ${[...new Set(consoleErrors)].slice(0, 2).join(" | ")}`);
        const csp = await page.evaluate(() => window.__csp ?? []);
        if (csp.length) f.masalah.push(`pelanggaran CSP: ${[...new Set(csp)].slice(0, 3).join(" | ")}`);
        if (width === 390 || width === 1440) {
          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).exclude("[data-activity-hidden]").analyze();
          const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          for (const v of bad) f.masalah.push(`axe ${v.impact} ${v.id}: ${v.nodes.length} elemen, misal ${v.nodes[0]?.target?.join(" ").slice(0, 90)}`);
          const moderate = axe.violations.filter((v) => v.impact === "moderate" || v.impact === "minor");
          if (moderate.length) f.catatanAxe = moderate.map((v) => `${v.impact} ${v.id} (${v.nodes.length})`);
        }
      } catch (e) {
        f.masalah.push(`gagal dibuka: ${String(e?.message ?? e).slice(0, 120)}`);
      }
      page.off("console", onConsole);
      findings.push(f);
      process.stdout.write(f.masalah.length ? "x" : ".");
    }
  }
  await context.close();
}
const queue = ROLES.filter((r) => !onlyRole || onlyRole.includes(r.name));
await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
  while (queue.length) await auditRole(queue.shift());
}));
findings.sort((a, b) => a.peran.localeCompare(b.peran) || a.halaman.localeCompare(b.halaman) || a.lebar - b.lebar);
await browser.close();
mkdirSync("_review", { recursive: true });
writeFileSync(onlyRole || onlyPage || onlyWidth ? "_review/audit-poles-sebagian.json" : "_review/audit-poles.json", JSON.stringify(findings, null, 2));
if (onlyRole || onlyPage || onlyWidth) for (const f of findings) console.log(`\n${f.peran} ${f.halaman}@${f.lebar}\n  ${f.masalah.join("\n  ") || "bersih"}${f.catatanAxe ? `\n  axe lain: ${f.catatanAxe.join(", ")}` : ""}`);
const bad = findings.filter((f) => f.masalah.length);
console.log(`\n\n${findings.length} pemeriksaan, ${bad.length} dengan temuan.`);
const byIssue = new Map();
for (const f of bad) for (const m of f.masalah) {
  const key = m.replace(/\d+px|\d+ kali|\d+ elemen|\(\d+ karakter\)/g, "n").slice(0, 70);
  const list = byIssue.get(key) ?? [];
  list.push(`${f.peran} ${f.halaman}@${f.lebar}`);
  byIssue.set(key, list);
}
for (const [k, v] of [...byIssue.entries()].sort((a, b) => b[1].length - a[1].length)) console.log(`${String(v.length).padStart(3)}  ${k}  misal ${v.slice(0, 3).join(", ")}`);
