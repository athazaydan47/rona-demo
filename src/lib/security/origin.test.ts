import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

const req = (headers: Record<string, string>, url = "http://localhost:3000/api/ulasan/foto") => new Request(url, { method: "POST", headers });

describe("pemeriksaan Origin untuk POST dari browser", () => {
  it("menerima Origin yang sama dengan host", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://rona.example", host: "rona.example", "x-forwarded-proto": "https" }, "https://rona.example/api/x"))).toBe(true);
  });
  it("menolak Origin situs lain, Origin null, dan permintaan tanpa Origin", () => {
    expect(isSameOrigin(req({ origin: "https://jahat.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000" }))).toBe(false);
  });
});
