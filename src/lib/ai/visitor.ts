// Id pengunjung untuk batas pemakaian AI: akun bila masuk, selain itu cookie acak dari proxy. Disimpan sebagai hash.
import { cookies } from "next/headers";
import { currentCustomer } from "@/lib/auth/current";
import { VISITOR_COOKIE, visitorHash } from "./usage";

export async function currentVisitorHash() {
  const me = await currentCustomer();
  if (me) return visitorHash(`akun:${me.customerId}`);
  const id = (await cookies()).get(VISITOR_COOKIE)?.value;
  return visitorHash(id ? `tamu:${id}` : "tamu:tanpa-cookie");
}
