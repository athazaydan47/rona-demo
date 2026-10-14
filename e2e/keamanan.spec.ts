// Uji keamanan (Fase 8B): header keamanan di toko, admin, dan API; atribut cookie setelah pembeli dan staf masuk;
// security.txt; /api/sehat tanpa data sensitif; dan tidak ada pelanggaran CSP pada alur interaktif yang memuat sumber
// luar atau skrip dinamis (panel Advisor, peta checkout, peta Toko kami, panel Asisten Admin).
import { expect, test, type Page } from "@playwright/test";
import { addToCart, loginAsDemo, loginStaff, pickVariants, sql } from "./helpers";

const RUTE = ["/", "/kategori/lipstik", "/p/pualam-velvet-matte-cushion-spf-50", "/cari?q=cushion", "/masuk", "/admin/masuk", "/api/sehat", "/robots.txt", "/halaman-yang-tidak-ada"];

test("header keamanan terpasang di toko, admin, API, dan 404", async ({ request }) => {
  for (const path of RUTE) {
    const res = await request.get(path, { maxRedirects: 0 });
    const h = res.headers();
    const csp = h["content-security-policy"] ?? "";
    expect(csp, `${path}: CSP harus ditegakkan, bukan hanya dilaporkan`).toContain("default-src 'self'");
    expect(h["content-security-policy-report-only"], path).toBeUndefined();
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'none'"]) expect(csp, `${path}: ${d}`).toContain(d);
    expect(csp, `${path}: tanpa unsafe-eval di produksi`).not.toContain("unsafe-eval");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["cross-origin-opener-policy"], path).toBe("same-origin");
    expect(h["permissions-policy"], path).toMatch(/camera=\(\).*payment=\(\)/);
    expect(h["x-robots-tag"], path).toContain("noindex");
    expect(h["x-powered-by"], `${path}: tidak membocorkan kerangka`).toBeUndefined();
  }
});

test("security.txt dan /api/sehat tanpa data sensitif", async ({ request }) => {
  const sec = await request.get("/.well-known/security.txt");
  expect(sec.status()).toBe(200);
  expect(sec.headers()["content-type"]).toContain("text/plain");
  const text = await sec.text();
  expect(text).toMatch(/^Contact: mailto:\S+@\S+$/m);
  const exp = /^Expires: (\S+)$/m.exec(text)?.[1] ?? "";
  expect(Date.parse(exp)).toBeGreaterThan(Date.now());
  expect(text).toMatch(/^Preferred-Languages: id/m);

  const res = await request.get("/api/sehat");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const d = await res.json();
  expect(d.ok).toBe(true);
  expect(Object.keys(d).sort()).toEqual(["cron", "dataUji", "db", "demo", "ok", "seed", "versi", "waktuServer"]);
  expect(JSON.stringify(d)).not.toMatch(/postgres:|password|DATABASE|GEMINI|token|08\d{8,}/i);
});

test("cookie sesi pembeli dan staf: httpOnly, SameSite=Lax, path /", async ({ page, context }) => {
  await loginAsDemo(page);
  await loginStaff(page, "Owner");
  const cookies = await context.cookies();
  const server = cookies.filter((c) => !c.name.endsWith("_kanban_tab")); // preferensi tab papan pesanan, dibaca browser, tanpa rahasia
  expect(server.map((c) => c.name)).toEqual(expect.arrayContaining([expect.stringMatching(/_sesi$/), expect.stringMatching(/_staf$/)]));
  for (const c of server) {
    expect(c.httpOnly, `${c.name} httpOnly`).toBe(true);
    expect(c.sameSite, `${c.name} SameSite`).toBe("Lax");
    expect(c.path, `${c.name} path`).toBe("/");
    // Build lokal memakai http; di Vercel (https) atribut Secure ikut terpasang lewat cookieSecure().
    expect(c.secure, `${c.name} Secure`).toBe(false);
  }
  // Token sesi tidak pernah muncul di HTML atau payload halaman.
  const sesi = cookies.find((c) => c.name.endsWith("_sesi"))!;
  const html = await (await page.request.get("/akun")).text();
  expect(html).not.toContain(sesi.value);
});

