import { BarChart3, ClipboardList, FolderTree, LayoutDashboard, MessageSquareText, Package, ScrollText, Settings, ShieldCheck, Tag, Users, Warehouse } from "lucide-react";
import type { NavKey } from "@/lib/admin/nav";

export const NAV_ICONS: Record<NavKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  pesanan: ClipboardList,
  stok: Warehouse,
  produk: Package,
  kategori: FolderTree,
  promo: Tag,
  ulasan: MessageSquareText,
  pelanggan: Users,
  laporan: BarChart3,
  pengaturan: Settings,
  staf: ShieldCheck,
  log: ScrollText,
};
