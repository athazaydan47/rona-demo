// Link video dari pembeli (cari dupe dan chat asisten). Server tidak pernah mengambil URL dari pembeli apa adanya (cegah
// SSRF): link diklasifikasikan dulu terhadap daftar izin, lalu server hanya menghubungi host TikTok dan YouTube yang
// diizinkan, selalu https, tanpa port, dengan batas waktu dan ukuran, dan setiap langkah redirect diperiksa ulang.
//
// Fase 8C: link TikTok asli sering gagal karena endpoint oEmbed TikTok menolak sekitar separuh permintaan secara acak
// (HTTP 503 "overload-protect triggered", kadang 429), sementara kode lama hanya mencoba sekali. Alurnya sekarang:
//   1. tautan_pendek: vt.tiktok.com, vm.tiktok.com, dan tiktok.com/t/ diselesaikan sampai 5 langkah redirect
//      (HEAD, lalu GET bila HEAD ditolak), sampai ketemu id video.
//   2. oembed: endpoint resmi dengan URL kanonis, dicoba ulang untuk 429 dan 5xx dalam anggaran waktu.
//   3. halaman: bila oEmbed tetap gagal, caption dibaca dari data JSON halaman video kanonis (host yang sama).
// Setiap tahap dicatat di jejak (tahap, status HTTP, lama) untuk ai_logs, Kesehatan AI, dan npm run cek:tiktok.

export const LINK_HOSTS = {
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
} as const;
// Host yang boleh dihubungi server: endpoint oEmbed resmi, penyelesai tautan pendek TikTok, dan halaman video kanonis.
export const FETCH_HOSTS = ["www.tiktok.com", "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com", "www.youtube.com"] as const;
export const OEMBED_TIMEOUT_MS = 4000;
export const OEMBED_MAX_BYTES = 64 * 1024;
export const PAGE_MAX_BYTES = 2_500_000;
export const SHORT_MAX_HOPS = 5;
// Jeda sebelum percobaan ulang oEmbed (ms). Diukur Okt 2026: 503 acak sekitar 55% dan kadang beruntun, jadi enam
// percobaan dengan jeda bertambah (peluang semuanya gagal sekitar 3%) dalam anggaran sekitar 4 detik.
export const OEMBED_RETRY_DELAYS = [250, 400, 600, 900, 1200];
export const LINK_BUDGET_MS = 9000;
const THUMB_HOSTS = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|ytimg\.com)$/;

export type TiktokLink = { kind: "tiktok"; url: string; short: boolean; videoId: string | null; foto?: boolean };
export type YoutubeLink = { kind: "youtube"; url: string; videoId: string };
export type LinkKind = TiktokLink | YoutubeLink | { kind: "lainnya"; host: string } | { kind: "tidak_valid" };

const TIKTOK_SHORT_HOSTS = new Set(["vt.tiktok.com", "vm.tiktok.com"]);
const canonicalTiktok = (videoId: string, handle?: string | null, foto = false) => `https://www.tiktok.com/@${handle && /^[\w.]{1,40}$/.test(handle) ? handle : "_"}/${foto ? "photo" : "video"}/${videoId}`;

