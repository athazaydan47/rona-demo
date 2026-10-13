"use server";

// Sejak Fase 5 "Kabari aku" wajib masuk: identitas dan nomor diambil dari sesi, bukan dari isian.
import { requestRestockAction } from "@/lib/account/actions";

export type RestockResult = { ok: true; duplicate: boolean } | { ok: false; message: string; needLogin?: boolean };

export async function requestRestock(input: { variantId: number }): Promise<RestockResult> {
  return requestRestockAction(Number(input?.variantId));
}
