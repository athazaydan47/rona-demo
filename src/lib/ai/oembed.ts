// Link video dari pembeli (cari dupe). Server tidak pernah mengambil URL dari pembeli secara langsung (cegah SSRF):
// URL hanya dikirim sebagai parameter ke endpoint oEmbed resmi TikTok atau YouTube, setelah lolos daftar izin.
// Satu-satunya pengecualian: tautan pendek vt.tiktok.com diselesaikan dengan satu permintaan HEAD tanpa membaca isi,
// dan tujuannya wajib https ke www.tiktok.com. Redirect diikuti maksimal sekali, selalu dengan batas waktu dan ukuran.

export const LINK_HOSTS = {
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
} as const;
// Host yang boleh dihubungi server: hanya endpoint oEmbed resmi dan penyelesai tautan pendek TikTok.
export const FETCH_HOSTS = ["www.tiktok.com", "vt.tiktok.com", "www.youtube.com"] as const;
export const OEMBED_TIMEOUT_MS = 4000;
export const OEMBED_MAX_BYTES = 64 * 1024;
const THUMB_HOSTS = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|ytimg\.com)$/;

export type LinkKind = { kind: "tiktok"; url: string; short: boolean } | { kind: "youtube"; url: string; videoId: string } | { kind: "lainnya"; host: string } | { kind: "tidak_valid" };

