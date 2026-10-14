"use client";

import { X } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

type ChipProps = React.ComponentProps<"button"> & {
  selected?: boolean;
  asChild?: boolean;
  onRemove?: () => void;
};

export function Chip({ className, selected = false, asChild = false, onRemove, children, type, ...props }: ChipProps) {
  const classes = cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-200 ease-soft",
    selected ? "border-aksen bg-blush text-aksen-gelap" : "border-garis bg-putih text-kopi hover:border-kopi/30 hover:bg-porselen",
    className,
  );
  if (asChild) {
    // Slot hanya menerima satu anak, jadi tombol hapus tidak tersedia dalam mode ini.
    return (
      <Slot.Root data-slot="chip" data-selected={selected ? "" : undefined} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      data-slot="chip"
      data-selected={selected ? "" : undefined}
      aria-pressed={selected}
      type={type ?? "button"}
      className={classes}
      {...props}
    >
      {children}
      {onRemove ? (
        <span
          role="button"
          aria-label={typeof children === "string" ? `Hapus filter ${children}` : "Hapus filter"}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-aksen/15"
        >
          <X className="size-3.5" />
        </span>
      ) : null}
    </button>
  );
}
