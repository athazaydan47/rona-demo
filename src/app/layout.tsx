import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { env } from "@/lib/env";
import { getCategoryTree, getLocations, getPromoMessages } from "@/lib/catalog/queries";
import { DemoRibbon } from "@/components/layout/demo-ribbon";
import { DemoGuide } from "@/components/demo/demo-guide";
import { PromoBar } from "@/components/layout/promo-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AdvisorLauncher } from "@/components/ai/advisor";
import { MobileMenuProvider, MobileMenuSheet } from "@/components/layout/mobile-menu";
import { Toaster } from "@/components/ui/toast";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { fontJudul, fontTeks } from "@/config/font";
import { MEREK, temaCss } from "@/config/merek";

export const metadata: Metadata = {
  title: {
    default: `${MEREK.namaLengkap}, toko kosmetik demo`,
    template: `%s | ${MEREK.namaLengkap}`,
  },
  description: MEREK.deskripsi,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, locations, promoMessages] = await Promise.all([
    getCategoryTree(),
    getLocations(),
    getPromoMessages(),
  ]);
  return (
    <html lang="id" className={`${fontJudul.variable} ${fontTeks.variable} h-full`}>
      <head>
        {/* Palet dari src/config/merek.ts menimpa token warna bawaan di globals.css. */}
        <style>{temaCss()}</style>
      </head>
      <body className="flex min-h-full flex-col">
        <MobileMenuProvider>
          {env.demoMode ? <DemoRibbon /> : null}
          <PromoBar messages={promoMessages} />
          <Header categories={categories} />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <Footer
            categories={categories}
            locations={locations}
            studio={{ name: env.studioName, url: env.studioUrl }}
            demoMode={env.demoMode}
          />
          <BottomNav />
          {/* Memakai usePathname, jadi dibungkus Suspense supaya kerangka statis tetap terprarender. */}
          <Suspense fallback={null}>
            <AdvisorLauncher />
          </Suspense>
          <MobileMenuSheet categories={categories} />
          {/* usePathname di dalam laci butuh Suspense pada rute dinamis. */}
          <Suspense fallback={null}>
            <CartDrawer />
          </Suspense>
          <Toaster />
          {/* Panduan demo membaca pathname dan query, jadi dibungkus Suspense. */}
          {env.demoMode ? (
            <Suspense fallback={null}>
              <DemoGuide />
            </Suspense>
          ) : null}
        </MobileMenuProvider>
      </body>
    </html>
  );
}
