import { describe, expect, it } from "vitest";
import { contrastRatio, darken, hexToRgb, lighten, mix, readableOn, rgbToHex } from "./color";

describe("color", () => {
  it("mengurai dan menulis hex", () => {
    expect(hexToRgb("#B8475D")).toEqual({ r: 184, g: 71, b: 93 });
    expect(rgbToHex({ r: 184, g: 71, b: 93 })).toBe("#B8475D");
    expect(rgbToHex(hexToRgb("abc"))).toBe("#AABBCC");
  });
  it("mencampur warna", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(lighten("#000000", 1)).toBe("#FFFFFF");
    expect(darken("#FFFFFF", 1)).toBe("#000000");
  });
  it("teks putih di atas rona memenuhi WCAG AA", () => {
    expect(contrastRatio("#B8475D", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#2A1F1D", "#FAF7F5")).toBeGreaterThanOrEqual(7);
    expect(readableOn("#B8475D")).toBe("#FFFFFF");
    expect(readableOn("#F4DCDF")).toBe("#2A1F1D");
  });
});
