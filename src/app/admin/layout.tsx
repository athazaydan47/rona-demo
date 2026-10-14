import type { Metadata } from "next";
import { MEREK } from "@/config/merek";

// Semua halaman admin: noindex dan tidak di-cache (data dibaca per request di dalam Suspense, sesi staf wajib).
export const metadata: Metadata = {
  title: { template: `%s · Admin ${MEREK.nama}`, default: `Admin ${MEREK.nama}` },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin-root className="min-h-dvh bg-porselen text-kopi">
      {children}
    </div>
  );
}
