import { Hourglass } from "lucide-react";

export function AdminComingSoon({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-xl border border-dashed border-garis bg-putih p-6 text-center">
      <Hourglass className="mx-auto size-8 text-rona" aria-hidden />
      <h1 className="mt-2 font-serif text-2xl text-kopi">{title}</h1>
      <p className="mt-1 text-sm text-abu-hangat">Segera hadir. Menu dan izinnya sudah disiapkan.</p>
      <ul className="mt-4 space-y-1 text-left text-sm text-kopi/85">
        {points.map((p) => (
          <li key={p}>· {p}</li>
        ))}
      </ul>
    </div>
  );
}
