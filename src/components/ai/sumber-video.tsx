// Sumber video (judul atau caption, kreator, tautan ke video asli) untuk Cari dari video dan kartu dupe chat asisten.
import { ExternalLink } from "lucide-react";
import type { SumberVideo } from "@/lib/tanya/kartu";

export function SumberVideoBlok({ s }: { s: SumberVideo }) {
  return (
    <div className="flex gap-3 rounded-xl border border-garis bg-putih p-3" data-testid="sumber-video">
      {s.thumbnailUrl ? (
        // Sampul ditampilkan langsung dari server TikTok atau YouTube, tidak diunduh dan tidak disimpan.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-porselen text-[10px] font-semibold text-abu-hangat uppercase">{s.platform}</div>
      )}
      <div className="min-w-0 text-sm">
        <p className="line-clamp-3 text-kopi">{s.title}</p>
        {s.author ? (
          <p className="mt-1 text-xs text-abu-hangat">
            Video oleh{" "}
            {s.authorUrl ? (
              <a href={s.authorUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-kopi hover:underline">
                {s.author}
              </a>
            ) : (
              <span className="font-semibold text-kopi">{s.author}</span>
            )}{" "}
            di {s.platform === "tiktok" ? "TikTok" : "YouTube"}
          </p>
        ) : null}
        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-aksen hover:underline">
          Lihat video asli <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </div>
  );
}
