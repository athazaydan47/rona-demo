import { notFound } from "next/navigation";

// Tujuan rewrite dari proxy untuk slug produk yang tidak ada. Dipanggil notFound() di rute statis
// supaya responsnya diprarender dengan status HTTP 404 sungguhan.
export default function ProdukTidakAdaPage() {
  notFound();
}
