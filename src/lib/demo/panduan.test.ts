import { describe, expect, it } from "vitest";
import { LANGKAH, langkahDariUrl } from "./panduan";

describe("panduan demo", () => {
  it("punya 8 sampai 10 langkah mengikuti skenario 5 menit", () => {
    expect(LANGKAH.length).toBeGreaterThanOrEqual(8);
    expect(LANGKAH.length).toBeLessThanOrEqual(10);
    expect(new Set(LANGKAH.map((l) => l.id)).size).toBe(LANGKAH.length);
    for (const l of LANGKAH) expect(`${l.judul} ${l.detail}`).not.toMatch(/\u2014/);
  });
  it("mengenali langkah dari alamat halaman", () => {
    expect(langkahDariUrl("/", "")).toEqual(["flash"]);
    expect(langkahDariUrl("/cari", "?q=cusion&kulit=berminyak")).toEqual(["cari"]);
    expect(langkahDariUrl("/cari", "?q=cusion")).toEqual([]);
    expect(langkahDariUrl("/p/pualam-velvet-matte-cushion-spf-50", "?shade=03n-beige")).toEqual(["shade"]);
    expect(langkahDariUrl("/bayar/RONA-2026-000001", "")).toEqual(["checkout"]);
    expect(langkahDariUrl("/pesanan/RONA-2026-000001/sukses", "")).toEqual(["bayar"]);
    expect(langkahDariUrl("/admin", "")).toEqual(["admin"]);
    expect(langkahDariUrl("/admin/pesanan", "")).toEqual([]);
  });
});
