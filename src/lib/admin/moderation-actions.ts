"use server";

// Server action Fase 6C: moderasi ulasan, penyesuaian poin pelanggan, dan kirim ulang notifikasi.
// Identitas staf hanya dari sesi; izin diperiksa dengan can() di modul layanan.
import { db } from "@/db/client";
import { cacheTags, updateCatalogNow } from "@/lib/cache-tags";
import { now } from "@/lib/clock";
import { scheduleEmailDispatch } from "@/lib/email/schedule";
import { siteUrl } from "@/lib/site";
import { currentStaff } from "./current";
import { adjustPoints } from "./customers";
import { resendNotification } from "./outbox";
import { deleteReply, hideReviews, replyReview, showReview } from "./reviews";

const DENIED = { ok: false as const, message: "Sesi staf berakhir. Masuk lagi, ya." };
const productTagsFor = (slugs: string[]) => [cacheTags.products(), ...slugs.map(cacheTags.product)];

export async function hideReviewsAction(ids: number[], reason: string) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await hideReviews(db, me, Array.isArray(ids) ? ids.map(Number) : [], String(reason ?? ""), { now: now() });
  if (r.ok && r.slugs.length) updateCatalogNow(productTagsFor(r.slugs));
  return r;
}

export async function showReviewAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await showReview(db, me, Number(id), { now: now() });
  if (r.ok && r.slugs.length) updateCatalogNow(productTagsFor(r.slugs));
  return r;
}

export async function replyReviewAction(id: number, text: string, opts: { aiAssisted?: boolean } = {}) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await replyReview(db, me, Number(id), String(text ?? ""), { now: now(), aiAssisted: opts.aiAssisted === true });
  if (r.ok) {
    updateCatalogNow(productTagsFor(r.slugs));
    if (r.notified) scheduleEmailDispatch();
  }
  return r;
}

export async function deleteReplyAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  const r = await deleteReply(db, me, Number(id), { now: now() });
  if (r.ok && r.slugs.length) updateCatalogNow(productTagsFor(r.slugs));
  return r;
}


export async function adjustPointsAction(customerId: number, amount: number, reason: string) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return adjustPoints(db, me, Number(customerId), Number(amount), String(reason ?? ""), { now: now() });
}

export async function resendNotificationAction(id: number) {
  const me = await currentStaff();
  if (!me) return DENIED;
  return resendNotification(db, me, Number(id), { site: siteUrl(), now: now() });
}
