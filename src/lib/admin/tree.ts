// Aturan pohon kategori (murni, dipakai di browser dan server).
export const MAX_CHILDREN = 8;

// Aturan pohon (murni): maksimal 2 tingkat dan maksimal 8 sub kategori per induk.
export type TreeShape = { id: number; parentId: number | null }[];
export function validateTree(nodes: TreeShape): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.parentId == null) continue;
    if (n.parentId === n.id) return "Kategori tidak bisa menjadi induk dirinya sendiri.";
    const parent = byId.get(n.parentId);
    if (!parent) return "Induk kategori tidak ditemukan.";
    if (parent.parentId != null) return "Kategori maksimal 2 tingkat: sub kategori tidak bisa punya sub kategori.";
  }
  const kids = new Map<number, number>();
  for (const n of nodes) if (n.parentId != null) kids.set(n.parentId, (kids.get(n.parentId) ?? 0) + 1);
  for (const [, k] of kids) if (k > MAX_CHILDREN) return `Maksimal ${MAX_CHILDREN} sub kategori per induk.`;
  return null;
}

