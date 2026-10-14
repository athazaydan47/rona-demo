import { describe, expect, it } from "vitest";
import { auditDiffView, auditKeyLabel, auditObjectLabel, collectAuditRefs, formatAuditValue, variantLabel, type AuditNames } from "./audit-view";

const names: AuditNames = {
  locations: new Map([
    [1, "Gudang Online"],
    [4, "Toko Sawojajar"],
  ]),
  variants: new Map([[208, "Teduh Gentle Milk Cleanser 150 ml"]]),
  staff: new Map([[3, "Gudang Demo"]]),
  customers: new Map([[17, "Zahra Kamila"]]),
  categories: new Map([[5, "Bibir"]]),
};

describe("tampilan log aktivitas", () => {
  it("transfer stok: id lokasi dan varian menjadi nama, baris menjadi nama × jumlah", () => {
    const d = auditDiffView("stok.transfer", null, { dari: 1, ke: 4, baris: [{ quantity: 2, variantId: 208 }], catatan: "" }, names);
    expect(d.map((x) => [x.label, x.after])).toEqual([
      ["Dari", "Gudang Online"],
      ["Ke", "Toko Sawojajar"],
      ["Barang", "Teduh Gentle Milk Cleanser 150 ml × 2"],
      ["Catatan", "kosong"],
    ]);
    // Tidak ada JSON mentah atau id yang bocor ke tampilan.
    for (const x of d) expect(`${x.label} ${x.after}`).not.toMatch(/variantId|quantity|[{[]|lokasiId/);
  });

  it("kunci dikenali, uang menjadi rupiah, status pesanan menjadi label, opname per varian", () => {
    expect(auditKeyLabel("ongkir.gratisMinimal")).toBe("Gratis ongkir mulai");
    expect(formatAuditValue("ongkir.gratisMinimal", 150000)).toBe("Rp 150.000".replace(" ", formatAuditValue("ongkir.gratisMinimal", 150000).charAt(2)));
    expect(formatAuditValue("status", "siap_diambil")).toBe("Siap Diambil");
    expect(formatAuditValue("harga", { "SKU-1": { normal: 149000, jual: 129000 } })).toMatch(/^SKU-1: Rp.129\.000 \(normal Rp.149\.000\)$/);
    const op = auditDiffView("stok.opname", { 208: 10 }, { 208: 7 }, names);
    expect(op).toEqual([{ key: "208", label: "Teduh Gentle Milk Cleanser 150 ml", before: "10 pcs", after: "7 pcs" }]);
    expect(formatAuditValue("lokasi", [1, 4], names)).toBe("Gudang Online, Toko Sawojajar");
    expect(formatAuditValue("lokasi", [], names)).toBe("semua lokasi");
    expect(formatAuditValue("peran", "staf_cabang")).not.toBe("staf_cabang");
    expect(formatAuditValue("dari", 99, names)).toBe("Lokasi #99");
  });

  it("objek staf dan pelanggan memakai nama, id yang dikumpulkan lengkap", () => {
    expect(auditObjectLabel("staf", "3", names)).toBe("Gudang Demo");
    expect(auditObjectLabel("pelanggan", "17", names)).toBe("Zahra Kamila");
    expect(auditObjectLabel("pesanan", "RONA-2610-000001", names)).toBe("RONA-2610-000001");
    const refs = collectAuditRefs([
      { action: "stok.transfer", before: null, after: { dari: 1, ke: 4, baris: [{ variantId: 208, quantity: 2 }] } },
      { action: "stok.opname", before: { 55: 3 }, after: { 55: 4 } },
      { action: "staf.ubah", before: { lokasi: [2] }, after: { lokasi: [3] }, objectType: "staf", objectId: "3" },
    ]);
    expect([...refs.locations].sort()).toEqual([1, 2, 3, 4]);
    expect([...refs.variants].sort((a, b) => a - b)).toEqual([55, 208]);
    expect([...refs.staff]).toEqual([3]);
  });

  it("label varian tidak mengulang shade Standar", () => {
    expect(variantLabel("Teduh Gentle Milk Cleanser 150 ml", "Standar")).toBe("Teduh Gentle Milk Cleanser 150 ml");
    expect(variantLabel("Lumi Velvet Matte Lipstick", "03 Dusty Rose")).toBe("Lumi Velvet Matte Lipstick 03 Dusty Rose");
  });
});
