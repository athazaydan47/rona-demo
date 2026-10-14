"use client";

import { Accordion } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { MEREK } from "@/config/merek";

const VA_STEPS: Record<string, { title: string; steps: string[] }[]> = {
  va_bca: [
    { title: "m-BCA", steps: ["Buka m-BCA, pilih m-Transfer.", "Pilih BCA Virtual Account.", "Masukkan nomor virtual account di atas.", `Periksa nama ${MEREK.namaLengkap} dan nominal, lalu masukkan PIN.`] },
    { title: "KlikBCA", steps: ["Masuk ke KlikBCA, pilih Transfer Dana.", "Pilih Transfer ke BCA Virtual Account.", "Masukkan nomor virtual account, lalu ikuti konfirmasi dengan KeyBCA."] },
    { title: "ATM BCA", steps: ["Masukkan kartu dan PIN.", "Pilih Transaksi Lainnya, Transfer, ke Rek BCA Virtual Account.", "Masukkan nomor virtual account, lalu konfirmasi."] },
  ],
  va_bni: [
    { title: "BNI Mobile Banking", steps: ["Buka BNI Mobile, pilih Transfer.", "Pilih Virtual Account Billing.", "Masukkan nomor virtual account, periksa tagihan, lalu konfirmasi."] },
    { title: "ATM BNI", steps: ["Pilih Menu Lain, Transfer, Virtual Account Billing.", "Masukkan nomor virtual account, lalu konfirmasi."] },
  ],
  va_bri: [
    { title: "BRImo", steps: ["Buka BRImo, pilih BRIVA.", "Masukkan nomor virtual account.", "Periksa nominal, lalu masukkan PIN."] },
    { title: "ATM BRI", steps: ["Pilih Transaksi Lain, Pembayaran, Lainnya, BRIVA.", "Masukkan nomor virtual account, lalu konfirmasi."] },
  ],
  va_mandiri: [
    { title: "Livin' by Mandiri", steps: ["Buka Livin', pilih Bayar.", `Cari ${MEREK.namaLengkap} atau masukkan nomor virtual account.`, "Periksa tagihan, lalu konfirmasi dengan PIN."] },
    { title: "ATM Mandiri", steps: ["Pilih Bayar/Beli, Multi Payment.", "Masukkan kode perusahaan dan nomor virtual account, lalu konfirmasi."] },
  ],
  qris: [
    { title: "Aplikasi bank atau dompet digital", steps: ["Buka aplikasi yang mendukung QRIS.", "Pilih Scan atau Bayar dengan QR.", "Arahkan kamera ke kode QR di atas.", `Periksa nama ${MEREK.namaLengkap} dan nominal, lalu konfirmasi.`] },
    { title: "Dari HP yang sama", steps: ["Tekan lama gambar QR lalu simpan, atau ambil tangkapan layar.", "Buka aplikasi pembayaran, pilih unggah QR dari galeri.", "Konfirmasi pembayaran."] },
  ],
};

export function PaymentInstructions({ method }: { method: string }) {
  const groups = VA_STEPS[method] ?? [];
  if (groups.length === 0) return null;
  return (
    <Accordion.Root type="single" collapsible defaultValue={groups[0].title} className="divide-y divide-garis rounded-card border border-garis bg-putih">
      {groups.map((g) => (
        <Accordion.Item key={g.title} value={g.title}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-kopi">
              Cara bayar lewat {g.title}
              <ChevronDown className="size-4 text-abu-hangat transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="px-4 pb-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-kopi/90">
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
