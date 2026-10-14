import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-pill border border-garis bg-putih px-4 text-base text-kopi shadow-[inset_0_1px_2px_rgb(42_31_29/0.03)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-abu-hangat/80 hover:border-kopi/25 focus-visible:border-aksen focus-visible:shadow-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bahaya",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("mb-1.5 block text-sm font-medium text-kopi", className)}
      {...props}
    />
  );
}

export function HelpText({ className, tone = "muted", ...props }: React.ComponentProps<"p"> & { tone?: "muted" | "error" }) {
  return (
    <p
      className={cn("mt-1.5 text-xs", tone === "error" ? "text-bahaya" : "text-abu-hangat", className)}
      {...props}
    />
  );
}
