// Jam terpusat. Semua logika kedaluwarsa, cut-off, dan slot flash sale memakai now(), bukan new Date() langsung.
// Uji bisa membekukan jam dengan setClock(); Playwright bisa memajukan jam server lewat offset (lihat /api/demo/jam).

type ClockState = { fixed: number | null; offsetMs: number };

declare global {
  var __ronaClock: ClockState | undefined;
}

// Disimpan di globalThis supaya semua bundel route di proses yang sama berbagi satu jam.
function state(): ClockState {
  if (!globalThis.__ronaClock) globalThis.__ronaClock = { fixed: null, offsetMs: 0 };
  return globalThis.__ronaClock;
}

export function now(): Date {
  const s = state();
  return new Date((s.fixed ?? Date.now()) + s.offsetMs);
}

// Untuk uji: bekukan jam pada waktu tertentu (null untuk kembali ke jam sistem).
export function setClock(at: Date | null) {
  state().fixed = at ? at.getTime() : null;
}

// Untuk uji dan demo E2E: geser jam sejumlah milidetik dari jam sistem.
export function setClockOffset(ms: number) {
  state().offsetMs = Math.trunc(ms);
}

export function clockOffset() {
  return state().offsetMs;
}

export function resetClock() {
  const s = state();
  s.fixed = null;
  s.offsetMs = 0;
}

export function minutesFromNow(minutes: number, from: Date = now()) {
  return new Date(from.getTime() + minutes * 60_000);
}
