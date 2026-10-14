// Gerbang kueri flash sale (Fase 8B): kondisi SQL yang membuat kueri harga flash kosong bila fitur flash sale dimatikan
// di src/config/fitur.ts. Dipakai di kueri katalog dan halaman produk; keranjang dan checkout memakai loadLiveFlash.
import { sql } from "drizzle-orm";
import { fiturAktif } from "@/config/fitur";

export const flashSaleGate = () => (fiturAktif("flashSale") ? undefined : sql`false`);
