// Pembeli wajib masuk untuk halaman /akun. Dipanggil di dalam Suspense (membaca cookie).
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/auth/current";

export async function requireCustomer(path: string) {
  const me = await currentCustomer();
  if (!me) redirect(`/masuk?kembali=${encodeURIComponent(path)}`);
  if (!me.name.trim()) redirect(`/masuk?kembali=${encodeURIComponent(path)}`);
  return me;
}
