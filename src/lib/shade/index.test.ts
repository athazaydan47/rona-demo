import { describe, expect, it } from "vitest";
import { isGoodMatch, parseProfile, scoreShade, suggestShades, type ShadeCandidate } from "./index";

const v = (id: number, shadeName: string, depth: number | null, undertone: ShadeCandidate["undertone"]): ShadeCandidate => ({ id, shadeName, hex: "#000000", depth, undertone });
const cushion = [
  v(1, "01C Porselen", 1, "cool"),
  v(2, "02N Gading", 1, "neutral"),
  v(3, "03W Langsat Terang", 2, "warm"),
  v(4, "04N Langsat", 2, "neutral"),
  v(5, "05W Madu", 3, "warm"),
  v(6, "06N Pasir", 3, "neutral"),
  v(7, "07W Sawo Muda", 4, "warm"),
  v(8, "08N Karamel", 4, "neutral"),
  v(9, "09W Sawo Matang", 5, "warm"),
  v(10, "10N Kayu Manis", 6, "neutral"),
];

describe("suggestShades", () => {
  it("memilih kedalaman tepat dengan undertone sama sebagai yang terbaik", () => {
    const r = suggestShades(cushion, { depth: 4, undertone: "warm" });
    expect(r.map((s) => s.variant.shadeName)).toEqual(["07W Sawo Muda", "08N Karamel", "09W Sawo Matang"]);
    expect(r[0].reason).toContain("Paling cocok");
    expect(r[0].reason).toContain("kedalaman pas");
    expect(r[2].reason).toContain("1 tingkat lebih gelap");
  });
  it("kedalaman lebih diutamakan daripada undertone", () => {
    const r = suggestShades(cushion, { depth: 5, undertone: "cool" });
    expect(r[0].variant.shadeName).toBe("09W Sawo Matang"); // kedalaman pas walau undertone berlawanan
    expect(r[1].variant.shadeName).toBe("10N Kayu Manis"); // seri dengan 08N, yang lebih gelap didahulukan
  });
  it("undertone neutral menerima warm dan cool dengan selisih kecil", () => {
    expect(scoreShade({ depth: 3, undertone: "neutral" }, v(5, "05W Madu", 3, "warm"))).toBe(1);
    expect(scoreShade({ depth: 3, undertone: "neutral" }, v(6, "06N Pasir", 3, "neutral"))).toBe(0);
    expect(scoreShade({ depth: 3, undertone: "warm" }, v(1, "x", 3, "cool"))).toBe(2);
  });
  it("mengabaikan varian tanpa data shade dan tetap mengembalikan maksimal 3", () => {
    const r = suggestShades([v(1, "30 ml", null, null), ...cushion], { depth: 2, undertone: "warm" });
    expect(r).toHaveLength(3);
    expect(r.every((s) => s.variant.depth != null)).toBe(true);
  });
  it("menandai kecocokan untuk shade dengan selisih kecil", () => {
    const profile = { depth: 4, undertone: "warm" as const };
    expect(isGoodMatch(profile, cushion[6])).toBe(true);
    expect(isGoodMatch(profile, cushion[7])).toBe(true); // 08N: kedalaman pas, undertone neutral
    expect(isGoodMatch(profile, cushion[9])).toBe(false);
  });
  it("membaca profil tersimpan dengan validasi", () => {
    expect(parseProfile('{"depth":4,"undertone":"warm"}')).toEqual({ depth: 4, undertone: "warm" });
    expect(parseProfile('{"depth":9,"undertone":"warm"}')).toBeNull();
    expect(parseProfile("bukan json")).toBeNull();
    expect(parseProfile(null)).toBeNull();
  });
});
