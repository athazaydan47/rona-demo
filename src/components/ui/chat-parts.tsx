import { cn } from "@/lib/utils";

// Gelembung obrolan masuk dengan geser halus (CSS); kurangi gerakan mematikannya lewat globals.css.
export function Bubble({ children, className, side = "kiri", testId }: { children: React.ReactNode; className?: string; side?: "kiri" | "kanan"; testId?: string }) {
  return (
    <div className={cn("animate-muncul", side === "kanan" && "ml-auto", className)} data-testid={testId}>
      {children}
    </div>
  );
}

// Indikator "sedang mengetik": tiga titik berdenyut bergantian, dengan teks status untuk pembaca layar.
export function TypingDots({ status }: { status?: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-putih px-3.5 py-2 text-sm text-abu-hangat" role="status" aria-label={status ? `${status}...` : "Sedang menyiapkan jawaban"}>
      <span className="inline-flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-abu-hangat/70 animate-denyut" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
      {status ? <span>{status}...</span> : null}
    </p>
  );
}
