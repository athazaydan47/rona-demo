"use server";

// Buat ulang Kabar Harian hari kemarin dari panel (owner). Tidak mengirim WA ulang.
import { db } from "@/db/client";
import { aiModel } from "@/lib/ai";
import { now } from "@/lib/clock";
import { generateDailyBrief } from "@/lib/kabar";
import { currentStaff } from "./current";
import { can } from "./permissions";

export async function regenerateBriefAction() {
  const me = await currentStaff();
  if (!me) return { ok: false as const, message: "Sesi staf berakhir. Masuk lagi, ya." };
  if (!can(me, "laporan.keuangan")) return { ok: false as const, message: "Kamu tidak punya izin untuk ini." };
  const r = await generateDailyBrief(db, { now: now(), model: aiModel(), overwrite: true });
  return "error" in r ? { ok: false as const, message: "Kabar belum bisa dibuat ulang. Coba lagi sebentar." } : { ok: true as const, source: r.source };
}
