import { describe, expect, it } from "vitest";
import { absoluteLinks } from "./links";

describe("tautan notifikasi", () => {
  const site = "https://rona-demo.vercel.app";
  it("menambahkan alamat situs ke path relatif", () => {
    expect(absoluteLinks("Cek detailnya di /pesanan/RONA-2610-000001?t=abc", site)).toBe("Cek detailnya di https://rona-demo.vercel.app/pesanan/RONA-2610-000001?t=abc");
    expect(absoluteLinks("Detail: /pesanan/X\n\nSalam", site)).toBe("Detail: https://rona-demo.vercel.app/pesanan/X\n\nSalam");
    expect(absoluteLinks("/p/lumi-water-tint", `${site}/`)).toBe("https://rona-demo.vercel.app/p/lumi-water-tint");
  });
  it("membetulkan data lama yang berisi localhost dan tidak menyentuh teks lain", () => {
    expect(absoluteLinks("Lacak di http://localhost:3000/pesanan/X?t=1", site)).toBe("Lacak di https://rona-demo.vercel.app/pesanan/X?t=1");
    expect(absoluteLinks("Diskon 20/30 hari dan/atau ongkir", site)).toBe("Diskon 20/30 hari dan/atau ongkir");
    expect(absoluteLinks("Sudah di https://rona-demo.vercel.app/pesanan/X", site)).toBe("Sudah di https://rona-demo.vercel.app/pesanan/X");
  });
});
