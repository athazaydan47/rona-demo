// PDF label kirim A6 dan daftar ambil A4 dengan pdf-lib (JavaScript murni, jalan di fungsi serverless Vercel).
// QR digambar dari matriks modul qrcode sebagai kotak vektor, jadi tidak butuh kanvas atau gambar.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatDateTimeWib } from "@/lib/format";
import type { LabelData, PickRow } from "./labels";
import { MEREK } from "@/config/merek";

const MM = 72 / 25.4;
export const A6 = [105 * MM, 148 * MM] as const;
export const A4 = [210 * MM, 297 * MM] as const;
const KOPI = rgb(0.165, 0.122, 0.114);
const ABU = rgb(0.45, 0.4, 0.38);
const hexRgb = (hex: string) => rgb(...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]));
const AKSEN = hexRgb(MEREK.palet.aksen);

// Font standar PDF hanya mengenal WinAnsi; buang karakter di luar itu (spasi tak putus jadi spasi biasa).
export const pdfSafe = (t: string) => String(t ?? "").replace(/\u00A0/g, " ").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) page.drawRectangle({ x: x + c * cell, y: y + size - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: KOPI });
}

export async function labelsPdf(labels: LabelData[], generatedAt: Date) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Label kirim ${MEREK.namaLengkap} (${labels.length})`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const l of labels) {
    const page = doc.addPage([A6[0], A6[1]]);
    const W = A6[0];
    const pad = 5 * MM;
    let y = A6[1] - pad;
    const text = (t: string, x: number, yy: number, size: number, f = font, color = KOPI) => page.drawText(pdfSafe(t), { x, y: yy, size, font: f, color });
    page.drawRectangle({ x: pad / 2, y: pad / 2, width: W - pad, height: A6[1] - pad, borderColor: KOPI, borderWidth: 1 });
    // Kepala: merek dan kurir.
    text(MEREK.namaLengkap, pad, y - 12, 13, bold, AKSEN);
    const courier = pdfSafe(`${l.courier}${l.service ? ` ${l.service}` : ""}`).slice(0, 28);
    const cw = bold.widthOfTextAtSize(courier, 10);
    page.drawRectangle({ x: W - pad - cw - 8, y: y - 16, width: cw + 8, height: 16, color: KOPI });
    text(courier, W - pad - cw - 4, y - 12, 10, bold, rgb(1, 1, 1));
    y -= 22;
    page.drawLine({ start: { x: pad, y }, end: { x: W - pad, y }, thickness: 0.8, color: KOPI });
    // QR dan nomor pesanan.
    const qr = 26 * MM;
    drawQr(page, l.qrText, pad, y - qr - 4, qr);
    text("Nomor pesanan", pad + qr + 8, y - 16, 7, font, ABU);
    text(l.number, pad + qr + 8, y - 30, 12, bold);
    text(`Berat ${l.weightGram} g`, pad + qr + 8, y - 46, 8);
    text(`${l.itemCount} barang`, pad + qr + 8, y - 57, 8);
    text(formatDateTimeWib(generatedAt), pad + qr + 8, y - 68, 7, font, ABU);
    y -= qr + 10;
    page.drawLine({ start: { x: pad, y }, end: { x: W - pad, y }, thickness: 0.8, color: KOPI });
    // Penerima.
    text("PENERIMA", pad, y - 11, 7, bold, ABU);
    text(l.recipient.name, pad, y - 24, 11, bold);
    text(l.recipient.phone, pad, y - 35, 9);
    let ly = y - 47;
    for (const line of l.recipient.lines.flatMap((x) => wrap(x, font, 9, W - pad * 2))) {
      text(line, pad, ly, 9);
      ly -= 11;
    }
    y = ly - 2;
    page.drawLine({ start: { x: pad, y }, end: { x: W - pad, y }, thickness: 0.4, color: ABU });
    // Pengirim.
    text("PENGIRIM", pad, y - 11, 7, bold, ABU);
    text(`${l.sender.name}, ${l.sender.place}`, pad, y - 22, 8.5, bold);
    let sy = y - 33;
    for (const line of wrap(`${l.sender.address} · ${l.sender.phone}`, font, 8, W - pad * 2)) {
      text(line, pad, sy, 8);
      sy -= 10;
    }
    y = sy - 2;
    page.drawLine({ start: { x: pad, y }, end: { x: W - pad, y }, thickness: 0.4, color: ABU });
    // Isi dan catatan.
    text("ISI PAKET", pad, y - 11, 7, bold, ABU);
    let iy = y - 22;
    for (const it of l.items.slice(0, 5)) {
      const line = wrap(`${it.qty} x ${it.name}${/^\d+\s?(ml|g)$/i.test(it.shade) ? "" : ` (${it.shade})`}`, font, 7.5, W - pad * 2)[0] ?? "";
      text(line, pad, iy, 7.5);
      iy -= 9;
    }
    if (l.items.length > 5) {
      text(`dan ${l.items.length - 5} produk lain`, pad, iy, 7.5, font, ABU);
      iy -= 9;
    }
    if (l.note) {
      for (const line of wrap(`Catatan: ${l.note}`, font, 7.5, W - pad * 2).slice(0, 3)) {
        text(line, pad, iy - 2, 7.5, bold);
        iy -= 9;
      }
    }
    text("Label demo, data fiktif. Tidak untuk pengiriman sungguhan.", pad, pad + 2, 6, font, ABU);
  }
  return doc.save();
}

export async function pickListPdf(rows: PickRow[], orders: string[], generatedAt: Date, staffName: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Daftar ambil ${MEREK.namaLengkap}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = A4[0];
  const pad = 15 * MM;
  const cols = [
    { title: "Lokasi", x: pad, w: 70 },
    { title: "SKU", x: pad + 72, w: 70 },
    { title: "Produk", x: pad + 144, w: 190 },
    { title: "Shade", x: pad + 336, w: 90 },
    { title: "Jumlah", x: pad + 428, w: 40 },
    { title: "Cek", x: pad + 472, w: 20 },
  ];
  let page = doc.addPage([A4[0], A4[1]]);
  let y = A4[1] - pad;
  const text = (t: string, x: number, yy: number, size: number, f = font, color = KOPI) => page.drawText(pdfSafe(t), { x, y: yy, size, font: f, color });
  const header = () => {
    text(MEREK.namaLengkap, pad, y - 14, 14, bold, AKSEN);
    text("Daftar ambil", pad, y - 32, 18, bold);
    text(`Dibuat ${formatDateTimeWib(generatedAt)} oleh ${staffName}`, pad, y - 46, 9, font, ABU);
    let oy = y - 60;
    for (const line of wrap(`Pesanan (${orders.length}): ${orders.join(", ")}`, font, 8, W - pad * 2).slice(0, 4)) {
      text(line, pad, oy, 8, font, ABU);
      oy -= 10;
    }
    y = oy - 8;
    for (const c of cols) text(c.title, c.x, y, 8.5, bold);
    y -= 6;
    page.drawLine({ start: { x: pad, y }, end: { x: W - pad, y }, thickness: 0.8, color: KOPI });
    y -= 13;
  };
  header();
  for (const r of rows) {
    const nameLines = wrap(r.productName, font, 9, cols[2].w).slice(0, 2);
    const need = nameLines.length * 11 + 6;
    if (y - need < pad + 20) {
      page = doc.addPage([A4[0], A4[1]]);
      y = A4[1] - pad;
      header();
    }
    text(wrap(r.locationName, font, 8.5, cols[0].w)[0] ?? "", cols[0].x, y, 8.5);
    text(r.sku, cols[1].x, y, 8.5);
    nameLines.forEach((l, i) => text(l, cols[2].x, y - i * 11, 9));
    text(wrap(r.shadeName, font, 8.5, cols[3].w)[0] ?? "", cols[3].x, y, 8.5);
    text(String(r.quantity), cols[4].x + 20, y, 10, bold);
    page.drawRectangle({ x: cols[5].x + 4, y: y - 2, width: 10, height: 10, borderColor: KOPI, borderWidth: 0.8 });
    y -= need;
    page.drawLine({ start: { x: pad, y: y + 8 }, end: { x: W - pad, y: y + 8 }, thickness: 0.3, color: ABU });
  }
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  text(`Total ${total} barang dari ${rows.length} varian.`, pad, Math.max(pad, y - 6), 9, bold);
  return doc.save();
}