// Id video dari path TikTok: /@akun/video/ID, /@akun/photo/ID, /v/ID.html (m.tiktok.com), /embed/v2/ID.
export function tiktokIdFromPath(pathname: string): { videoId: string; handle: string | null; foto: boolean } | null {
  const m = /^\/@([\w.]*)\/(video|photo)\/(\d{8,25})\/?$/.exec(pathname) ?? null;
  if (m) return { videoId: m[3], handle: m[1] || null, foto: m[2] === "photo" };
  const v = /^\/v\/(\d{8,25})(?:\.html)?\/?$/.exec(pathname) ?? /^\/embed(?:\/v2)?\/(\d{8,25})\/?$/.exec(pathname);
  return v ? { videoId: v[1], handle: null, foto: false } : null;
}

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
    if (TIKTOK_SHORT_HOSTS.has(host)) {
      if (!/^\/[A-Za-z0-9]{5,20}\/?$/.test(u.pathname)) return { kind: "tidak_valid" };
      return { kind: "tiktok", url: `https://${host}${u.pathname.replace(/\/?$/, "/")}`, short: true, videoId: null };
    }
    const t = /^\/t\/([A-Za-z0-9]{5,20})\/?$/.exec(u.pathname);
    if (t) return { kind: "tiktok", url: `https://www.tiktok.com/t/${t[1]}/`, short: true, videoId: null };
    const id = tiktokIdFromPath(u.pathname);
    if (!id) return { kind: "tidak_valid" };
    return { kind: "tiktok", url: canonicalTiktok(id.videoId, id.handle, id.foto), short: false, videoId: id.videoId, ...(id.foto ? { foto: true } : {}) };
  }
  if ((LINK_HOSTS.youtube as readonly string[]).includes(host)) {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.pathname === "/watch" ? u.searchParams.get("v") : null;
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { kind: "tidak_valid" };
    return { kind: "youtube", url: `https://www.youtube.com/watch?v=${id}`, videoId: id };
  }
  return { kind: "lainnya", host };
}

// Link pertama di sebuah pesan (chat asisten): link TikTok atau YouTube di tengah kalimat, atau link domain lain.
export function findLinkInText(text: string): { raw: string; link: LinkKind } | null {
  const candidates = text.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi) ?? [];
  for (const c of candidates) {
    const raw = c.replace(/[),.!?;:]+$/, "");
    // Kata biasa dengan titik (misal "s.d.") bukan link: harus ada skema, www, atau host video yang dikenal.
    if (!/^https?:\/\//i.test(raw) && !/^(www\.|m\.|vt\.|vm\.)/i.test(raw) && !/^(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|shopee\.co\.id|tokopedia\.com)\b/i.test(raw)) continue;
    const link = classifyLink(raw);
    if (link.kind !== "tidak_valid") return { raw, link };
  }
  return null;
}

export type OembedInfo = { platform: "tiktok" | "youtube"; url: string; title: string; author: string | null; authorUrl: string | null; thumbnailUrl: string | null };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type LinkStage = "klasifikasi" | "tautan_pendek" | "oembed" | "halaman";
export type LinkTrace = { tahap: LinkStage; status: number | null; ms: number; catatan?: string };
export type LinkFailure = { tahap: LinkStage; status: number | null; kode: "tidak_valid" | "tidak_ditemukan" | "privat" | "ditolak" | "jaringan" | "format" | "jenis_konten" };
export type VideoInfoResult = { ok: true; info: OembedInfo; sumber: "oembed" | "halaman"; jejak: LinkTrace[] } | { ok: false; gagal: LinkFailure; jejak: LinkTrace[] };

const allowedFetchUrl = (s: string | null): URL | null => {
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.port && !u.username && !u.password && (FETCH_HOSTS as readonly string[]).includes(u.hostname.toLowerCase()) ? u : null;
  } catch {
    return null;
  }
};

async function readCapped(res: Response, max: number, stopWhen?: (text: string) => boolean): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new Error("Respons terlalu besar");
    }
    text += decoder.decode(value, { stream: true });
    if (stopWhen?.(text)) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return text;
}