// Kumpulkan pelanggaran CSP dari event browser dan dari pesan konsol.
async function pantauCsp(page: Page) {
  const konsol: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|connect|apply|frame)/i.test(m.text())) konsol.push(m.text());
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return async () => [...konsol, ...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []))];
}

test("panel Advisor dan peta Toko kami tanpa pelanggaran CSP", async ({ page }) => {
  const pelanggaran = await pantauCsp(page);
  await page.goto("/");
  await page.getByTestId("tombol-advisor").click();
  const panel = page.getByTestId("panel-advisor");
  await panel.getByRole("textbox").first().fill("Sunscreen untuk kulit berminyak");
  await panel.getByRole("button", { name: "Kirim" }).click();
  await expect(panel.getByTestId("kartu-advisor").first()).toBeVisible();
  expect(await pelanggaran()).toEqual([]);

  await page.goto("/toko");
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await pelanggaran()).toEqual([]);
});

test("peta checkout tanpa pelanggaran CSP", async ({ page }) => {
  const pelanggaran = await pantauCsp(page);
  const [pick] = await pickVariants("gudang-online", null, 2);
  await addToCart(page, pick);
  await page.goto("/checkout");
  await page.getByRole("button", { name: /Tandai lokasi di peta/ }).click();
  await expect(page.getByRole("application", { name: "Peta untuk menandai lokasi alamat" })).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon").first()).toBeAttached();
  await page.waitForLoadState("networkidle");
  expect(await pelanggaran()).toEqual([]);
});

test("panel Asisten Admin tanpa pelanggaran CSP", async ({ page }) => {
  const pelanggaran = await pantauCsp(page);
  await loginStaff(page, "Owner");
  await page.getByTestId("asisten-sidebar").click();
  const panel = page.getByTestId("panel-asisten");
  await panel.getByLabel("Pertanyaan untuk Asisten Admin").fill("Omzet minggu ini");
  await panel.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect(panel.getByTestId("jawaban-asisten").last()).not.toContainText("Membaca pertanyaanmu", { timeout: 20_000 });
  await page.goto("/admin/laporan");
  await page.waitForLoadState("networkidle");
  expect(await pelanggaran()).toEqual([]);
});

test("kontrol: CSP memblokir sumber luar dan pemantau menangkapnya", async ({ page }) => {
  const pelanggaran = await pantauCsp(page);
  await page.goto("/");
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.src = "https://contoh-penyerang.invalid/x.js";
    document.body.append(s);
  });
  await expect.poll(async () => (await pelanggaran()).join("\n")).toMatch(/script-src/);
});

test("lacak pesanan: cocok membuka pesanan, tebakan nomor WA dibatasi per nomor pesanan", async ({ page }) => {
  const [a, b] = await sql<{ number: string; guest_phone: string }[]>`select number, guest_phone from orders where guest_phone is not null order by id desc limit 2`;
  const lacak = async (nomor: string, wa: string) => {
    await page.goto("/lacak");
    await page.getByLabel("Nomor pesanan").fill(nomor);
    await page.getByLabel("Nomor WhatsApp saat memesan").fill(wa);
    await page.getByRole("button", { name: /Lacak/ }).click();
  };
  await lacak(a.number, a.guest_phone);
  await page.waitForURL((u) => u.pathname === `/pesanan/${a.number}`);

  // Nomor WA salah: pesan sama untuk nomor yang tidak ada dan nomor yang salah (tidak membocorkan keberadaan pesanan).
  for (let i = 0; i < 5; i++) {
    await lacak(b.number, `08129999000${i}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Pesanan tidak ditemukan");
  }
  await lacak(b.number, b.guest_phone);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Terlalu banyak percobaan");
});
