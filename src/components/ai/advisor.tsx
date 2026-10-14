"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiStatus } from "./ai-status";
import { useFloatingPosition, useHideOnScroll } from "./floating-position";
import { MEREK, namaEvent } from "@/config/merek";

// Panel percakapan dimuat saat pertama dibuka (Fase 8B).
const muatPanel = () => void import("./advisor-panel");
const AdvisorPanel = dynamic(() => import("./advisor-panel").then((m) => m.AdvisorPanel), { ssr: false });

export const ADVISOR_OPEN_EVENT = namaEvent("advisor-open");
// kirim: prompt langsung dikirim (contoh kalimat di panduan demo dan halaman Tentang demo).
export type AdvisorOpenDetail = { productId?: number; productName?: string; prompt?: string; kirim?: boolean };
export function openAdvisor(detail: AdvisorOpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<AdvisorOpenDetail>(ADVISOR_OPEN_EVENT, { detail }));
}

const HIDDEN_PREFIXES = ["/checkout", "/bayar", "/admin"];

export function AdvisorLauncher() {
  const pathname = usePathname();
  const status = useAiStatus();
  const available = status.tersedia;
  const resting = status.istirahat ? (status.pesanIstirahat ?? "Sedang istirahat, coba lagi besok.") : null;
  const hasProfile = status.profil;
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<AdvisorOpenDetail>({});
  const [bukaKe, setBukaKe] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hidden = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));
  const pos = useFloatingPosition(buttonRef, available && !hidden, { mobile: 16, desktop: 24 });
  const scrolledAway = useHideOnScroll(available && !hidden && !open);
  const away = Boolean(pos?.covered || scrolledAway);

  const buka = (d: AdvisorOpenDetail) => {
    setContext(d);
    setBukaKe((n) => n + 1);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = (e: Event) => buka((e as CustomEvent<AdvisorOpenDetail>).detail ?? {});
    window.addEventListener(ADVISOR_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ADVISOR_OPEN_EVENT, onOpen);
  }, []);

  if (!available) return null;

  return (
    <>
      {!hidden ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => buka({})}
          // Muat kode panel lebih awal saat kursor mendekat atau tombol difokus.
          onPointerEnter={muatPanel}
          onFocus={muatPanel}
          // Posisi dihitung useFloatingPosition: selalu di atas bilah bawah yang menempel, dan disembunyikan sementara
          // bila akan menutupi tombol aksi utama.
          style={{ bottom: pos ? pos.bottom : undefined }}
          // Di HP berupa tombol bulat ikon saja (48 px) supaya tidak menutupi kartu; label teks hanya di desktop.
          // Menyingkir saat digulir ke bawah dan muncul lagi saat digulir ke atas.
          className={cn(
            "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-12 items-center justify-center gap-2 rounded-full bg-kopi text-sm font-semibold text-putih shadow-lift transition-[transform,bottom,opacity] duration-300 hover:-translate-y-0.5 md:bottom-6 md:h-12 md:w-auto md:rounded-pill md:px-4",
            away && "pointer-events-none translate-y-3 opacity-0",
          )}
          aria-hidden={away || undefined}
          tabIndex={away ? -1 : undefined}
          aria-label={`Buka ${MEREK.asisten.nama}`}
          title={MEREK.asisten.tombol}
          data-testid="tombol-advisor"
        >
          <Sparkles className="size-5 text-emas md:size-4" aria-hidden /> <span className="hidden md:inline">{MEREK.asisten.tombol}</span>
        </button>
      ) : null}
      {bukaKe > 0 ? <AdvisorPanel open={open} setOpen={setOpen} context={context} bukaKe={bukaKe} resting={resting} hasProfile={hasProfile} ai={status.ai} aiFoto={status.aiFoto} /> : null}
    </>
  );
}

// Tombol "Tanya tentang produk ini" di halaman produk (tampil bila chat asisten tersedia, juga tanpa AI: kecocokan
// kulit, padanan shade, dan ongkir berbasis aturan).
export function AskAboutProduct({ productId, productName }: { productId: number; productName: string }) {
  const { tersedia } = useAiStatus();
  if (!tersedia) return null;
  return (
    <button type="button" onClick={() => openAdvisor({ productId, productName })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-aksen hover:underline" data-testid="tanya-produk">
      <Sparkles className="size-4" aria-hidden /> Tanya tentang produk ini
    </button>
  );
}
