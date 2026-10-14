// Adapter email (murni dan penyedia Resend dengan fetch tiruan).
import { describe, expect, it } from "vitest";
import { emailConfig, emailReady, recipientAllowed, renderEmail } from "./index";
import { createResendProvider } from "./resend";

describe("konfigurasi email", () => {
  it("bawaan pratinjau; resend butuh kunci dan pengirim", () => {
    expect(emailConfig({}).provider).toBe("preview");
    expect(emailReady(emailConfig({ EMAIL_PROVIDER: "resend" }))).toBe(false);
    expect(emailReady(emailConfig({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Rona <halo@rona.test>" }))).toBe(true);
  });
  it("mode demo hanya ke EMAIL_ALLOWLIST (tanpa beda huruf besar kecil)", () => {
    const cfg = emailConfig({ DEMO_MODE: "true", EMAIL_ALLOWLIST: " Saya@Contoh.com, tim@contoh.com " });
    expect(recipientAllowed("saya@contoh.com", cfg)).toBe(true);
    expect(recipientAllowed("orang@lain.com", cfg)).toBe(false);
    expect(recipientAllowed("orang@lain.com", emailConfig({ DEMO_MODE: "false" }))).toBe(true);
    expect(recipientAllowed("siapa@saja.com", emailConfig({ DEMO_MODE: "true" }))).toBe(false);
  });
});

describe("template email", () => {
  it("HTML dan teks dengan tautan absolut, isi di-escape", () => {
    const e = renderEmail({ subject: "Pesanan RONA-2610-000001 dibayar", body: "Halo <Ayu>, cek di /pesanan/RONA-2610-000001?t=abc", site: "https://rona.test" });
    expect(e.text).toContain("https://rona.test/pesanan/RONA-2610-000001?t=abc");
    expect(e.html).toContain('href="https://rona.test/pesanan/RONA-2610-000001?t=abc"');
    expect(e.html).toContain("&lt;Ayu&gt;");
    expect(e.html).toContain("max-width:600px");
    expect(e.html).not.toMatch(/promo|diskon/i);
  });
});

describe("penyedia Resend", () => {
  const msg = { to: "a@b.c", subject: "S", html: "<p>h</p>", text: "t", idempotencyKey: "rona-notif-7" };
  it("mengirim lewat REST dengan kunci idempoten", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await createResendProvider("re_key", "Rona <halo@rona.test>", fake).send(msg);
    expect(r).toEqual({ ok: true, id: "em_1" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("rona-notif-7");
    expect(headers.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ from: "Rona <halo@rona.test>", to: ["a@b.c"], subject: "S" });
  });
  it("5xx dan 429 boleh dicoba lagi, 4xx lain tidak, error jaringan boleh", async () => {
    const respond = (status: number) => (async () => new Response(JSON.stringify({ message: "x" }), { status })) as unknown as typeof fetch;
    expect(await createResendProvider("k", "f", respond(500)).send(msg)).toMatchObject({ ok: false, retryable: true });
    expect(await createResendProvider("k", "f", respond(429)).send(msg)).toMatchObject({ ok: false, retryable: true });
    expect(await createResendProvider("k", "f", respond(422)).send(msg)).toMatchObject({ ok: false, retryable: false, error: expect.stringContaining("422") });
    const boom = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    expect(await createResendProvider("k", "f", boom).send(msg)).toMatchObject({ ok: false, retryable: true, error: expect.stringContaining("ECONNRESET") });
  });
});
