import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// Perayap tautan internal (scripts/cek-404.mjs) dijalankan terhadap server uji: nol tautan mati.
test("tidak ada tautan mati di situs toko", async ({ baseURL }) => {
  test.setTimeout(300_000);
  let out = "";
  try {
    out = execFileSync("node", ["scripts/cek-404.mjs", "--maks=400"], { env: { ...process.env, CUPLIK_URL: baseURL }, encoding: "utf8", timeout: 280_000 });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    throw new Error(`${err.stdout ?? ""}\n${err.stderr ?? ""}`);
  }
  expect(out).toContain("Tidak ada tautan mati");
});
