// Banner beranda yang tayang pada waktu tertentu (murni): aktif, dalam jadwal, urut sortOrder.
export function liveBanners<T extends { isActive: boolean; startsAt: Date | null; endsAt: Date | null; sortOrder: number; id: number }>(rows: T[], now: Date) {
  return rows.filter((b) => b.isActive && (!b.startsAt || b.startsAt.getTime() <= now.getTime()) && (!b.endsAt || b.endsAt.getTime() > now.getTime())).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
