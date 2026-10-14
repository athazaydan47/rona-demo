// Hook Next.js untuk galat render dan route di server (Fase 8B): diteruskan ke log terstruktur dan, bila SENTRY_DSN
// diisi, ke Sentry. Tanpa SENTRY_DSN tidak ada layanan luar yang dihubungi.
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { laporGalat } = await import("@/lib/galat");
  const digest = typeof err === "object" && err && "digest" in err ? String((err as { digest?: unknown }).digest ?? "") : undefined;
  await laporGalat(err, { tempat: `${context.routeType} ${context.routePath}`, url: request.path, digest, sisi: "server" });
};
