"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, BookmarkPlus, Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { ProductArt } from "@/components/product-art";
import type { CartLine, CartView, SavedLine } from "@/lib/cart/service";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FreeShippingBar({ remaining, threshold, cap, className }: { remaining: number; threshold: number; cap: number; className?: string }) {
  // Batas 0 berarti gratis ongkir otomatis dimatikan di Pengaturan.
  if (threshold <= 0 || cap <= 0) return null;
  const pct = Math.min(100, Math.round(((threshold - remaining) / threshold) * 100));
  return (
    <div className={cn("rounded-card bg-blush/50 p-3", className)} data-testid="bilah-gratis-ongkir">
      <p className="flex items-center gap-2 text-sm text-kopi">
        <Truck className="size-4 shrink-0 text-rona" aria-hidden />
        {remaining > 0 ? (
          <span>
            Tambah <strong className="whitespace-nowrap tabular-nums">{formatRupiah(remaining)}</strong> lagi untuk gratis ongkir
          </span>
        ) : (
          <span className="font-semibold">Kamu dapat gratis ongkir sampai {formatRupiah(cap)}</span>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-pill bg-putih" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progres gratis ongkir">
        <div className="h-full rounded-pill bg-rona transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

type LineProps = {
  line: CartLine;
  busy: boolean;
  compact?: boolean;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onSave: () => void;
};

export function CartLineRow({ line, busy, compact, onQty, onRemove, onSave }: LineProps) {
  const href = `/p/${line.productSlug}${line.showShade ? `?shade=${line.shadeSlug}` : ""}`;
  return (
    <li className={cn("flex gap-3 py-4", busy && "opacity-60")}>
      <Link href={href} className={cn("shrink-0 overflow-hidden rounded-xl", compact ? "w-16" : "w-20 sm:w-24")}>
        <ProductArt packaging={line.packaging} shade={line.hex} brandColor={line.brandColor} brandName={line.brandName} title={`${line.productName}${line.showShade ? `, ${line.shadeName}` : ""}`} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-abu-hangat uppercase">{line.brandName}</p>
        <Link href={href} className="line-clamp-2 text-sm font-medium text-kopi hover:text-rona-gelap">
          {line.productName}
        </Link>
        {line.showShade ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-abu-hangat">
            <span className="size-3 rounded-full border border-kopi/10" style={{ backgroundColor: line.hex }} aria-hidden /> {line.shadeName}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {line.segments.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <PriceTag price={s.unitPrice} normalPrice={i === 0 ? line.normalPrice : undefined} size="sm" />
              {s.source === "flash" ? <Badge variant="flash">Flash</Badge> : null}
              {line.segments.length > 1 ? <span className="text-xs text-abu-hangat tabular-nums">x{s.quantity}</span> : null}
            </span>
          ))}
        </div>
        {line.notices.map((n) => (
          <p key={n} className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[#FBEEDC] px-2 py-1 text-xs text-[#8A5512]" role="status">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {n}
          </p>
        ))}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-pill border border-garis" role="group" aria-label={`Jumlah ${line.productName}`}>
            <button type="button" onClick={() => onQty(line.quantity - 1)} disabled={busy || line.quantity <= 1} className="grid size-8 place-items-center rounded-full hover:bg-porselen disabled:opacity-40" aria-label="Kurangi jumlah">
              <Minus className="size-3.5" />
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {line.quantity}
            </span>
            <button type="button" onClick={() => onQty(line.quantity + 1)} disabled={busy || line.quantity >= line.maxQty} className="grid size-8 place-items-center rounded-full hover:bg-porselen disabled:opacity-40" aria-label="Tambah jumlah">
              <Plus className="size-3.5" />
            </button>
          </div>
          <button type="button" onClick={onSave} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-pill px-2 text-xs font-medium text-abu-hangat hover:bg-porselen hover:text-kopi">
            <BookmarkPlus className="size-3.5" /> {compact ? "Simpan" : "Simpan untuk nanti"}
          </button>
          <button type="button" onClick={onRemove} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-pill px-2 text-xs font-medium text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${line.productName}`}>
            <Trash2 className="size-3.5" /> Hapus
          </button>
          <span className="ml-auto text-sm font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(line.lineTotal)}</span>
        </div>
      </div>
    </li>
  );
}

export function SavedRow({ line, busy, onMove, onRemove }: { line: SavedLine; busy: boolean; onMove: () => void; onRemove: () => void }) {
  return (
    <li className={cn("flex items-center gap-3 py-3", busy && "opacity-60")}>
      <Link href={`/p/${line.productSlug}`} className="w-14 shrink-0 overflow-hidden rounded-lg">
        <ProductArt packaging={line.packaging} shade={line.hex} brandColor={line.brandColor} brandName={line.brandName} title={line.productName} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-kopi">{line.productName}</p>
        <p className="text-xs text-abu-hangat">
          {line.showShade ? `${line.shadeName} · ` : ""}
          {line.inStock ? <span className="whitespace-nowrap tabular-nums">{formatRupiah(line.unitPrice)}</span> : <span className="text-bahaya">Habis</span>}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onMove} disabled={busy || !line.inStock}>
        Pindah ke keranjang
      </Button>
      <button type="button" onClick={onRemove} disabled={busy} className="grid size-8 place-items-center rounded-full text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${line.productName}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}

export function VoucherForm({ view, pending, onApply, onRemove }: { view: CartView; pending: boolean; onApply: (code: string) => void; onRemove: () => void }) {
  const [code, setCode] = useState(view.voucherCode ?? "");
  const v = view.pricing.voucher;
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onApply(code);
        }}
      >
        <label htmlFor="kode-voucher" className="sr-only">
          Kode voucher
        </label>
        <div className="relative min-w-0 flex-1">
          <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-abu-hangat" aria-hidden />
          <input
            id="kode-voucher"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kode voucher"
            autoComplete="off"
            aria-invalid={v && !v.applied ? true : undefined}
            aria-describedby="voucher-pesan"
            className="h-11 w-full rounded-pill border border-garis bg-putih pr-3 pl-9 text-sm uppercase outline-none focus-visible:border-rona focus-visible:shadow-ring aria-invalid:border-bahaya"
          />
        </div>
        {v?.applied ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCode("");
              onRemove();
            }}
            disabled={pending}
          >
            Lepas
          </Button>
        ) : (
          <Button type="submit" variant="dark" disabled={pending || !code.trim()}>
            Pakai
          </Button>
        )}
      </form>
      <p id="voucher-pesan" className={cn("mt-1.5 min-h-4 text-xs", v ? (v.applied ? "text-sukses" : "text-bahaya") : "text-abu-hangat")} role={v && !v.applied ? "alert" : undefined}>
        {v ? v.message : "Coba RONABARU, HEMAT15, ONGKIRRONA, atau LUMI10."}
      </p>
    </div>
  );
}

export function SummaryRows({ view, shippingLabel }: { view: CartView; shippingLabel?: string }) {
  const p = view.pricing;
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-abu-hangat">Subtotal ({p.itemCount} barang)</dt>
        <dd className="whitespace-nowrap text-kopi tabular-nums">{formatRupiah(p.normalSubtotal)}</dd>
      </div>
      {p.productDiscount > 0 ? (
        <div className="flex justify-between gap-3">
          <dt className="text-abu-hangat">Diskon produk</dt>
          <dd className="whitespace-nowrap text-sukses tabular-nums">-{formatRupiah(p.productDiscount)}</dd>
        </div>
      ) : null}
      {p.voucherDiscount > 0 ? (
        <div className="flex justify-between gap-3">
          <dt className="text-abu-hangat">Voucher {p.voucher?.code}</dt>
          <dd className="whitespace-nowrap text-sukses tabular-nums">-{formatRupiah(p.voucherDiscount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <dt className="text-abu-hangat">Ongkir</dt>
        <dd className="text-right text-xs text-abu-hangat">{shippingLabel ?? "Dihitung di checkout"}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-garis pt-3 text-base">
        <dt className="font-semibold text-kopi">Total</dt>
        <dd className="font-semibold whitespace-nowrap text-kopi tabular-nums">{formatRupiah(p.total)}</dd>
      </div>
    </dl>
  );
}

export function EmptyCart({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-10" : "py-16")}>
      <div className="w-28">
        <ProductArt packaging="lip_tint" shade="#F4DCDF" brandColor="#B8475D" brandName="Rona" title="Ilustrasi keranjang kosong" />
      </div>
      <p className="mt-4 font-serif text-2xl text-kopi">Keranjangmu masih kosong</p>
      <p className="mt-1 max-w-xs text-sm text-abu-hangat">Mulai dari produk terlaris, atau cari shade yang cocok untukmu.</p>
      <Button asChild className="mt-5">
        <Link href="/c/semua?urut=terlaris">
          <ShoppingBag /> Lihat produk terlaris
        </Link>
      </Button>
    </div>
  );
}
