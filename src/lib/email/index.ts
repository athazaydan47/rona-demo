// Adapter email (Fase 6C). Murni: konfigurasi dari env, allowlist mode demo, dan template email transaksional.
// Pengiriman ada di dispatch.ts, penyedia Resend di resend.ts. Kanal WhatsApp tetap pratinjau (lihat whatsapp.ts).
import { absoluteLinks } from "@/lib/notifications/links";
import { MEREK } from "@/config/merek";

export const MAX_EMAIL_ATTEMPTS = 3;

export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey: string };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; retryable: boolean };
export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

export type EmailConfig = { provider: "preview" | "resend"; apiKey: string; from: string; allowlist: string[]; demoMode: boolean };

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" ? "resend" : "preview";
  return {
    provider,
    apiKey: env.RESEND_API_KEY?.trim() ?? "",
    from: env.EMAIL_FROM?.trim() ?? "",
    allowlist: (env.EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    demoMode: env.DEMO_MODE === "true",
  };
}

// Pengiriman sungguhan hanya bila penyedia resend lengkap. Selain itu mode pratinjau: tidak mengirim apa pun.
export function emailReady(cfg: EmailConfig) {
  return cfg.provider === "resend" && Boolean(cfg.apiKey) && Boolean(cfg.from);
}

// Mode demo: email sungguhan hanya ke alamat di EMAIL_ALLOWLIST supaya situs demo tidak bisa dipakai untuk spam.
export function recipientAllowed(recipient: string, cfg: Pick<EmailConfig, "allowlist" | "demoMode">) {
  if (!cfg.demoMode) return true;
  return cfg.allowlist.includes(recipient.trim().toLowerCase());
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g;

// Template transaksional: HTML sederhana yang responsif (tabel 600 px, gaya inline) dan versi teks biasa.
export function renderEmail(input: { subject: string; body: string; site: string; storeName?: string }) {
  const store = input.storeName ?? MEREK.namaLengkap;
  const text = absoluteLinks(input.body, input.site);
  const paragraphs = text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2A1F1D">${escapeHtml(p).replace(URL_RE, (u) => `<a href="${u}" style="color:#B8475D;font-weight:600">${u}</a>`)}</p>`)
    .join("");
  const site = input.site.replace(/\/$/, "");
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF7F5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #EADFDB;border-radius:16px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #EADFDB"><span style="font-family:Georgia,serif;font-size:22px;color:#2A1F1D">${escapeHtml(store)}</span></td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:20px;font-weight:normal;color:#2A1F1D">${escapeHtml(input.subject)}</h1>${paragraphs}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #EADFDB;font-size:12px;line-height:1.5;color:#8A7D78">Email ini dikirim otomatis karena ada aktivitas di akun atau pesananmu di <a href="${site}" style="color:#8A7D78">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a>. Ini toko demo dengan data fiktif.</td></tr>
</table></td></tr></table></body></html>`;
  return { html, text: `${input.subject}\n\n${text}\n\n${store}, ${site}\nEmail ini dikirim otomatis. Ini toko demo dengan data fiktif.` };
}
