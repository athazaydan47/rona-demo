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

import { instantAvailability } from "./index";
import { wibDate } from "@/lib/format";

describe("jam operasional kurir instan", () => {
  // 14 Okt 2026 Rabu, 17 Okt Sabtu, 18 Okt Minggu.
  it("tersedia Senin sampai Sabtu pukul 08.00 sampai 17.00 WIB", () => {
    expect(instantAvailability(wibDate(2026, 10, 14, 8, 0))).toEqual({ available: true, note: null });
    expect(instantAvailability(wibDate(2026, 10, 14, 16, 59)).available).toBe(true);
    expect(instantAvailability(wibDate(2026, 10, 17, 12, 0)).available).toBe(true);
  });
  it("dini hari tidak tersedia, tersedia lagi hari ini pukul 08.00", () => {
    expect(instantAvailability(wibDate(2026, 10, 14, 1, 18))).toEqual({ available: false, note: "Tersedia lagi hari ini pukul 08.00" });
  });
  it("setelah 17.00 tersedia lagi besok, Sabtu malam dan Minggu lompat ke Senin", () => {
    expect(instantAvailability(wibDate(2026, 10, 14, 17, 0))).toEqual({ available: false, note: "Tersedia lagi besok pukul 08.00" });
    expect(instantAvailability(wibDate(2026, 10, 17, 18, 0)).note).toBe("Tersedia lagi Senin pukul 08.00");
    expect(instantAvailability(wibDate(2026, 10, 18, 10, 0)).note).toBe("Tersedia lagi besok pukul 08.00");
  });
  it("memakai WIB walau jam UTC sudah berganti hari", () => {
    // 15 Okt 00.30 WIB = 14 Okt 17.30 UTC
    expect(instantAvailability(new Date("2026-10-14T17:30:00.000Z")).note).toBe("Tersedia lagi hari ini pukul 08.00");
  });
});
