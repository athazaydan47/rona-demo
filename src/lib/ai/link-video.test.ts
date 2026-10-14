// Fase 8C: membaca link video sungguhan. Setiap tahap yang ditemukan saat diagnosis link TikTok asli diuji dengan
// respons tiruan: tautan pendek (HEAD ditolak, redirect berlapis, 404, login, host asing), oEmbed yang menolak acak
// (503 "overload-protect", 429), cadangan halaman video (caption dari JSON halaman, postingan foto, tantangan bot),
// dan deteksi link di tengah kalimat.
import { describe, expect, it } from "vitest";
import { ambilInfoVideo, classifyLink, FETCH_HOSTS, findLinkInText, parseTiktokPage, pesanGagalLink, resolveTiktokShort, ringkasGagal, type FetchLike, type LinkTrace } from "./oembed";

const ID = "7576261390181092616";
const noSleep = async () => {};
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const overload = () => new Response("overload-protect triggered", { status: 503 });
const pageHtml = (item: Record<string, unknown>, statusCode = 0) =>
  `<!DOCTYPE html><html><head><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.video-detail": { statusCode, itemInfo: { itemStruct: item } } } })}</script></head><body></body></html>`;
const WAF = '<!DOCTYPE html><html><head><script id="slardar-config" type="application/json">{"slardarClient":"SlardarWAF"}</script></head><body>Please wait... <p id="wci" class="_wafchallengeid"></p></body></html>';

// Fetch tiruan berbasis aturan; mencatat setiap URL dan metode yang dihubungi.
function tiruan(rules: ((url: URL, method: string) => Response | null)[]) {
  const calls: { url: string; method: string }[] = [];
  const f: FetchLike = async (url, init) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ url, method });
    for (const r of rules) {
      const res = r(u, method);
      if (res) return res;
    }
    return new Response("tidak ada aturan", { status: 500 });
  };
  return { f, calls };
}
const oembedOk = (u: URL) => (u.pathname === "/oembed" ? json({ title: "Review cushion untuk kulit berminyak #cushion", author_name: "kreator", author_url: "https://www.tiktok.com/@kreator", thumbnail_url: "https://p16-sign.tiktokcdn.com/a.jpeg" }) : null);

describe("klasifikasi dan deteksi link", () => {
  it("bentuk link TikTok yang dipakai pembeli", () => {
    expect(classifyLink("https://vt.tiktok.com/ZSgewBdCV/")).toEqual({ kind: "tiktok", url: "https://vt.tiktok.com/ZSgewBdCV/", short: true, videoId: null });
    expect(classifyLink("vm.tiktok.com/ZMabc123")).toMatchObject({ kind: "tiktok", short: true, url: "https://vm.tiktok.com/ZMabc123/" });
    expect(classifyLink("https://www.tiktok.com/t/ZTabc123/")).toMatchObject({ kind: "tiktok", short: true, url: "https://www.tiktok.com/t/ZTabc123/" });
    expect(classifyLink(`https://www.tiktok.com/@lukas.skin/video/${ID}?_r=1&_t=ZS-9AYa&is_from_webapp=1`)).toEqual({ kind: "tiktok", url: `https://www.tiktok.com/@lukas.skin/video/${ID}`, short: false, videoId: ID });
    expect(classifyLink(`https://m.tiktok.com/v/${ID}.html`)).toMatchObject({ kind: "tiktok", short: false, videoId: ID, url: `https://www.tiktok.com/@_/video/${ID}` });
    expect(classifyLink(`https://www.tiktok.com/@a/photo/${ID}`)).toMatchObject({ kind: "tiktok", foto: true, videoId: ID });
    expect(classifyLink("https://www.tiktok.com/@akun")).toEqual({ kind: "tidak_valid" });
  });

  it("link di tengah kalimat, link lain, dan teks tanpa link", () => {
    expect(findLinkInText("ini dong yang mirip https://vt.tiktok.com/ZSgewBdCV/ ada ga?")).toMatchObject({ raw: "https://vt.tiktok.com/ZSgewBdCV/", link: { kind: "tiktok", short: true } });
    expect(findLinkInText(`cek www.tiktok.com/@a/video/${ID}, warnanya cakep`)?.link).toMatchObject({ kind: "tiktok", videoId: ID });
    expect(findLinkInText("liat youtube.com/shorts/zuoAuMkPOSY.")?.link).toMatchObject({ kind: "youtube", videoId: "zuoAuMkPOSY" });
    expect(findLinkInText("https://www.instagram.com/reel/Cabc/ yang ini")?.link).toEqual({ kind: "lainnya", host: "www.instagram.com" });
    expect(findLinkInText("shopee.co.id/produk-123 murah")?.link).toMatchObject({ kind: "lainnya", host: "shopee.co.id" });
    expect(findLinkInText("cushion buat kulit berminyak s.d. 150 ribu")).toBeNull();
    expect(findLinkInText("http://127.0.0.1/admin dan http://localhost:3000")).toBeNull();
  });
});

