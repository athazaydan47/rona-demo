// Pelacakan galat opsional (Fase 8B). Bila SENTRY_DSN kosong, tidak ada yang dikirim dan tidak ada SDK yang dimuat:
// galat hanya masuk log terstruktur (log Vercel). Bila diisi, galat dikirim ke Sentry lewat API envelope (fetch biasa,
// tanpa paket @sentry), setelah data pribadi disaring: nomor WA dan email disamarkan, query URL dibuang, dan tidak
// ada cookie, header, atau isi permintaan yang ikut. Paket gratis Sentry cukup untuk demo.
import { logEvent, samarkan } from "@/lib/log";

export type KonteksGalat = { tempat?: string; url?: string; digest?: string; sisi?: "server" | "klien" };

type Dsn = { endpoint: string; publicKey: string; dsn: string };

export function parseDsn(raw: string | undefined): Dsn | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const project = u.pathname.replace(/^\//, "");
    if (!u.username || !project) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, publicKey: u.username, dsn: raw };
  } catch {
    return null;
  }
}

const tanpaQuery = (url?: string) => {
  if (!url) return undefined;
  try {
    const u = new URL(url, "http://lokal");
    return u.pathname.slice(0, 200);
  } catch {
    return undefined;
  }
};

// Isi event Sentry minimal yang sudah disaring. Murni, diuji di galat.test.ts.
export function eventSentry(err: unknown, k: KonteksGalat, env: Record<string, string | undefined> = process.env) {
  const e = err instanceof Error ? err : new Error(String(err));
  const frames = (e.stack ?? "")
    .split("\n")
    .slice(1, 15)
    .map((l) => ({ function: samarkan(l.trim()).slice(0, 200) }))
    .reverse();
  return {
    event_id: globalThis.crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "development",
    release: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? env.APP_COMMIT ?? undefined,
    tags: { sisi: k.sisi ?? "server", tempat: k.tempat ?? "tidak diketahui", ...(k.digest ? { digest: k.digest } : {}) },
    request: k.url ? { url: tanpaQuery(k.url) } : undefined,
    exception: { values: [{ type: e.name || "Error", value: samarkan(e.message).slice(0, 500), stacktrace: frames.length ? { frames } : undefined }] },
  };
}

export async function laporGalat(err: unknown, k: KonteksGalat = {}, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  logEvent("galat", { tempat: k.tempat ?? "", sisi: k.sisi ?? "server", url: tanpaQuery(k.url) ?? "", pesan: err instanceof Error ? err.message : String(err), digest: k.digest ?? "" }, "error");
  const dsn = parseDsn(env.SENTRY_DSN);
  if (!dsn) return false;
  const event = eventSentry(err, k, env);
  const body = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: dsn.dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  try {
    const r = await fetcher(dsn.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=toko-demo/1.0` },
      body,
      signal: AbortSignal.timeout(3000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
