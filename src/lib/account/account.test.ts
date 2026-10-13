import { describe, expect, it } from "vitest";
import { authSecret } from "@/lib/auth/secret";
import { reviewerDisplayName, validateReview } from "@/lib/reviews/service";
import { normalizeAddress } from "./addresses";
import { sanitizeSkinProfile, validateName } from "./profile";

describe("profil kulit", () => {
  it("hanya menyimpan nilai yang sah dan mencatat sumber serta waktu", () => {
    const now = new Date("2026-10-14T03:00:00Z");
    const p = sanitizeSkinProfile({ skinType: "berminyak", concerns: ["jerawat", "jerawat", "palsu"], undertone: "ungu", finish: "matte", depth: 9, budget: 150000 }, "formulir", now);
    expect(p).toEqual({ skinType: "berminyak", concerns: ["jerawat"], finish: "matte", budget: 150000, source: "formulir", updatedAt: now.toISOString() });
  });
  it("nama 2 sampai 60 huruf", () => {
    expect(validateName("  Nadia   Putri ")).toBe("Nadia Putri");
    expect(validateName("A")).toBeNull();
  });
});

describe("alamat", () => {
  const base = { label: "", recipient: "Nadia", phone: "+62 812-3456-7890", provinceCode: "35", regencyCode: "35.73", districtCode: "35.73.05", postalCode: "65145", street: "Jl. Sumbersari No. 12" };
  it("mengubah kode wilayah jadi nama dan menormalkan nomor", () => {
    const r = normalizeAddress(base);
    expect(r).toMatchObject({ ok: true, value: { label: "Rumah", phone: "081234567890", province: "Jawa Timur", city: "Kota Malang", district: "Lowokwaru" } });
  });
  it("menolak kota yang tidak cocok dengan provinsinya dan kecamatan Jawa Timur yang tidak ada", () => {
    expect(normalizeAddress({ ...base, regencyCode: "31.71" })).toMatchObject({ ok: false, field: "regencyCode" });
    expect(normalizeAddress({ ...base, districtCode: "35.73.99" })).toMatchObject({ ok: false, field: "district" });
    expect(normalizeAddress({ ...base, postalCode: "651" })).toMatchObject({ ok: false, field: "postalCode" });
  });
});

describe("ulasan", () => {
  it("nama tampil disingkat", () => {
    expect(reviewerDisplayName("Nadia Putri Lestari")).toBe("Nadia L.");
    expect(reviewerDisplayName("Ayu")).toBe("Ayu");
    expect(reviewerDisplayName("")).toBe("Pembeli Rona");
  });
  it("bintang 1 sampai 5, teks minimal 20 karakter, maksimal 3 foto", () => {
    const body = "Cocok di kulit kombinasiku, tidak lengket.";
    expect(validateReview({ rating: 5, body })).toBeNull();
    expect(validateReview({ rating: 0, body })).toContain("bintang");
    expect(validateReview({ rating: 5, body: "pendek" })).toContain("20");
    expect(validateReview({ rating: 5, body, photos: ["a", "b", "c", "d"] })).toContain("3 foto");
    expect(validateReview({ rating: 5, body, skinType: "alien" })).toContain("tidak valid");
  });
});

describe("rahasia sesi", () => {
  it("wajib di produksi Vercel, punya cadangan saat lokal", () => {
    expect(authSecret({ NODE_ENV: "production", VERCEL: "1" })).toBeNull();
    expect(authSecret({ NODE_ENV: "production", VERCEL: "1", SESSION_SECRET: "x".repeat(32) })).toBe("x".repeat(32));
    expect(authSecret({ NODE_ENV: "development" })).toBeTruthy();
    expect(authSecret({ NODE_ENV: "production", VERCEL: "1", SESSION_SECRET: "pendek" })).toBeNull();
  });
});
