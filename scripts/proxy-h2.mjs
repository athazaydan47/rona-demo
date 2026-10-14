// Proksi HTTP/2 + TLS lokal (Fase 8B) untuk mengukur Lighthouse seperti di Vercel: next start lokal hanya HTTP/1.1
// (6 koneksi per asal), sedangkan produksi Vercel memakai HTTP/2 dan HTTP/3 yang memultipleks semua berkas JS.
//   node scripts/proxy-h2.mjs <sertifikat.pem> <kunci.pem> [port 3443] [target http://localhost:3211]
import http2 from "node:http2";
import http from "node:http";
import { readFileSync } from "node:fs";

const [cert, key, port = "3443", target = "http://localhost:3211"] = process.argv.slice(2);
const t = new URL(target);
const server = http2.createSecureServer({ cert: readFileSync(cert), key: readFileSync(key), allowHTTP1: true });
server.on("request", (req, res) => {
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) if (h.startsWith(":")) delete headers[h];
  headers.host = `${t.hostname}:${t.port}`;
  headers["x-forwarded-proto"] = "https";
  const up = http.request({ host: t.hostname, port: t.port, method: req.method, path: req.url, headers }, (r) => {
    const out = { ...r.headers };
    for (const h of ["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection"]) delete out[h];
    res.writeHead(r.statusCode ?? 502, out);
    r.pipe(res);
  });
  up.on("error", () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(up);
});
server.listen(Number(port), () => console.log(`Proksi HTTP/2 https://localhost:${port} -> ${target}`));
