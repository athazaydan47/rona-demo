// Usulan deskripsi massal yang menunggu ditinjau (disimpan sementara di cache AI per slug produk). Bukan server
// action: hanya dipanggil halaman admin yang sudah memeriksa izin produk.kelola.
import { db } from "@/db/client";
import type { ClaimIssue } from "@/lib/ai/penulis";
import { cacheGet } from "@/lib/ai/usage";
import { now } from "@/lib/clock";

export type StoredDescriptionDraft = { draft: Record<string, string>; issues: Record<string, ClaimIssue[]>; by: string };

export async function loadDescriptionDraft(slug: string) {
  return cacheGet<StoredDescriptionDraft>(db, `deskripsi:${slug}`, now()).catch(() => null);
}
