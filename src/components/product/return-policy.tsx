import Link from "next/link";
import { RETURN_POLICY } from "@/lib/content/return-policy";
import { RotateCcw, ShieldCheck, Video } from "lucide-react";

export function ReturnPolicy() {
  return (
    <aside className="rounded-card border border-garis bg-porselen p-5" aria-labelledby="retur-heading">
      <h2 id="retur-heading" className="font-serif text-xl text-kopi">
        Retur dan jaminan
      </h2>
      <ul className="mt-3 space-y-2.5 text-sm text-kopi/90">
        <li className="flex gap-2.5">
          <Video className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden />
          <span>{RETURN_POLICY.window}</span>
        </li>
        <li className="flex gap-2.5">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden />
          <span>{RETURN_POLICY.scope}</span>
        </li>
        <li className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-aksen" aria-hidden />
          <span>{RETURN_POLICY.origin}</span>
        </li>
      </ul>
      <Link href={RETURN_POLICY.href} className="mt-3 inline-block text-sm font-semibold text-aksen hover:underline">
        Baca kebijakan retur lengkap
      </Link>
    </aside>
  );
}