describe("tahap tautan pendek", () => {
  it("HEAD ditolak, lalu GET memberi redirect ke video", async () => {
    const { f, calls } = tiruan([(u, m) => (u.hostname === "vt.tiktok.com" ? (m === "HEAD" ? new Response(null, { status: 405 }) : redirect(`https://www.tiktok.com/@kreator/video/${ID}?_r=1`)) : null)]);
    const trace: LinkTrace[] = [];
    const r = await resolveTiktokShort("https://vt.tiktok.com/ZSgewBdCV/", { fetchImpl: f }, trace);
    expect(r).toEqual({ ok: true, videoId: ID, handle: "kreator", foto: false });
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
    expect(trace[0]).toMatchObject({ tahap: "tautan_pendek", status: 301, catatan: "GET redirect" });
  });

  it("redirect berlapis tetap di host yang diizinkan", async () => {
    const { f } = tiruan([(u) => (u.hostname === "vm.tiktok.com" ? redirect("https://www.tiktok.com/t/ZTxyz123/") : null), (u) => (u.pathname.startsWith("/t/") ? redirect(`/@b/video/${ID}?is_copy_url=1`, 302) : null)]);
    expect(await resolveTiktokShort("https://vm.tiktok.com/ZMabc123/", { fetchImpl: f }, [])).toMatchObject({ ok: true, videoId: ID, handle: "b" });
  });

  it("video dihapus, butuh masuk, host asing, dan redirect tanpa akhir ditolak", async () => {
    const to = (loc: string) => tiruan([(u) => (u.hostname === "vt.tiktok.com" ? redirect(loc) : null)]).f;
    expect(await resolveTiktokShort("https://vt.tiktok.com/ZSa12345/", { fetchImpl: to("https://www.tiktok.com/404?fromUrl=/x") }, [])).toMatchObject({ ok: false, gagal: { kode: "tidak_ditemukan" } });
    expect(await resolveTiktokShort("https://vt.tiktok.com/ZSa12345/", { fetchImpl: to("https://www.tiktok.com/login?redirect=x") }, [])).toMatchObject({ ok: false, gagal: { kode: "privat" } });
    const evil = tiruan([(u) => (u.hostname === "vt.tiktok.com" ? redirect("http://169.254.169.254/latest") : null)]);
    expect(await resolveTiktokShort("https://vt.tiktok.com/ZSa12345/", { fetchImpl: evil.f }, [])).toMatchObject({ ok: false, gagal: { kode: "ditolak" } });
    expect(evil.calls.every((c) => (FETCH_HOSTS as readonly string[]).includes(new URL(c.url).hostname))).toBe(true);
    const loop = tiruan([(u) => (u.hostname === "vt.tiktok.com" ? redirect("https://vm.tiktok.com/ZMloop123/") : redirect("https://vt.tiktok.com/ZSloop123/"))]);
    expect(await resolveTiktokShort("https://vt.tiktok.com/ZSloop123/", { fetchImpl: loop.f }, [])).toMatchObject({ ok: false, gagal: { kode: "ditolak" } });
    expect(loop.calls.filter((c) => c.method === "HEAD").length).toBeLessThanOrEqual(5);
  });
});

