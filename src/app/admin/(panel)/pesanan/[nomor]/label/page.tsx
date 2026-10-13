import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import QRCode from "qrcode";
import { ArrowLeft, FileText } from "lucide-react";
import { Denied, Skeleton } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/admin/current";
import { labelData } from "@/lib/admin/labels";
import { now } from "@/lib/clock";
import { formatDateTimeWib } from "@/lib/format";

export const metadata: Metadata = { title: "Pratinjau label" };

type Props = { params: Promise<{ nomor: string }> };

// Pratinjau HTML label A6, isinya sama dengan PDF dari /api/admin/label.
async function Content({ params }: Props) {
  await connection();
  const { nomor } = await params;
  const me = await requireStaff(`/admin/pesanan/${nomor}/label`);
  const { labels } = await labelData(db, me, [nomor]);
  const l = labels[0];
  if (!l) return <Denied message="Label tidak tersedia untuk pesanan ini." />;
  const qr = await QRCode.toString(l.qrText, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2a1f1d", light: "#ffffff00" } });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/admin/pesanan/${l.number}`} className="inline-flex items-center gap-1 text-sm font-semibold text-rona hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> {l.number}
        </Link>
        <Button asChild size="sm">
          <a href={`/api/admin/label?nomor=${l.number}`} target="_blank" rel="noreferrer">
            <FileText /> Unduh PDF A6
          </a>
        </Button>
      </div>
      <article className="mx-auto w-full max-w-[105mm] border-2 border-kopi bg-putih p-[4mm] text-kopi shadow-soft" style={{ aspectRatio: "105 / 148" }} data-testid="label-a6">
        <header className="flex items-center justify-between border-b border-kopi pb-2">
          <span className="font-serif text-lg font-semibold text-rona">Rona Beauty</span>
          <span className="rounded bg-kopi px-2 py-0.5 text-xs font-bold text-putih">
            {l.courier} {l.service}
          </span>
        </header>
        <div className="flex gap-3 border-b border-kopi py-2">
          <div className="size-[26mm] shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 text-xs">
            <p className="text-[10px] text-abu-hangat">Nomor pesanan</p>
            <p className="text-base font-bold tabular-nums">{l.number}</p>
            <p>Berat {l.weightGram} g</p>
            <p>{l.itemCount} barang</p>
            <p className="text-[10px] text-abu-hangat">{formatDateTimeWib(now())}</p>
          </div>
        </div>
        <section className="border-b border-garis py-2 text-xs">
          <p className="text-[10px] font-bold tracking-wide text-abu-hangat">PENERIMA</p>
          <p className="text-sm font-bold">{l.recipient.name}</p>
          <p>{l.recipient.phone}</p>
          {l.recipient.lines.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </section>
        <section className="border-b border-garis py-2 text-[11px]">
          <p className="text-[10px] font-bold tracking-wide text-abu-hangat">PENGIRIM</p>
          <p className="font-semibold">
            {l.sender.name}, {l.sender.place}
          </p>
          <p>
            {l.sender.address} · {l.sender.phone}
          </p>
        </section>
        <section className="py-2 text-[11px]">
          <p className="text-[10px] font-bold tracking-wide text-abu-hangat">ISI PAKET</p>
          {l.items.slice(0, 5).map((i) => (
            <p key={`${i.name}-${i.shade}`} className="truncate">
              {i.qty} x {i.name}
              {/^\d+\s?(ml|g)$/i.test(i.shade) ? "" : ` (${i.shade})`}
            </p>
          ))}
          {l.note ? <p className="mt-1 font-semibold">Catatan: {l.note}</p> : null}
        </section>
        <p className="mt-auto text-[9px] text-abu-hangat">Label demo, data fiktif. Tidak untuk pengiriman sungguhan.</p>
      </article>
    </div>
  );
}

export default function LabelPreviewPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={2} />}>
      <Content {...props} />
    </Suspense>
  );
}
