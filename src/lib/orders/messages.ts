// Pratinjau pesan WA dan email untuk tiap peristiwa pesanan. Belum dikirim ke mana pun (outbox).
import { formatDateTimeWib, formatRupiah } from "@/lib/format";

export type OrderEvent = "dibuat" | "dibayar" | "siap_diambil" | "dikirim" | "selesai" | "dibatalkan";

export type MessageOrder = {
  number: string;
  name: string;
  total: number;
  method: "kirim" | "ambil";
  paymentMethod: string;
  expiresAt: Date | null;
  locationName: string;
  trackingNumber?: string | null;
  courier?: string | null;
  cancelReason?: string | null;
  link: string;
};

const payLabel: Record<string, string> = {
  qris: "QRIS",
  va_bca: "VA BCA",
  va_bni: "VA BNI",
  va_bri: "VA BRI",
  va_mandiri: "VA Mandiri",
  bayar_di_toko: "bayar di toko",
};

export function orderMessage(event: OrderEvent, o: MessageOrder): { wa: string; subject: string; email: string } {
  const first = o.name.trim().split(/\s+/)[0] || "Kak";
  const total = formatRupiah(o.total);
  switch (event) {
    case "dibuat": {
      const pay =
        o.paymentMethod === "bayar_di_toko"
          ? `Bayar saat mengambil di ${o.locationName}, paling lambat ${o.expiresAt ? formatDateTimeWib(o.expiresAt) : "jam tutup hari kerja berikutnya"}.`
          : `Selesaikan pembayaran ${payLabel[o.paymentMethod] ?? o.paymentMethod} sebesar ${total} sebelum ${o.expiresAt ? formatDateTimeWib(o.expiresAt) : "15 menit"}.`;
      return {
        wa: `Halo ${first}, pesanan ${o.number} sudah kami terima. ${pay} Cek detailnya di ${o.link}`,
        subject: `Pesanan ${o.number} diterima`,
        email: `Halo ${first},\n\nTerima kasih sudah belanja di Rona Beauty. Pesanan ${o.number} senilai ${total} sudah kami terima.\n\n${pay}\n\nDetail pesanan: ${o.link}\n\nSalam hangat,\nTim Rona`,
      };
    }
    case "dibayar":
      return {
        wa: `Pembayaran pesanan ${o.number} sebesar ${total} sudah masuk. ${o.method === "ambil" ? `Kami siapkan di ${o.locationName}, nanti kami kabari saat siap diambil.` : "Pesananmu segera kami kemas."} Terima kasih, ${first}!`,
        subject: `Pembayaran ${o.number} berhasil`,
        email: `Halo ${first},\n\nPembayaran untuk pesanan ${o.number} sebesar ${total} sudah kami terima.\n\n${o.method === "ambil" ? `Pesanan disiapkan di ${o.locationName}.` : "Pesanan segera kami kemas dan kirim."}\n\nDetail: ${o.link}\n\nSalam hangat,\nTim Rona`,
      };
    case "siap_diambil":
      return {
        wa: `${first}, pesanan ${o.number} sudah siap diambil di ${o.locationName}. Tunjukkan nomor pesanan ke kasir ya.`,
        subject: `Pesanan ${o.number} siap diambil`,
        email: `Halo ${first},\n\nPesanan ${o.number} sudah siap diambil di ${o.locationName}. Tunjukkan nomor pesanan ke kasir.\n\nSalam hangat,\nTim Rona`,
      };
    case "dikirim":
      return {
        wa: `Pesanan ${o.number} sudah dikirim${o.courier ? ` lewat ${o.courier}` : ""}${o.trackingNumber ? `, nomor resi ${o.trackingNumber}` : ""}. Lacak di ${o.link}`,
        subject: `Pesanan ${o.number} dikirim`,
        email: `Halo ${first},\n\nPesanan ${o.number} sudah dikirim${o.courier ? ` lewat ${o.courier}` : ""}.${o.trackingNumber ? `\nNomor resi: ${o.trackingNumber}` : ""}\n\nLacak: ${o.link}\n\nSalam hangat,\nTim Rona`,
      };
    case "selesai":
      return {
        wa: `Pesanan ${o.number} selesai. Semoga cocok, ${first}! Ceritakan pengalamanmu lewat ulasan ya.`,
        subject: `Pesanan ${o.number} selesai`,
        email: `Halo ${first},\n\nPesanan ${o.number} sudah selesai. Semoga produknya cocok untukmu. Kamu bisa menulis ulasan dari halaman pesanan.\n\n${o.link}\n\nSalam hangat,\nTim Rona`,
      };
    case "dibatalkan":
      return {
        wa: `Pesanan ${o.number} dibatalkan${o.cancelReason ? `: ${o.cancelReason.toLowerCase()}` : ""}. Kalau masih ingin, kamu bisa pesan lagi kapan saja.`,
        subject: `Pesanan ${o.number} dibatalkan`,
        email: `Halo ${first},\n\nPesanan ${o.number} dibatalkan${o.cancelReason ? ` (${o.cancelReason})` : ""}.\n\nKalau masih ingin, kamu bisa pesan lagi kapan saja.\n\nSalam hangat,\nTim Rona`,
      };
  }
}
