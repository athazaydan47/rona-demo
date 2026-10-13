import { describe, expect, it } from "vitest";
import { billableKg, cheapestAndFastest, quoteShipping } from "./index";

describe("billableKg", () => {
  it("membulatkan ke atas per kg setelah toleransi 300 gram, minimal 1 kg", () => {
    expect(billableKg(0)).toBe(1);
    expect(billableKg(250)).toBe(1);
    expect(billableKg(1300)).toBe(1);
    expect(billableKg(1301)).toBe(2);
    expect(billableKg(2300)).toBe(2);
    expect(billableKg(2301)).toBe(3);
  });
});

describe("quoteShipping", () => {
  it("kurir instan hanya untuk Kota Malang", () => {
    expect(quoteShipping({ totalGram: 200, citySlug: "kota-malang" }).some((q) => q.code === "instan")).toBe(true);
    expect(quoteShipping({ totalGram: 200, citySlug: "surabaya" }).some((q) => q.code === "instan")).toBe(false);
    expect(quoteShipping({ totalGram: 200, citySlug: "jakarta" }).some((q) => q.code === "instan")).toBe(false);
  });
  it("tarif mengikuti zona dan berat tagih", () => {
    const jatim = quoteShipping({ totalGram: 1500, citySlug: "surabaya" }); // 2 kg
    const jne = jatim.find((q) => q.code === "jne_reg");
    expect(jne?.cost).toBe(26000);
    const luar = quoteShipping({ totalGram: 100, citySlug: "medan" }).find((q) => q.code === "jne_reg");
    expect(luar?.cost).toBe(34000);
    expect(luar?.etaLabel).toBe("3 sampai 6 hari");
  });
  it("kota tidak dikenal menghasilkan daftar kosong, ambil di toko hanya bila diminta", () => {
    expect(quoteShipping({ totalGram: 100, citySlug: "atlantis" })).toEqual([]);
    expect(quoteShipping({ totalGram: 100, citySlug: "kota-malang" }).some((q) => q.code === "ambil_di_toko")).toBe(false);
    expect(quoteShipping({ totalGram: 100, citySlug: "kota-malang", includePickup: true }).some((q) => q.code === "ambil_di_toko")).toBe(true);
  });
  it("termurah dan tercepat dipilih dengan benar", () => {
    const { cheapest, fastest } = cheapestAndFastest(quoteShipping({ totalGram: 100, citySlug: "kota-malang" }));
    expect(cheapest?.code).toBe("jnt_ez");
    expect(fastest?.code).toBe("instan");
    const jawa = cheapestAndFastest(quoteShipping({ totalGram: 100, citySlug: "jakarta" }));
    expect(jawa.fastest?.code).toBe("jne_yes");
    expect(cheapestAndFastest([])).toEqual({ cheapest: null, fastest: null });
  });
});
