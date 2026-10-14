// Aturan promo murni (tanpa DB), dipakai server dan pratinjau di browser.
import type { BannerArt } from "@/db/schema/content";
import { packagingValues } from "@/db/schema/enums";
import { formatRupiah } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";

export const FLASH_PRESETS = [
  { label: "Siang 12.00 sampai 14.00", name: "Flash Sale Siang", start: "12.00", end: "14.00" },
  { label: "Malam 20.00 sampai 22.00", name: "Flash Sale Malam", start: "20.00", end: "22.00" },
] as const;

export type FlashItemCheck = { errors: string[]; warnings: string[]; percent: number };

// Validasi murni item slot: harga flash di bawah harga efektif, kuota dan batas per pembeli masuk akal.
export function checkFlashItem(input: { flashPrice: number; quota: number; maxPerCustomer: number; effective: number; normalPrice: number; onlineAvailable: number; sold?: number }): FlashItemCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isInteger(input.flashPrice) || input.flashPrice <= 0) errors.push("Isi harga flash.");
  else if (input.flashPrice >= input.effective) errors.push(`Harga flash harus di bawah harga efektif saat slot dimulai (${formatRupiah(input.effective)}).`);
  if (!Number.isInteger(input.quota) || input.quota < 1 || input.quota > 10_000) errors.push("Kuota 1 sampai 10.000.");
  else if (input.sold != null && input.quota < input.sold) errors.push(`Kuota tidak boleh di bawah yang sudah terjual (${input.sold}).`);
  if (!Number.isInteger(input.maxPerCustomer) || input.maxPerCustomer < 1 || input.maxPerCustomer > 10) errors.push("Maksimal per pembeli 1 sampai 10.");
  if (Number.isInteger(input.quota) && input.quota > input.onlineAvailable) warnings.push(`Kuota melebihi stok online tersedia (${input.onlineAvailable}). Pembeli bisa kehabisan stok sebelum kuota habis.`);
  return { errors, warnings, percent: input.flashPrice > 0 ? discountPercent(input.normalPrice, input.flashPrice) : 0 };
}

const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) => a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();

// Slot otomatis yang harus dinonaktifkan karena bertabrakan dengan slot admin (murni).
export function autoSlotsToDisable(adminSlot: { startsAt: Date; endsAt: Date }, existing: { id: number; source: string; isActive: boolean; startsAt: Date; endsAt: Date }[]) {
  return existing.filter((e) => e.source !== "admin" && e.isActive && overlaps(adminSlot, e)).map((e) => e.id);
}

export type VoucherForm = {
  code: string;
  title: string;
  description?: string;
  type: "nominal" | "persen" | "ongkir";
  value: number;
  maxDiscount?: number | null;
  minSpend: number;
  startsAt: Date;
  endsAt: Date;
  quota?: number | null;
  quotaPerCustomer: number;
  brandIds?: number[];
  categoryIds?: number[];
  stackWithFlash: boolean;
  isActive: boolean;
  // Fase 8C: boleh ditawarkan ke semua pembeli (chat asisten). Bawaan tidak.
  isPublic?: boolean;
};

export function validateVoucher(v: VoucherForm): string | null {
  if (!/^[A-Z0-9]{4,20}$/.test((v.code ?? "").trim().toUpperCase())) return "Kode 4 sampai 20 huruf besar atau angka, tanpa spasi.";
  if ((v.title ?? "").trim().length < 3) return "Isi judul voucher.";
  if (!["nominal", "persen", "ongkir"].includes(v.type)) return "Pilih tipe voucher.";
  if (!Number.isInteger(v.value) || v.value <= 0) return "Isi nilai voucher.";
  if (v.type === "persen" && v.value > 90) return "Potongan persen maksimal 90%.";
  if (v.type !== "persen" && v.value > 10_000_000) return "Nilai voucher terlalu besar.";
  if (v.type === "persen" && (v.maxDiscount == null || v.maxDiscount <= 0)) return "Voucher persen wajib punya batas maksimal potongan.";
  if (!Number.isInteger(v.minSpend) || v.minSpend < 0) return "Minimal belanja tidak valid.";
  if (!(v.startsAt instanceof Date) || !(v.endsAt instanceof Date) || Number.isNaN(v.startsAt.getTime()) || Number.isNaN(v.endsAt.getTime())) return "Isi periode voucher.";
  if (v.endsAt.getTime() <= v.startsAt.getTime()) return "Tanggal selesai harus setelah tanggal mulai.";
  if (v.quota != null && (!Number.isInteger(v.quota) || v.quota < 1)) return "Kuota minimal 1, atau kosongkan untuk tanpa batas.";
  if (!Number.isInteger(v.quotaPerCustomer) || v.quotaPerCustomer < 1 || v.quotaPerCustomer > 100) return "Kuota per pembeli 1 sampai 100.";
  return null;
}

export type BannerForm = {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  href: string;
  imageUrl?: string | null;
  art?: BannerArt | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sortOrder?: number;
  isActive: boolean;
};

export function validateBanner(b: BannerForm): string | null {
  if ((b.title ?? "").trim().length < 3 || b.title.length > 80) return "Judul banner 3 sampai 80 karakter.";
  if ((b.subtitle ?? "").length > 200) return "Teks banner maksimal 200 karakter.";
  if ((b.ctaLabel ?? "").length > 30) return "Label tombol maksimal 30 karakter.";
  if (!/^\/[a-z0-9\-/?=&%._]*$/i.test(b.href ?? "")) return "Tautan harus halaman di toko ini, diawali / (misal /c/skincare).";
  if (!b.imageUrl && !b.art?.items?.length) return "Pilih gambar atau komposisi ProductArt.";
  for (const it of b.art?.items ?? []) {
    if (!(packagingValues as readonly string[]).includes(it.packaging)) return "Bentuk kemasan tidak dikenal.";
    if (!/^#[0-9a-fA-F]{6}$/.test(it.shade) || !/^#[0-9a-fA-F]{6}$/.test(it.brandColor)) return "Warna harus kode hex.";
  }
  if ((b.art?.items?.length ?? 0) > 3) return "Komposisi maksimal 3 produk.";
  if (b.startsAt && b.endsAt && b.endsAt.getTime() <= b.startsAt.getTime()) return "Jadwal selesai harus setelah jadwal mulai.";
  return null;
}