// Satu permintaan ke host yang diizinkan. follow: false mengembalikan respons redirect apa adanya; selain itu redirect
// diikuti maksimal sekali dan tujuannya harus tetap di host yang diizinkan.
export async function guardedFetch(target: string, fetchImpl: FetchLike, opts: { method?: "GET" | "HEAD"; timeoutMs?: number; follow?: boolean; accept?: string } = {}): Promise<Response> {
  let url = allowedFetchUrl(target);
  if (!url) throw new Error("Host tidak diizinkan");
  const signal = AbortSignal.timeout(opts.timeoutMs ?? OEMBED_TIMEOUT_MS);
  for (let hop = 0; hop < 2; hop++) {
    const res = await fetchImpl(url.toString(), { method: opts.method ?? "GET", redirect: "manual", signal, headers: { accept: opts.accept ?? "application/json" } });
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
const tiktokAuthorUrl = (h: string) => /(^|\.)tiktok\.com$/.test(h);
const youtubeAuthorUrl = (h: string) => /(^|\.)youtube\.com$/.test(h);

export type LinkDeps = { fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void>; clock?: () => number; budgetMs?: number };
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const statusOf = (e: unknown) => (e instanceof Error && /^HTTP (\d+)/.test(e.message) ? Number(/^HTTP (\d+)/.exec(e.message)![1]) : null);

// Tautan pendek TikTok: ikuti redirect satu per satu (maksimal 5), HEAD dulu lalu GET bila HEAD ditolak atau tidak
// memberi lokasi. Setiap tujuan diperiksa ulang terhadap daftar host. Berhenti begitu path berisi id video.
export async function resolveTiktokShort(url: string, deps: LinkDeps, trace: LinkTrace[]): Promise<{ ok: true; videoId: string; handle: string | null; foto: boolean } | { ok: false; gagal: LinkFailure }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clock = deps.clock ?? Date.now;
  let current = allowedFetchUrl(url);
  if (!current) return { ok: false, gagal: { tahap: "tautan_pendek", status: null, kode: "tidak_valid" } };
  for (let hop = 0; hop < SHORT_MAX_HOPS; hop++) {
    const t0 = clock();
    let res: Response | null = null;
    let method: "HEAD" | "GET" = "HEAD";
    for (const m of ["HEAD", "GET"] as const) {
      method = m;
      res = await guardedFetch(current.toString(), fetchImpl, { method: m, follow: false, accept: "text/html" }).catch(() => null);
      // GET dipakai bila HEAD gagal jaringan, ditolak (4xx atau 5xx), atau 200 tanpa lokasi (halaman perantara).
      if (res && res.status >= 300 && res.status < 400 && res.headers.get("location")) break;
      if (res && m === "HEAD" && res.status >= 200 && res.status < 300 && tiktokIdFromPath(current.pathname)) break;
    }
    await res?.body?.cancel().catch(() => {});
    const loc = res?.headers.get("location") ?? null;
    trace.push({ tahap: "tautan_pendek", status: res?.status ?? null, ms: clock() - t0, catatan: `${method}${loc ? " redirect" : ""}` });
    const here = tiktokIdFromPath(current.pathname);
    if (here) return { ok: true, ...here };
    if (!res) return { ok: false, gagal: { tahap: "tautan_pendek", status: null, kode: "jaringan" } };
    if (!loc) return { ok: false, gagal: { tahap: "tautan_pendek", status: res.status, kode: res.status === 404 ? "tidak_ditemukan" : "ditolak" } };
    const next = allowedFetchUrl(new URL(loc, current).toString());
    if (!next) return { ok: false, gagal: { tahap: "tautan_pendek", status: res.status, kode: "ditolak" } };
    if (next.hostname === "www.tiktok.com" && /^\/404\b|^\/login\b/.test(next.pathname)) return { ok: false, gagal: { tahap: "tautan_pendek", status: res.status, kode: next.pathname.startsWith("/login") ? "privat" : "tidak_ditemukan" } };
    const id = tiktokIdFromPath(next.pathname);
    if (id) {
      trace.push({ tahap: "tautan_pendek", status: res.status, ms: 0, catatan: "id ditemukan" });
      return { ok: true, ...id };
    }
    current = next;
  }
  return { ok: false, gagal: { tahap: "tautan_pendek", status: null, kode: "ditolak" } };
}

// oEmbed resmi dengan percobaan ulang untuk 429 dan 5xx (termasuk 503 "overload-protect" TikTok) dalam anggaran waktu.
async function oembedWithRetry(platform: "tiktok" | "youtube", videoUrl: string, deps: LinkDeps, trace: LinkTrace[], deadline: number): Promise<{ ok: true; info: OembedInfo } | { ok: false; status: number | null; kode: LinkFailure["kode"] }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const clock = deps.clock ?? Date.now;
  const endpoint = platform === "tiktok" ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
  let last: { status: number | null; kode: LinkFailure["kode"] } = { status: null, kode: "jaringan" };
  for (let attempt = 0; attempt <= OEMBED_RETRY_DELAYS.length; attempt++) {
    const t0 = clock();
    try {
      const res = await guardedFetch(endpoint, fetchImpl, { timeoutMs: Math.max(800, Math.min(OEMBED_TIMEOUT_MS, deadline - t0)) });
      trace.push({ tahap: "oembed", status: res.status, ms: clock() - t0, catatan: `percobaan ${attempt + 1}` });
      if (res.ok) {
        const data = JSON.parse(await readCapped(res, OEMBED_MAX_BYTES)) as Record<string, unknown>;
        const title = text(data.title, 400);
        if (!title) return { ok: false, status: res.status, kode: "format" };
        return {
          ok: true,
          info: {
            platform,
            url: videoUrl,
            title,
            author: text(data.author_name, 80) || null,
            authorUrl: safeHttps(data.author_url, platform === "tiktok" ? tiktokAuthorUrl : youtubeAuthorUrl),
            thumbnailUrl: safeHttps(data.thumbnail_url, (h) => THUMB_HOSTS.test(h)),
          },
        };
      }
      await res.body?.cancel().catch(() => {});
      last = { status: res.status, kode: res.status === 404 || res.status === 400 ? "tidak_ditemukan" : res.status === 401 || res.status === 403 ? "privat" : "ditolak" };
      if (res.status !== 429 && res.status < 500) return { ok: false, ...last };
    } catch (e) {
      if (e instanceof Error && /terlalu besar/.test(e.message)) throw e;
      trace.push({ tahap: "oembed", status: statusOf(e), ms: clock() - t0, catatan: `percobaan ${attempt + 1}, ${e instanceof Error ? e.message.slice(0, 40) : "galat"}` });
      last = { status: null, kode: "jaringan" };
    }
    const wait = OEMBED_RETRY_DELAYS[attempt];
    if (wait == null || clock() + wait + 800 > deadline) break;
    await sleep(wait + Math.floor(Math.random() * 150));
  }
  return { ok: false, ...last };
}

