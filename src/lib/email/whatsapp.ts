// Kanal WhatsApp tetap pratinjau di Kotak Notifikasi. Antarmuka ini disiapkan untuk WhatsApp Business Platform
// resmi (Cloud API) dengan template yang disetujui Meta; kebutuhannya dicatat di docs/DEPLOY.md. Belum diimplementasikan.
export type WhatsAppTemplateMessage = {
  to: string; // nomor internasional, misal 6281234567890
  template: string; // nama template yang disetujui, misal "pesanan_dibayar"
  language: "id";
  params: string[]; // isi variabel {{1}}, {{2}}, ...
  idempotencyKey: string;
};

export interface WhatsAppSender {
  readonly name: string;
  send(msg: WhatsAppTemplateMessage): Promise<{ ok: true; id: string } | { ok: false; error: string; retryable: boolean }>;
}
