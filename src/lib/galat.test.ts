import { describe, expect, it } from "vitest";
import { eventSentry, laporGalat, parseDsn } from "./galat";

describe("pelacakan galat opsional", () => {
  it("DSN kosong: tidak ada yang dikirim", async () => {
    let calls = 0;
    const ok = await laporGalat(new Error("x"), {}, {}, (async () => {
      calls += 1;
      return new Response(null);
    }) as unknown as typeof fetch);
    expect(ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("DSN diisi: envelope ke endpoint Sentry dengan data pribadi disamarkan dan query dibuang", async () => {
    expect(parseDsn("https://kunci@o1.ingest.sentry.io/42")).toMatchObject({ endpoint: "https://o1.ingest.sentry.io/api/42/envelope/", publicKey: "kunci" });
    expect(parseDsn("bukan url")).toBeNull();
    const sent: { url: string; body: string; headers: Record<string, string> }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: String(init.body), headers: init.headers as Record<string, string> });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const ok = await laporGalat(new Error("Gagal kirim ke 081234567890 atau zahra@contoh.com"), { tempat: "uji", url: "/pesanan/X?t=rahasia" }, { SENTRY_DSN: "https://kunci@o1.ingest.sentry.io/42" }, fake);
    expect(ok).toBe(true);
    expect(sent[0].url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    expect(sent[0].headers["x-sentry-auth"]).toContain("sentry_key=kunci");
    expect(sent[0].body).not.toContain("081234567890");
    expect(sent[0].body).not.toContain("zahra@contoh.com");
    expect(sent[0].body).not.toContain("rahasia");
    const event = eventSentry(new Error("a"), { url: "/x?y=1" }, {});
    expect(event.request?.url).toBe("/x");
  });
});
