"use server";

// Sejak Fase 5 "Kabari aku" wajib masuk: identitas dan nomor diambil dari sesi, bukan dari isian.
import { requestRestockAction } from "@/lib/account/actions";
import { cocok, skema } from "@/lib/validasi";

export type RestockResult = { ok: true; duplicate: boolean } | { ok: false; message: string; needLogin?: boolean };

export async function requestRestock(raw: { variantId: number }): Promise<RestockResult> {
  const input = cocok(skema.varian, raw);
  if (!input) return { ok: false, message: "Data tidak valid." };
  return requestRestockAction(input.variantId);
}
