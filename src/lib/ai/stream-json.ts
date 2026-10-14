// Membaca kolom string dari JSON yang masih mengalir (structured output Gemini dialirkan sebagai potongan JSON).
// Dipakai Advisor untuk mengirim kalimat pembuka ke pembeli sebelum JSON selesai. Murni dan teruji.

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };

// Nilai string kolom `field` sejauh yang sudah tiba. complete = tanda kutip penutup sudah tiba.
export function partialStringField(raw: string, field: string): { value: string; complete: boolean } | null {
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(raw);
  if (!m) return null;
  let out = "";
  let i = m.index + m[0].length;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"') return { value: out, complete: true };
    if (c === "\\") {
      if (i + 1 >= raw.length) break;
      const n = raw[i + 1];
      if (n === "u") {
        if (i + 6 > raw.length) break;
        out += String.fromCharCode(Number.parseInt(raw.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      out += ESCAPES[n] ?? n;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return { value: out, complete: false };
}

// Aliran per kalimat: setiap kalimat utuh diperiksa dulu (check), lalu dikirim lewat emit bila lolos. Kalimat yang
// tidak lolos tidak pernah tampil di layar pembeli.
export function createSentenceStream(field: string, check: (sentence: string) => boolean, emit: (text: string) => void) {
  let raw = "";
  let consumed = 0;
  let sent = 0;
  const flush = (value: string, complete: boolean) => {
    for (;;) {
      const pending = value.slice(consumed);
      const m = /[.!?](?=\s)/.exec(pending);
      const end = m ? m.index + 1 : complete && pending.trim() ? pending.length : -1;
      if (end < 0) return;
      const sentence = pending.slice(0, end).trim();
      consumed += end;
      if (sentence && check(sentence)) {
        emit(sent ? ` ${sentence}` : sentence);
        sent += 1;
      }
    }
  };
  return {
    push(delta: string) {
      raw += delta;
      const f = partialStringField(raw, field);
      if (f) flush(f.value, f.complete);
    },
    get raw() {
      return raw;
    },
    get sentCount() {
      return sent;
    },
  };
}
