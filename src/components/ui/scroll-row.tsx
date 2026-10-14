import { cn } from "@/lib/utils";

type ScrollRowProps = {
  children: React.ReactNode; // elemen <li>
  ariaLabel: string;
  className?: string;
  // Kelas grid untuk lebar md ke atas, misal "md:grid-cols-4".
  desktop?: string;
  gap?: string;
  // Lebar kartu di bawah md, misal "w-[44vw]". Di md ke atas selalu mengikuti grid.
  itemWidth?: string;
};

// Di bawah md: baris geser horizontal dengan scroll-snap, kartu berikutnya terlihat sebagian.
// Di md ke atas: grid biasa. Kontainer bisa difokuskan supaya panah keyboard ikut menggeser.
export function ScrollRow({ children, ariaLabel, className, desktop = "md:grid-cols-4", gap = "gap-3 md:gap-4", itemWidth = "w-[44vw]" }: ScrollRowProps) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        "-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-1 scrollbar-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-aksen md:mx-0 md:snap-none md:overflow-visible md:px-0 md:pb-0",
        className,
      )}
    >
      <ul className={cn("flex md:grid", gap, desktop, "[&>li]:shrink-0 [&>li]:snap-start md:[&>li]:w-auto")} data-item-width={itemWidth}>
        {children}
      </ul>
      {/* Lebar kartu HP ditulis sebagai aturan CSS supaya tidak kalah dari kelas lain dan tetap dibatalkan di md. */}
      <style>{`[data-item-width="${itemWidth}"] > li { width: ${itemWidth.replace(/^w-\[|\]$/g, "")}; } @media (min-width: 768px) { [data-item-width="${itemWidth}"] > li { width: auto; } }`}</style>
    </div>
  );
}
