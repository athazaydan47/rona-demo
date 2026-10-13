import { describe, expect, it } from "vitest";
import { assertResetAllowed, databaseHost, directUrl, isLocalDatabase } from "./connection";

describe("koneksi database untuk skrip", () => {
  it("memakai DATABASE_URL_UNPOOLED bila ada, kalau tidak DATABASE_URL", () => {
    expect(directUrl({ DATABASE_URL: "postgres://a@pool/x", DATABASE_URL_UNPOOLED: "postgres://a@direct/x" })).toBe("postgres://a@direct/x");
    expect(directUrl({ DATABASE_URL: "postgres://a@pool/x", DATABASE_URL_UNPOOLED: "" })).toBe("postgres://a@pool/x");
    expect(directUrl({})).toBe("");
  });
  it("mengenali host lokal", () => {
    expect(isLocalDatabase("postgres://u@127.0.0.1:5432/rona_demo")).toBe(true);
    expect(isLocalDatabase("postgres://u@localhost/rona_demo")).toBe(true);
    expect(isLocalDatabase("postgres://u:p@ep-cool-name-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")).toBe(false);
    expect(databaseHost("bukan url")).toBe("");
  });
});

describe("penjaga db:reset", () => {
  const neon = "postgres://u:p@ep-cool-name.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  it("mengizinkan database lokal tanpa konfirmasi", () => {
    expect(() => assertResetAllowed("postgres://u@127.0.0.1:5432/rona_demo", {})).not.toThrow();
  });
  it("menolak host lain dengan pesan yang jelas", () => {
    expect(() => assertResetAllowed(neon, {})).toThrow(/db:reset ditolak: database tujuan ada di host ep-cool-name\.ap-southeast-1\.aws\.neon\.tech/);
    expect(() => assertResetAllowed(neon, { CONFIRM_RESET: "ya" })).toThrow("CONFIRM_RESET=rona-demo");
  });
  it("mengizinkan host lain bila CONFIRM_RESET=rona-demo", () => {
    expect(() => assertResetAllowed(neon, { CONFIRM_RESET: "rona-demo" })).not.toThrow();
  });
  it("menolak bila URL kosong", () => {
    expect(() => assertResetAllowed("", {})).toThrow("DATABASE_URL belum diisi");
  });
});
