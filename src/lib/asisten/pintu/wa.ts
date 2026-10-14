// Pintu WhatsApp untuk Asisten Admin (disiapkan, belum disambung ke penyedia WA). Pintu ini hanya menerjemahkan pesan
// masuk dari nomor staf yang terdaftar menjadi panggilan otak yang sama (runAssistant) dan jawabannya menjadi teks WA.
// Aturan: hanya membalas pesan masuk satu per satu, tidak pernah mengirim pesan seragam massal, dan kegagalan kirim
// tidak memblokir alur lain (pelajaran nomor WA Pawon Ayu yang kena ban).
import type { StaffPrincipal } from "@/lib/admin/permissions";
import type { AiModel } from "@/lib/ai/client";
import type { AnyDb } from "@/lib/db-types";
import { runAssistant, type AsistenAnswer, type AsistenTurn } from "../otak";

export type WaIncoming = { from: string; text: string; receivedAt: Date };
export type WaOutgoing = { to: string; text: string };

// Pemetaan nomor WA ke akun staf dilakukan oleh penyedia (belum ada); fungsi ini menerima staf yang sudah dikenali.
export async function handleWaMessage(deps: { db: AnyDb; model: AiModel; staff: StaffPrincipal }, msg: WaIncoming, history: AsistenTurn[] = []): Promise<WaOutgoing> {
  const answer = await runAssistant({ ...deps, now: msg.receivedAt, door: "wa" }, [...history, { role: "user", text: msg.text }]);
  return { to: msg.from, text: toWaText(answer) };
}

// Jawaban asisten menjadi teks WA: teks, tabel sebagai baris, dan tautan sebagai alamat lengkap.
export function toWaText(a: AsistenAnswer, site = "") {
  const lines = [a.teks];
  if (a.tabel) {
    lines.push("", a.tabel.kolom.join(" | "));
    for (const r of a.tabel.baris) lines.push(r.join(" | "));
  }
  if (a.tautan.length) lines.push("", ...a.tautan.map((t) => `${t.label}: ${site}${t.href}`));
  if (a.peringatan) lines.push("", `Catatan: ${a.peringatan}`);
  return lines.join("\n").trim();
}
