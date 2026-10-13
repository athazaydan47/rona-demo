// Hitungan opname murni (dipakai di browser untuk pratinjau dan di server saat menyimpan).
export type OpnameRow = { variantId: number; onHand: number; reserved: number; counted: number };
export type OpnamePreview = { rows: (OpnameRow & { diff: number; belowReserved: boolean })[]; totalDiff: number; plus: number; minus: number; changed: number; violations: number };

// Selisih opname per baris dan totalnya; stok fisik hasil hitung tidak boleh lebih kecil dari jumlah dipesan.
export function opnamePreview(rows: OpnameRow[]): OpnamePreview {
  const out = rows.map((r) => ({ ...r, diff: r.counted - r.onHand, belowReserved: r.counted < r.reserved }));
  return {
    rows: out,
    totalDiff: out.reduce((s, r) => s + r.diff, 0),
    plus: out.filter((r) => r.diff > 0).reduce((s, r) => s + r.diff, 0),
    minus: out.filter((r) => r.diff < 0).reduce((s, r) => s + r.diff, 0),
    changed: out.filter((r) => r.diff !== 0).length,
    violations: out.filter((r) => r.belowReserved).length,
  };
}

