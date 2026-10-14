import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, parseKatalog } from "./katalog";

const HEAD = "merek,kategori,produk,kemasan,shade,hex,sku,harga_normal,harga_jual,berat_gram,stok_gudang-online,stok_dinoyo";

describe("impor katalog CSV", () => {
  it("parser CSV menangani kutip, koma di dalam kutip, kutip ganda, dan baris Windows", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hai"""\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hai"'],
    ]);
  });

  it("templat di docs lolos: dua produk, varian digabung per slug, stok per lokasi", () => {
    const r = parseKatalog(readFileSync("docs/templat-katalog.csv", "utf8"));
    expect(r.gagal).toEqual([]);
    expect(r.produk.map((p) => [p.slug, p.input.variants.length])).toEqual([
      ["lumi-juicy-lip-tint", 2],
      ["teduh-calming-serum", 1],
    ]);
    const tint = r.produk[0];
    expect(tint.input.variants[0]).toMatchObject({ shadeName: "01 Semangka", hex: "#E2475E", sku: "LUMI-JLT-01", normalPrice: 79000, salePrice: 69000, weightGram: 40 });
    expect(tint.input.skinTypes).toEqual(["normal", "kering"]);
    expect(tint.input.status).toBe("draf");
    // Stok 0 tidak dicatat sebagai gerakan.
    expect(tint.stok).toContainEqual({ sku: "LUMI-JLT-02", lokasi: "sawojajar", jumlah: 3 });
    expect(tint.stok.some((s) => s.sku === "LUMI-JLT-02" && s.lokasi === "dinoyo")).toBe(false);
    expect(r.lokasiDipakai.sort()).toEqual(["dinoyo", "gudang-online", "sawojajar", "soekarno-hatta"]);
  });

  it("baris salah dilaporkan dengan nomor baris dan alasannya, baris lain tetap lolos", () => {
    const csv = [
      HEAD,
      "Lumi,lipstick,Lumi Uji Matte,lipstick,01 Merah,#B8475D,LUMI-UM-01,99000,89000,30,10,2",
      "Lumi,lipstick,Lumi Uji Matte,lipstick,02 Nude,ZZZ,LUMI-UM-02,99000,89000,30,1,0", // hex salah
      "Lumi,lipstick,Lumi Uji Matte,lipstick,03 Rose,#C06070,LUMI-UM-01,99000,89000,30,1,0", // SKU kembar
      "Lumi,lipstick,Produk Lain,botol,Standar,#FFFFFF,LAIN-01,abc,89000,30,,", // kemasan dan harga salah
      "Lumi,lipstick,Murah,lipstick,Standar,#FFFFFF,MURAH-01,50000,60000,30,-1,", // jual > normal, stok negatif
    ].join("\n");
    const r = parseKatalog(csv);
    expect(r.gagal.map((g) => g.baris)).toEqual([3, 4, 5, 6]);
    expect(r.gagal[1].pesan).toContain("sudah dipakai di baris 2");
    expect(r.gagal[2].pesan).toMatch(/kemasan "botol" tidak dikenal/);
    expect(r.gagal[3].pesan).toMatch(/stok gudang-online/);
    expect(r.gagal[0].pesan).toMatch(/hex "ZZZ"/);
    // Baris yang valid tetap membentuk produk.
    expect(r.produk.map((p) => [p.slug, p.input.variants.length])).toEqual([["lumi-uji-matte", 1]]);
  });

  it("kolom wajib yang hilang menolak seluruh berkas", () => {
    const r = parseKatalog("merek,produk\nLumi,Lip");
    expect(r.produk).toEqual([]);
    expect(r.gagal[0].pesan).toMatch(/Kolom wajib belum ada: kategori/);
  });
});