// Klasifikasi URL dari pembeli. Hanya https (atau tanpa skema, dianggap https), tanpa port, tanpa userinfo, dan host
// harus persis ada di daftar izin. Alamat IP, localhost, dan domain lain tidak pernah lolos.
export function classifyLink(input: string): LinkKind {
  const raw = input.trim();
  if (!raw || raw.length > 500) return { kind: "tidak_valid" };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { kind: "tidak_valid" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { kind: "tidak_valid" };
  if (u.username || u.password || u.port) return { kind: "tidak_valid" };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  // Alamat IP (v4 atau v6), localhost, dan nama tanpa titik tidak pernah dianggap link video.
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[") || host.includes(":") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { kind: "tidak_valid" };
  if ((LINK_HOSTS.tiktok as readonly string[]).includes(host)) {
    const short = host === "vt.tiktok.com";
    if (!short && !/\/video\/\d+|\/photo\/\d+|\/t\/[A-Za-z0-9]+/.test(u.pathname)) return { kind: "tidak_valid" };
    if (short && !/^\/[A-Za-z0-9]+\/?$/.test(u.pathname)) return { kind: "tidak_valid" };
    return { kind: "tiktok", url: `https://${host}${u.pathname}`, short };
  }
  if ((LINK_HOSTS.youtube as readonly string[]).includes(host)) {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.pathname === "/watch" ? u.searchParams.get("v") : null;
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { kind: "tidak_valid" };
    return { kind: "youtube", url: `https://www.youtube.com/watch?v=${id}`, videoId: id };
  }
  return { kind: "lainnya", host };
}

export type OembedInfo = { platform: "tiktok" | "youtube"; url: string; title: string; author: string | null; authorUrl: string | null; thumbnailUrl: string | null };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const allowedFetchUrl = (s: string | null): URL | null => {
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.port && !u.username && (FETCH_HOSTS as readonly string[]).includes(u.hostname.toLowerCase()) ? u : null;
  } catch {
    return null;
  }
};

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new Error("Respons terlalu besar");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Satu permintaan ke host yang diizinkan, redirect manual diikuti maksimal sekali ke host yang diizinkan.
// follow: false mengembalikan respons redirect apa adanya (dipakai untuk membaca tujuan tautan pendek).
export async function guardedFetch(target: string, fetchImpl: FetchLike, opts: { method?: "GET" | "HEAD"; timeoutMs?: number; follow?: boolean } = {}): Promise<Response> {
  let url = allowedFetchUrl(target);
  if (!url) throw new Error("Host tidak diizinkan");
  const signal = AbortSignal.timeout(opts.timeoutMs ?? OEMBED_TIMEOUT_MS);
  for (let hop = 0; hop < 2; hop++) {
    const res = await fetchImpl(url.toString(), { method: opts.method ?? "GET", redirect: "manual", signal, headers: { accept: "application/json" } });
    if (res.status < 300 || res.status >= 400 || opts.follow === false) return res;
    const next = allowedFetchUrl(res.headers.get("location") ? new URL(res.headers.get("location")!, url).toString() : null);
    if (!next || hop === 1) throw new Error("Redirect tidak diizinkan");
    url = next;
  }
  throw new Error("Redirect tidak diizinkan");
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const safeHttps = (v: unknown, hostOk: (h: string) => boolean) => {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && hostOk(u.hostname.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
};

// Ambil judul atau caption, kreator, dan URL sampul dari oEmbed resmi. Sampul hanya disimpan sebagai URL untuk
// ditampilkan langsung dari server TikTok atau YouTube (tidak diunduh dan tidak di-hosting ulang).
export async function fetchOembed(link: Extract<LinkKind, { kind: "tiktok" | "youtube" }>, fetchImpl: FetchLike = fetch): Promise<OembedInfo> {
  let videoUrl = link.url;
  if (link.kind === "tiktok" && link.short) {
    const head = await guardedFetch(link.url, fetchImpl, { method: "HEAD", follow: false }).catch(() => null);
    // Tautan pendek: tujuan redirect pertama dipakai sebagai URL video, asal tetap di www.tiktok.com.
    const loc = head && head.status >= 300 && head.status < 400 ? allowedFetchUrl(head.headers.get("location")) : null;
    if (!loc || loc.hostname !== "www.tiktok.com") throw new Error("Tautan pendek TikTok tidak bisa dibuka");
    videoUrl = `https://www.tiktok.com${loc.pathname}`;
  }
  const endpoint = link.kind === "tiktok" ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
  const res = await guardedFetch(endpoint, fetchImpl);
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = JSON.parse(await readCapped(res, OEMBED_MAX_BYTES)) as Record<string, unknown>;
  const title = text(data.title, 400);
  if (!title) throw new Error("oEmbed tanpa judul");
  return {
    platform: link.kind,
    url: videoUrl,
    title,
    author: text(data.author_name, 80) || null,
    authorUrl: safeHttps(data.author_url, (h) => (link.kind === "tiktok" ? /(^|\.)tiktok\.com$/.test(h) : /(^|\.)youtube\.com$/.test(h))),
    thumbnailUrl: safeHttps(data.thumbnail_url, (h) => THUMB_HOSTS.test(h)),
  };
}

// oEmbed tiruan untuk AI_PROVIDER=mock (uji, Playwright, cuplik): tanpa internet, data contoh tetap.
export const MOCK_OEMBED: Record<string, { title: string; author_name: string; author_url: string }> = {
  "7300000000000000001": { title: "Dupe lipstik Wardah warna nude satin buat kondangan, lembap seharian! #lipstik #kondangan", author_name: "Demo Kreator", author_url: "https://www.tiktok.com/@demo.kreator" },
  "7300000000000000002": { title: "Cushion favorit buat kulit berminyak, hasilnya matte natural #cushion", author_name: "Demo Kreator", author_url: "https://www.tiktok.com/@demo.kreator" },
};

export const mockOembedFetch: FetchLike = async (url) => {
  const u = new URL(url);
  const target = u.searchParams.get("url") ?? "";
  const id = /\/video\/(\d+)/.exec(target)?.[1] ?? /[?&]v=([\w-]+)/.exec(target)?.[1] ?? "";
  const hit = MOCK_OEMBED[id];
  if (!hit) return new Response("{}", { status: 404 });
  return new Response(JSON.stringify({ ...hit, thumbnail_url: null }), { status: 200, headers: { "content-type": "application/json" } });
};
