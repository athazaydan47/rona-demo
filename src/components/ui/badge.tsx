import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        netral: "bg-porselen text-abu-hangat border border-garis",
        flash: "bg-emas text-kopi",
        terlaris: "bg-kopi text-emas",
        baru: "bg-blush text-rona-gelap",
        diskon: "bg-rona text-putih",
        habis: "bg-[#F7E3E1] text-bahaya",
        menipis: "bg-[#FBEEDC] text-peringatan-teks",
        sensitif: "bg-[#E8EFE7] text-[#4F6A4E]",
        sukses: "bg-[#EAF6EF] text-sukses",
      },
    },
    defaultVariants: { variant: "netral" },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
