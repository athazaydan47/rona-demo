import type { Metadata } from "next";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { TrackForm } from "@/components/order/track-form";

export const metadata: Metadata = { title: "Lacak pesanan" };

export default function LacakPage() {
  return (
    <section className="container-rona max-w-md py-6 md:py-10">
      <Breadcrumb items={[{ label: "Lacak pesanan" }]} className="mb-3" />
      <h1 className="font-serif text-3xl font-medium text-kopi">Lacak pesanan</h1>
      <p className="mt-2 text-sm text-abu-hangat">Tanpa perlu masuk akun. Nomor pesanan ada di WhatsApp atau email konfirmasi.</p>
      <div className="mt-6 rounded-card border border-garis bg-putih p-5">
        <TrackForm />
      </div>
    </section>
  );
}