// Cadangan TikTok: caption dari data JSON halaman video kanonis (www.tiktok.com, tanpa cookie, dibaca sampai skrip
// data selesai, maksimal 2,5 MB). Isinya data, bukan instruksi; hanya caption, kreator, dan sampul yang dipakai.
export function parseTiktokPage(html: string, videoId: string): { ok: true; title: string; author: string | null; handle: string | null; thumbnailUrl: string | null; foto: boolean } | { ok: false; kode: LinkFailure["kode"] } {
  const m = /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  // Tantangan bot TikTok ("Please wait...", WAF Slardar): IP server sedang ditandai. Tidak dicoba diakali.
  if (!m) return { ok: false, kode: /_wafchallengeid|SlardarWAF/.test(html) ? "ditolak" : "format" };
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return { ok: false, kode: "format" };
  }
  const detail = (data as { __DEFAULT_SCOPE__?: Record<string, { statusCode?: number; itemInfo?: { itemStruct?: Record<string, unknown> } }> })?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const item = detail?.itemInfo?.itemStruct;
  if (!item || String(item.id ?? "") !== videoId) return { ok: false, kode: detail?.statusCode === 10222 ? "privat" : "tidak_ditemukan" };
  const author = (item.author ?? {}) as Record<string, unknown>;
  const video = (item.video ?? {}) as Record<string, unknown>;
  const imagePost = item.imagePost as { cover?: { imageURL?: { urlList?: unknown[] } } } | undefined;
  const cover = typeof video.cover === "string" ? video.cover : (imagePost?.cover?.imageURL?.urlList?.[0] as string | undefined);
  const title = text(item.desc, 400);
  if (!title) return { ok: false, kode: imagePost ? "jenis_konten" : "format" };
  return { ok: true, title, author: text(author.nickname, 80) || text(author.uniqueId, 80) || null, handle: text(author.uniqueId, 40) || null, thumbnailUrl: safeHttps(cover, (h) => THUMB_HOSTS.test(h)), foto: Boolean(imagePost) };
}

