import { describe, expect, it } from "vitest";
import { renderScopeSql } from "./scope";

describe("buildScopeCondition", () => {
  it("cakupan kategori induk mencakup sub kategorinya", () => {
    const { sql, params } = renderScopeSql({ kind: "category", slug: "bibir" });
    expect(sql).toContain('"products"."status" = $1');
    expect(sql).toContain('"categories"."slug" = $2');
    expect(sql).toContain('"parent_categories"."slug" = $3');
    expect(params).toEqual(["aktif", "bibir", "bibir"]);
  });
  it("sub kategori harus cocok dengan induknya", () => {
    const { params } = renderScopeSql({ kind: "category", slug: "bibir", subSlug: "lipstick" });
    expect(params).toEqual(["aktif", "lipstick", "bibir"]);
  });
  it("pencarian memakai word_similarity, full-text, dan ILIKE", () => {
    const { sql, params } = renderScopeSql({ kind: "search", q: "cusion" });
    expect(sql).toContain("word_similarity(");
    expect(sql).toContain("plainto_tsquery('simple'");
    expect(sql).toContain("ILIKE");
    expect(params).toEqual(["aktif", "cusion", 0.35, "cusion", "%cusion%"]);
  });
  it("pencarian kosong hanya membatasi status", () => {
    expect(renderScopeSql({ kind: "search", q: "   " }).params).toEqual(["aktif"]);
  });
  it("cakupan id kosong tidak pernah cocok", () => {
    expect(renderScopeSql({ kind: "ids", ids: [] }).sql).toBe("false");
  });
});
