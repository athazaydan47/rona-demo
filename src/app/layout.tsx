import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";
import { getCategoryTree, getLocations, getPromoMessages } from "@/lib/catalog/queries";
import { DemoRibbon } from "@/components/layout/demo-ribbon";
import { PromoBar } from "@/components/layout/promo-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileMenuProvider, MobileMenuSheet } from "@/components/layout/mobile-menu";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rona Beauty, toko kosmetik demo",
    template: "%s | Rona Beauty",
  },
  description:
    "Toko kosmetik demo multi-merek dengan data fiktif: shade yang pas, stok per cabang, dan rekomendasi dari katalog sendiri.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, locations, promoMessages] = await Promise.all([
    getCategoryTree(),
    getLocations(),
    getPromoMessages(),
  ]);
  return (
    <html lang="id" className={`${fraunces.variable} ${jakarta.variable} h-full`}>
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
          <MobileMenuSheet categories={categories} />
        </MobileMenuProvider>
      </body>
    </html>
  );
}