async function tiktokFromPage(videoId: string, handle: string | null, foto: boolean, deps: LinkDeps, trace: LinkTrace[], deadline: number): Promise<{ ok: true; info: OembedInfo } | { ok: false; status: number | null; kode: LinkFailure["kode"] }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clock = deps.clock ?? Date.now;
  const pageUrl = canonicalTiktok(videoId, handle, foto);
  const t0 = clock();
  try {
    const res = await guardedFetch(pageUrl, fetchImpl, { accept: "text/html", timeoutMs: Math.max(1500, Math.min(6000, deadline - t0)) });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      trace.push({ tahap: "halaman", status: res.status, ms: clock() - t0 });
      return { ok: false, status: res.status, kode: res.status === 404 ? "tidak_ditemukan" : "ditolak" };
    }
    const html = await readCapped(res, PAGE_MAX_BYTES, (t) => {
      const i = t.indexOf('id="__UNIVERSAL_DATA_FOR_REHYDRATION__"');
      return i >= 0 && t.indexOf("</script>", i) > 0;
    });
    const p = parseTiktokPage(html, videoId);
    trace.push({ tahap: "halaman", status: res.status, ms: clock() - t0, catatan: p.ok ? `caption ${p.title.length} huruf` : /_wafchallengeid|SlardarWAF/.test(html) ? "tantangan bot TikTok" : p.kode });
    if (!p.ok) return { ok: false, status: res.status, kode: p.kode };
    return { ok: true, info: { platform: "tiktok", url: canonicalTiktok(videoId, p.handle ?? handle, p.foto), title: p.title, author: p.author, authorUrl: p.handle ? `https://www.tiktok.com/@${p.handle}` : null, thumbnailUrl: p.thumbnailUrl } };
  } catch (e) {
    trace.push({ tahap: "halaman", status: null, ms: clock() - t0, catatan: e instanceof Error ? e.message.slice(0, 40) : "galat" });
    return { ok: false, status: null, kode: "jaringan" };
  }
}

