// Penyedia email Resend lewat REST API (fetch, tanpa SDK). Kunci idempoten dikirim di header Idempotency-Key
// supaya percobaan ulang tidak mengirim email yang sama dua kali.
import type { EmailMessage, EmailProvider, SendResult } from "./index";

export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    name: "resend",
    async send(msg: EmailMessage): Promise<SendResult> {
      try {
        const res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": msg.idempotencyKey },
          body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
        if (res.ok && data.id) return { ok: true, id: data.id };
        const error = `Resend ${res.status}: ${data.message ?? data.name ?? "tanpa pesan"}`.slice(0, 300);
        // 429 dan 5xx boleh dicoba lagi; 4xx lain (alamat salah, domain belum diverifikasi) tidak.
        return { ok: false, error, retryable: res.status === 429 || res.status >= 500 };
      } catch (e) {
        return { ok: false, error: `Jaringan: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), retryable: true };
      }
    },
  };
}
