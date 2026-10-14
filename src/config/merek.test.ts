import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FITUR, fiturAktif, parseNonaktif, semuaFitur } from "./fitur";
import { MEREK, POLA_NOMOR_PESANAN, TOKEN_WARNA, contohNomorPesanan, temaCss, type Palet } from "./merek";

// Berkas yang boleh menyebut nama merek: konfigurasi, konten (teks yang diganti per klien), dan lapisan database
// (seed, serta skema yang menyimpan nilai bawaan kolom lama). Uji dan dokumen ada di luar src atau berakhiran .test.ts.
const BOLEH = [/^src\/config\//, /^src\/lib\/content\//, /^src\/db\/seed\//, /^src\/db\/schema\//, /^src\/test\//, /\.test\.ts$/];

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|mjs)$/.test(name)) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

describe("konfigurasi merek", () => {
  it("nama merek tidak tertanam di kode di luar konfigurasi, konten, dan seed", () => {
    const nama = [MEREK.kunci, MEREK.nama, MEREK.nama.toUpperCase()].filter((x, i, a) => a.indexOf(x) === i);
    // Kata utuh: "hialuronat" atau "perona" tidak cocok, tetapi "ronaClock" atau "RONA-" cocok.
    const pola = new RegExp(`(?<![\\p{L}])(${nama.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{Ll}])`, "u");
    const temuan: string[] = [];
    for (const f of walk("src")) {
      if (BOLEH.some((re) => re.test(f))) continue;
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (pola.test(line)) temuan.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(temuan).toEqual([]);
  });

  it("token warna di globals.css sama dengan palet konfigurasi", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const [k, token] of Object.entries(TOKEN_WARNA) as [keyof Palet, string][]) {
      const m = new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6});`).exec(css);
      expect(m?.[1]?.toLowerCase(), token).toBe(MEREK.palet[k].toLowerCase());
    }
    expect(temaCss()).toContain(`--color-aksen:${MEREK.palet.aksen}`);
  });

  it("nomor pesanan memakai prefiks konfigurasi", () => {
    expect(contohNomorPesanan()).toBe(`${MEREK.prefiksPesanan}-2610-000123`);
    expect(POLA_NOMOR_PESANAN.test(contohNomorPesanan(7))).toBe(true);
    expect(POLA_NOMOR_PESANAN.test("XYZ-2610-000123")).toBe(false);
    expect(MEREK.kunci).toMatch(/^[a-z][a-z0-9]*$/);
  });
});

describe("sakelar fitur", () => {
  it("semua fitur aktif secara bawaan dan env mematikan per nama", () => {
    expect(Object.values(semuaFitur(FITUR, new Set())).every(Boolean)).toBe(true);
    const off = parseNonaktif("flashSale, poin,tidakAda");
    expect([...off]).toEqual(["flashSale", "poin"]);
    expect(fiturAktif("flashSale", FITUR, off)).toBe(false);
    expect(fiturAktif("aiPembeli", FITUR, off)).toBe(true);
  });
  it("ketergantungan: AI foto butuh AI pembeli, Ambil di Toko butuh multi cabang", () => {
    expect(fiturAktif("aiFotoLink", FITUR, parseNonaktif("aiPembeli"))).toBe(false);
    expect(fiturAktif("ambilDiToko", FITUR, parseNonaktif("multiCabang"))).toBe(false);
    expect(fiturAktif("ambilDiToko", { ...FITUR, multiCabang: false }, new Set())).toBe(false);
  });
});