// Ambil judul atau caption, kreator, dan sampul untuk link TikTok atau YouTube. Sampul hanya disimpan sebagai URL untuk
// ditampilkan langsung dari server TikTok atau YouTube (tidak diunduh dan tidak di-hosting ulang).
export async function ambilInfoVideo(link: TiktokLink | YoutubeLink, deps: LinkDeps = {}): Promise<VideoInfoResult> {
  const clock = deps.clock ?? Date.now;
  const deadline = clock() + (deps.budgetMs ?? LINK_BUDGET_MS);
  const jejak: LinkTrace[] = [];
  if (link.kind === "youtube") {
    const r = await oembedWithRetry("youtube", link.url, deps, jejak, deadline);
    return r.ok ? { ok: true, info: r.info, sumber: "oembed", jejak } : { ok: false, gagal: { tahap: "oembed", status: r.status, kode: r.kode }, jejak };
  }
  let videoId = link.videoId;
  let handle = videoId ? (/\/@([\w.]+)\//.exec(link.url)?.[1] ?? null) : null;
  let foto = Boolean(link.foto);
  if (!videoId) {
    const s = await resolveTiktokShort(link.url, deps, jejak);
    if (!s.ok) return { ok: false, gagal: s.gagal, jejak };
    ({ videoId, handle, foto } = s);
  }
  if (handle === "_") handle = null;
  const canonical = canonicalTiktok(videoId, handle, foto);
  const o = await oembedWithRetry("tiktok", canonical, deps, jejak, deadline);
  if (o.ok) return { ok: true, info: o.info, sumber: "oembed", jejak };
  // oEmbed tidak bisa (ditolak berulang, atau postingan foto yang tidak didukung): baca caption dari halaman video.
  if (o.kode === "privat") return { ok: false, gagal: { tahap: "oembed", status: o.status, kode: "privat" }, jejak };
  const p = await tiktokFromPage(videoId, handle, foto, deps, jejak, deadline + 4000);
  if (p.ok) return { ok: true, info: p.info, sumber: "halaman", jejak };
  return { ok: false, gagal: { tahap: "halaman", status: p.status, kode: p.kode === "format" && o.kode !== "jaringan" ? o.kode : p.kode }, jejak };
}

// Bentuk lama (dipakai uji dan skrip): melempar galat bila gagal.
export async function fetchOembed(link: TiktokLink | YoutubeLink, fetchImpl: FetchLike = fetch): Promise<OembedInfo> {
  const r = await ambilInfoVideo(link, { fetchImpl, sleep: async () => {} });
  if (!r.ok) throw new Error(r.gagal.tahap === "tautan_pendek" ? "Tautan pendek TikTok tidak bisa dibuka" : `oEmbed ${r.gagal.status ?? r.gagal.kode}`);
  return r.info;
}

// Ringkasan kegagalan untuk ai_logs (tanpa URL atau isi apa pun dari pembeli).
export const ringkasGagal = (g: LinkFailure, jejak: LinkTrace[]) => `tahap=${g.tahap} status=${g.status ?? "-"} kode=${g.kode} percobaan=${jejak.filter((j) => j.tahap === "oembed").length}`;

// Pesan untuk pembeli per jenis kegagalan; semuanya menawarkan screenshot sebagai jalan lain.
export function pesanGagalLink(g: LinkFailure): string {
  if (g.kode === "privat") return "Videonya sepertinya privat atau butuh masuk akun, jadi belum bisa kami buka. Kirim screenshot produknya saja, ya.";
  if (g.kode === "tidak_ditemukan") return "Videonya tidak ditemukan, mungkin sudah dihapus. Kirim screenshot produknya saja, ya.";
  if (g.kode === "jenis_konten") return "Postingan foto ini belum bisa kami baca. Kirim screenshot produknya saja, ya.";
  return "TikTok sedang menolak permintaan kami, jadi videonya belum bisa dibaca. Kirim screenshot produknya saja, hasilnya sama bagusnya.";
}

// oEmbed tiruan untuk AI_PROVIDER=mock (uji, Playwright, cuplik): tanpa internet, data contoh tetap. Tautan pendek
// tiruan vt.tiktok.com/ZSdemo0001 diarahkan ke video tiruan pertama.
export const MOCK_OEMBED: Record<string, { title: string; author_name: string; author_url: string }> = {
  "7300000000000000001": { title: "Dupe lipstik Wardah warna nude satin buat kondangan, lembap seharian! #lipstik #kondangan", author_name: "Demo Kreator", author_url: "https://www.tiktok.com/@demo.kreator" },
  "7300000000000000002": { title: "Cushion favorit buat kulit berminyak, hasilnya matte natural #cushion", author_name: "Demo Kreator", author_url: "https://www.tiktok.com/@demo.kreator" },
};

export const mockOembedFetch: FetchLike = async (url) => {
  const u = new URL(url);
  if (u.hostname === "vt.tiktok.com") return new Response(null, { status: 301, headers: { location: `https://www.tiktok.com/@demo.kreator/video/${u.pathname.includes("0002") ? "7300000000000000002" : "7300000000000000001"}?_r=1` } });
  const target = u.searchParams.get("url") ?? "";
  const id = /\/video\/(\d+)/.exec(target)?.[1] ?? /[?&]v=([\w-]+)/.exec(target)?.[1] ?? "";
  const hit = MOCK_OEMBED[id];
  if (!hit) return new Response("{}", { status: 404 });
  return new Response(JSON.stringify({ ...hit, thumbnail_url: null }), { status: 200, headers: { "content-type": "application/json" } });
};
