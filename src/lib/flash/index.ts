// Logika slot flash sale: murni, tanpa database.
export type FlashSlot = { id: number; name: string; startsAt: Date; endsAt: Date };

export type FlashPick<T extends FlashSlot> = { active: T | null; next: T | null };

// Slot yang sedang berjalan (bila ada) dan slot berikutnya yang belum mulai.
export function pickFlashSlot<T extends FlashSlot>(slots: T[], now: Date): FlashPick<T> {
  const t = now.getTime();
  const sorted = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const active = sorted.find((s) => s.startsAt.getTime() <= t && s.endsAt.getTime() > t) ?? null;
  const next = sorted.find((s) => s.startsAt.getTime() > t) ?? null;
  return { active, next };
}

export function quotaLeft(item: { quota: number; sold: number }) {
  return Math.max(0, item.quota - item.sold);
}

// Persen kuota terpakai, 0 sampai 100.
export function quotaUsedPercent(item: { quota: number; sold: number }) {
  if (item.quota <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((item.sold / item.quota) * 100)));
}

export type Countdown = { total: number; hours: number; minutes: number; seconds: number };

export function countdownTo(target: Date, now: Date): Countdown {
  const total = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(total / 1000);
  return { total, hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export const pad2 = (n: number) => n.toString().padStart(2, "0");