describe("tahap oEmbed dan cadangan halaman", () => {
  it("503 overload-protect dua kali lalu berhasil (akar masalah link asli)", async () => {
    let n = 0;
    const { f, calls } = tiruan([(u) => (u.pathname === "/oembed" ? (++n <= 2 ? overload() : null) : null), oembedOk]);
    const r = await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@kreator/video/${ID}`, short: false, videoId: ID }, { fetchImpl: f, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, sumber: "oembed", info: { title: "Review cushion untuk kulit berminyak #cushion", thumbnailUrl: "https://p16-sign.tiktokcdn.com/a.jpeg" } });
    expect(r.jejak.map((j) => j.status)).toEqual([503, 503, 200]);
    // URL kanonis tanpa parameter pelacak dikirim ke endpoint resmi.
    expect(new URL(calls[0].url).searchParams.get("url")).toBe(`https://www.tiktok.com/@kreator/video/${ID}`);
  });

  it("oEmbed menolak terus: caption dibaca dari halaman video kanonis", async () => {
    const { f, calls } = tiruan([(u) => (u.pathname === "/oembed" ? new Response("", { status: 429 }) : null), (u) => (u.pathname === `/@kreator/video/${ID}` ? new Response(pageHtml({ id: ID, desc: "Lip tint nude favorit #liptint", author: { uniqueId: "kreator", nickname: "Kreator" }, video: { cover: "https://p16.tiktokcdn.com/c.jpeg" } })) : null)]);
    const r = await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@kreator/video/${ID}`, short: false, videoId: ID }, { fetchImpl: f, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, sumber: "halaman", info: { title: "Lip tint nude favorit #liptint", author: "Kreator", authorUrl: "https://www.tiktok.com/@kreator" } });
    expect(calls.filter((c) => new URL(c.url).pathname === "/oembed").length).toBe(6);
  });

  it("postingan foto: oEmbed tidak mendukung, caption dari halaman; foto tanpa caption memberi pesan khusus", async () => {
    const withDesc = tiruan([(u) => (u.pathname === "/oembed" ? new Response("{}", { status: 400 }) : null), () => new Response(pageHtml({ id: ID, desc: "Swatch 5 shade cushion", author: { uniqueId: "a" }, imagePost: { cover: { imageURL: { urlList: ["https://p16.tiktokcdn.com/i.jpeg"] } } } }))]);
    expect(await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@a/photo/${ID}`, short: false, videoId: ID, foto: true }, { fetchImpl: withDesc.f, sleep: noSleep })).toMatchObject({ ok: true, sumber: "halaman", info: { title: "Swatch 5 shade cushion" } });
    expect(withDesc.calls.filter((c) => new URL(c.url).pathname === "/oembed").length).toBe(1);
    const noDesc = tiruan([(u) => (u.pathname === "/oembed" ? new Response("{}", { status: 400 }) : null), () => new Response(pageHtml({ id: ID, desc: "", imagePost: {} }))]);
    const r = await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@a/photo/${ID}`, short: false, videoId: ID, foto: true }, { fetchImpl: noDesc.f, sleep: noSleep });
    expect(r).toMatchObject({ ok: false, gagal: { tahap: "halaman", kode: "jenis_konten" } });
    if (!r.ok) expect(pesanGagalLink(r.gagal)).toMatch(/screenshot/);
  });

  it("tantangan bot di halaman dan video privat menjadi kegagalan yang jelas, dengan ringkasan tanpa URL", async () => {
    const waf = tiruan([(u) => (u.pathname === "/oembed" ? overload() : new Response(WAF))]);
    const r = await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@k/video/${ID}`, short: false, videoId: ID }, { fetchImpl: waf.f, sleep: noSleep });
    expect(r).toMatchObject({ ok: false, gagal: { tahap: "halaman", status: 200, kode: "ditolak" } });
    expect(r.jejak.at(-1)?.catatan).toBe("tantangan bot TikTok");
    if (!r.ok) {
      expect(ringkasGagal(r.gagal, r.jejak)).toBe("tahap=halaman status=200 kode=ditolak percobaan=6");
      expect(ringkasGagal(r.gagal, r.jejak)).not.toMatch(/tiktok\.com|7576/);
    }
    const privat = tiruan([(u) => (u.pathname === "/oembed" ? new Response("", { status: 403 }) : null)]);
    expect(await ambilInfoVideo({ kind: "tiktok", url: `https://www.tiktok.com/@k/video/${ID}`, short: false, videoId: ID }, { fetchImpl: privat.f, sleep: noSleep })).toMatchObject({ ok: false, gagal: { tahap: "oembed", kode: "privat" } });
    expect(privat.calls.length).toBe(1);
  });

  it("alur lengkap dari tautan pendek, dan YouTube Shorts lewat oEmbed YouTube", async () => {
    const { f } = tiruan([(u) => (u.hostname === "vt.tiktok.com" ? redirect(`https://www.tiktok.com/@kreator/video/${ID}?_r=1&_t=x`) : null), oembedOk]);
    const r = await ambilInfoVideo(classifyLink("https://vt.tiktok.com/ZSgewBdCV/") as never, { fetchImpl: f, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, info: { url: `https://www.tiktok.com/@kreator/video/${ID}` } });
    expect(r.jejak.map((j) => j.tahap)).toEqual(["tautan_pendek", "tautan_pendek", "oembed"]);
    const yt = tiruan([(u) => (u.hostname === "www.youtube.com" && u.pathname === "/oembed" ? json({ title: "Lipstick swatch #shorts", author_name: "Kanal", thumbnail_url: "https://i.ytimg.com/vi/x/hq.jpg" }) : null)]);
    expect(await ambilInfoVideo(classifyLink("https://youtube.com/shorts/zuoAuMkPOSY") as never, { fetchImpl: yt.f, sleep: noSleep })).toMatchObject({ ok: true, info: { platform: "youtube", url: "https://www.youtube.com/watch?v=zuoAuMkPOSY" } });
  });

  it("parser halaman hanya memakai item dengan id yang sama", () => {
    expect(parseTiktokPage(pageHtml({ id: "1", desc: "lain" }), ID)).toMatchObject({ ok: false });
    expect(parseTiktokPage(pageHtml({}, 10222), ID)).toEqual({ ok: false, kode: "privat" });
    expect(parseTiktokPage("<html></html>", ID)).toEqual({ ok: false, kode: "format" });
  });
});
