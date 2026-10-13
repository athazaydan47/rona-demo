import { describe, expect, it } from "vitest";
import { districts, provinces, regencies, regionName, zoneForRegency } from "./regions";

describe("data wilayah", () => {
  it("memuat seluruh provinsi dan kota, kecamatan lengkap untuk Jawa Timur", () => {
    expect(provinces().length).toBeGreaterThanOrEqual(34);
    expect(regencies("35").length).toBe(38);
    expect(districts("35.73").map((d) => d.nama)).toEqual(expect.arrayContaining(["Lowokwaru", "Klojen", "Blimbing", "Sukun", "Kedungkandang"]));
    expect(districts("31.71")).toEqual([]);
    expect(regionName("35.73")).toBe("Kota Malang");
  });
  it("memetakan kota ke zona ongkir", () => {
    expect(zoneForRegency("35.73")).toBe("dalam_kota");
    expect(zoneForRegency("35.07")).toBe("jatim"); // Kabupaten Malang
    expect(zoneForRegency("35.78")).toBe("jatim"); // Kota Surabaya
    expect(zoneForRegency("31.71")).toBe("jawa");
    expect(zoneForRegency("34.71")).toBe("jawa"); // Kota Yogyakarta
    expect(zoneForRegency("51.71")).toBe("luar_jawa"); // Kota Denpasar
    expect(zoneForRegency("99.99")).toBeNull();
  });
});
