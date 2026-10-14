import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 ease-soft select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-rona text-putih shadow-soft hover:bg-rona-gelap active:bg-rona-gelap",
        secondary: "bg-blush text-rona-gelap hover:bg-[#EFCDD2]",
        outline: "border border-garis bg-putih text-kopi hover:border-kopi/30 hover:bg-porselen",
        ghost: "text-kopi hover:bg-blush/60",
        link: "text-rona-gelap underline-offset-4 hover:underline px-0 h-auto",
        dark: "bg-kopi text-putih hover:bg-kopi/90",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
