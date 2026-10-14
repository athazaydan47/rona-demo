import { BarChart3, ClipboardList, Newspaper, FolderTree, LayoutDashboard, Mail, MessageSquareText, Package, ScrollText, Settings, ShieldCheck, Tag, Users, Warehouse } from "lucide-react";
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
  kabar: Newspaper,
  pengaturan: Settings,
  notifikasi: Mail,
  staf: ShieldCheck,
  log: ScrollText,
};
