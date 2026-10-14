// Asisten Admin (murni): penerjemah periode WIB, pencocokan nama, penyaringan tool per peran, penghapusan kolom rupiah
// dan penyamaran kontak, penjaga hanya-baca, penjaga angka, saran transfer dan flash sale, pemeriksa klaim deskripsi,
// dan penjaga draf balasan ulasan.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES, type RoleSlug, type StaffPrincipal } from "@/lib/admin/permissions";
import { replyProblems, replySituation, stripProblemSentences } from "@/lib/ai/balasan";
import { checkClaims } from "@/lib/ai/penulis";
import { niceFlashPrice, suggestFlash, type FlashCandidateInput } from "@/lib/flash/saran";
import { niceQuantity, suggestTransfers, type StockCell } from "@/lib/inventory/saran";
import { advisorPerformance, type ReportData } from "@/lib/reports";
import { matchesSource, numbersInText, unsourcedNumbers } from "./angka";
import { matchName, trigramSimilarity, type Candidate } from "./cocok";
import { applyRole, lockedLocations, maskEmail, maskPhone } from "./peran";
import { parsePeriode } from "./periode";
import { tanyaTanggalHariRaya } from "./otak";
import { executeTool, READ_ONLY_TOOLS, TOOL_REGISTRY, toolsFor } from "./tools";

const staff = (roleSlug: RoleSlug, locationIds: number[] = []): StaffPrincipal => ({ id: 9, name: "Uji", email: "uji@rona.demo", roleSlug, isActive: true, grants: [], revokes: [], locationIds });
const iso = (d: Date) => d.toISOString();

describe("penerjemah periode (WIB)", () => {
  // Rabu 14 Okt 2026 10.00 WIB.
  const now = new Date("2026-10-14T03:00:00Z");
  const p = (q: string) => {
    const r = parsePeriode(q, now);
    if (!r.ok) throw new Error(r.message);
    return r.periode;
  };
  it("kosakata sehari-hari dengan batas hari WIB", () => {
    expect([iso(p("hari ini").from), iso(p("hari ini").to)]).toEqual(["2026-10-13T17:00:00.000Z", "2026-10-14T17:00:00.000Z"]);
    expect(p("hari ini").sementara).toBe(true);
    expect([iso(p("kemarin").from), iso(p("kemarin").to), p("kemarin").sementara]).toEqual(["2026-10-12T17:00:00.000Z", "2026-10-13T17:00:00.000Z", false]);
    expect([p("minggu ini").firstDay, p("minggu ini").lastDay]).toEqual(["2026-10-12", "2026-10-14"]); // Senin sampai hari ini
    expect([p("minggu lalu").firstDay, p("minggu lalu").lastDay]).toEqual(["2026-10-05", "2026-10-11"]);
    expect([p("bulan ini").firstDay, p("bulan ini").lastDay]).toEqual(["2026-10-01", "2026-10-14"]);
    expect([p("bulan lalu").firstDay, p("bulan lalu").lastDay, p("bulan lalu").days]).toEqual(["2026-09-01", "2026-09-30", 30]);
    expect([p("30 hari terakhir").firstDay, p("30 hari terakhir").days]).toEqual(["2026-09-15", 30]);
    expect(p("7 hari terakhir").days).toBe(7);
    expect(p("tahun ini").firstDay).toBe("2026-01-01");
    expect(p("kemarin lusa").firstDay).toBe("2026-10-12");
  });
  it("tanggal eksplisit, rentang, dan nama bulan", () => {
    expect([p("1 sampai 7 okt 2026").firstDay, p("1 sampai 7 okt 2026").lastDay]).toEqual(["2026-10-01", "2026-10-07"]);
    expect([p("2026-09-01 sampai 2026-09-10").firstDay, p("2026-09-01 sampai 2026-09-10").days]).toEqual(["2026-09-01", 10]);
    expect(p("14 Okt").firstDay).toBe("2026-10-14");
    expect([p("september 2026").firstDay, p("september 2026").lastDay]).toEqual(["2026-09-01", "2026-09-30"]);
    expect(p("oktober").lastDay).toBe("2026-10-14"); // bulan berjalan dipotong sampai hari ini
    expect(p("november").firstDay).toBe("2025-11-01"); // bulan setelah bulan ini berarti tahun lalu
    expect(p("minggu ini").label).toContain("12 Okt 2026 sampai 14 Okt 2026");
  });
  it("batas 366 hari, periode masa depan, dan kosakata tidak dikenal", () => {
    expect(parsePeriode("400 hari terakhir", now).ok).toBe(false);
    expect(parsePeriode("2025-01-01 sampai 2026-10-01", now).ok).toBe(false);
    expect(parsePeriode("2026-12-01", now).ok).toBe(false);
    expect(parsePeriode("waktu natal", now)).toMatchObject({ ok: false });
  });
  it("tepat setelah tengah malam WIB sudah hari berikutnya", () => {
    const r = parsePeriode("hari ini", new Date("2026-10-13T17:30:00Z"));
    expect(r.ok && r.periode.firstDay).toBe("2026-10-14");
  });
});

describe("hari raya tanpa tanggal selalu ditanya balik", () => {
  it("bertanya balik bila hari raya disebut tanpa tanggal", () => {
    expect(tanyaTanggalHariRaya("Omzet waktu Natal kemarin berapa?")).toMatch(/Natal.*tanggal berapa sampai berapa\?/);
    expect(tanyaTanggalHariRaya("penjualan lebaran tahun ini")).toMatch(/^Periode Lebaran/);
    expect(tanyaTanggalHariRaya("omzet imlek")).not.toBeNull();
  });
  it("tidak bertanya bila tanggal sudah ada atau tidak ada hari raya", () => {
    expect(tanyaTanggalHariRaya("Omzet Natal 20 sampai 26 Des 2025")).toBeNull();
    expect(tanyaTanggalHariRaya("omzet lebaran 28/3 sampai 5/4")).toBeNull();
    expect(tanyaTanggalHariRaya("Omzet minggu ini dibanding minggu lalu")).toBeNull();
    expect(tanyaTanggalHariRaya("stok pernatalan")).toBeNull();
  });
});

describe("pencocokan nama deterministik", () => {
  const products: Candidate[] = [
    { id: 1, name: "Pualam Velvet Matte Cushion SPF 50 02N Gading" },
    { id: 2, name: "Pualam Dewy Glow Cushion SPF 40 02N Gading" },
    { id: 3, name: "Lumi Velvet Matte Lipstick 05 Mawar Tua" },
  ];
  const brands: Candidate[] = [
    { id: 10, name: "Lumi" },
    { id: 11, name: "Pualam" },
  ];
  it("persis lebih dulu, termasuk nama yang juga bagian nama produk", () => {
    expect(matchName("lumi", brands)).toMatchObject({ status: "cocok", item: { id: 10 } });
    expect(matchName("Lumi Velvet Matte Lipstick 05 Mawar Tua", products)).toMatchObject({ status: "cocok", item: { id: 3 } });
  });
  it("banyak cocok tanpa yang persis: ambigu beserta kandidat", () => {
    const m = matchName("cushion shade 02", products);
    expect(m.status).toBe("ambigu");
    if (m.status === "ambigu") expect(m.kandidat.map((k) => k.id).sort()).toEqual([1, 2]);
    expect(matchName("velvet matte cushion 02", products)).toMatchObject({ status: "cocok", item: { id: 1 } });
  });
  it("tidak ditemukan, dan salah ketik ringan lewat trigram", () => {
    expect(matchName("parfum kayu", products).status).toBe("tidak_ditemukan");
    expect(matchName("Pualm", brands)).toMatchObject({ status: "cocok", item: { id: 11 } });
    expect(trigramSimilarity("lumi", "lumi")).toBe(1);
  });
});

describe("pembatasan peran di struktur", () => {
  it("daftar tool disaring can(): staf cabang tanpa tool omzet, owner semua", () => {
    expect(toolsFor(staff("owner")).map((t) => t.name).sort()).toEqual([...READ_ONLY_TOOLS].sort());
    const branch = toolsFor(staff("staf_cabang", [3])).map((t) => t.name);
    expect(branch).not.toContain("ringkasan_penjualan");
    expect(branch).not.toContain("ringkasan_pelanggan");
    expect(branch).toEqual(expect.arrayContaining(["stok_varian", "stok_menipis", "pesanan_perlu_tindakan", "panduan_admin"]));
    expect(toolsFor(staff("gudang")).map((t) => t.name)).not.toContain("saran_flash_sale");
  });
  it("eksekutor menolak tool di luar izin tanpa menjalankannya", async () => {
    const neverDb = new Proxy({}, { get: () => { throw new Error("database tidak boleh disentuh"); } }) as never;
    const r = await executeTool("ringkasan_penjualan", { periode: "hari ini" }, { db: neverDb, staff: staff("staf_cabang", [3]), now: new Date() });
    expect(r).toMatchObject({ ok: false, denied: true, result: { status: "ditolak" } });
    expect(await executeTool("ubah_harga", {}, { db: neverDb, staff: staff("owner"), now: new Date() })).toMatchObject({ denied: true });
  });
  it("kolom rupiah dihapus tanpa izin keuangan, kontak disamarkan tanpa izin kontak", () => {
    const raw = { omzetRp: 1000, pesanan: 3, pembanding: { omzetRp: 900 }, baris: [{ nama: "A", penjualanBarangRp: 5 }], pesananList: [{ nomorWa: "081234567890", email: "budi@contoh.id" }] };
    const admin = applyRole(staff("admin_online"), raw);
    expect(JSON.stringify(admin)).not.toMatch(/Rp"/);
    expect(admin).toMatchObject({ pesanan: 3, catatanIzin: expect.stringContaining("disembunyikan") });
    expect((admin.pesananList as { nomorWa: string }[])[0].nomorWa).toBe("081234567890"); // admin online punya izin kontak
    const branch = applyRole(staff("staf_cabang", [3]), raw);
    expect((branch.pesananList as { nomorWa: string; email: string }[])[0]).toEqual({ nomorWa: maskPhone("081234567890"), email: maskEmail("budi@contoh.id") });
    expect(applyRole(staff("owner"), raw)).toEqual(raw);
  });
  it("staf cabang terkunci ke lokasinya; lokasi lain diabaikan", () => {
    expect(lockedLocations(staff("staf_cabang", [3]), 2)).toEqual({ ids: [3], locked: true, ignored: true });
    expect(lockedLocations(staff("owner"), 2)).toEqual({ ids: [2], locked: false, ignored: false });
    expect(lockedLocations(staff("owner"), null).ids).toBeNull();
  });
});

describe("penjaga hanya-baca", () => {
  it("registri tool sama persis dengan daftar izin baca, tanpa nama berkata kerja mutasi", () => {
    expect([...TOOL_REGISTRY.keys()].sort()).toEqual([...READ_ONLY_TOOLS].sort());
    const verbs = /(^|_)(buat|ubah|hapus|batal|batalkan|tambah|kirim|simpan|set|update|delete|create|insert|ganti|pindah|pindahkan|terapkan|setujui)(_|$)/;
    for (const name of READ_ONLY_TOOLS) expect(name, name).not.toMatch(verbs);
    expect(Object.keys(ROLE_TEMPLATES)).toHaveLength(4);
  });
  it("modul asisten tidak mengimpor fungsi tulis dan tidak menulis ke database sendiri", () => {
    const WRITE = /\b(transferStock|receiveStock|submitOpname|changeOrderStatus|processSelected|placeOrder|confirmPayment|createFlashSlot|saveFlashItem|removeFlashItem|setFlashSlotActive|saveVoucher|setVoucherActive|saveBanner|saveProduct|deleteProduct|duplicateProduct|replyReview|hideReviews|deleteReply|adjustPoints|addItems|lockInventory|saveSettings|saveStaff)\b/;
    const files = readdirSync("src/lib/asisten", { recursive: true }).map(String).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(`src/lib/asisten/${f}`, "utf8");
      const imports = src.match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports, f).not.toMatch(WRITE);
      expect(src, f).not.toMatch(/\.(insert|update|delete)\(/);
    }
  });
});

describe("penjaga angka", () => {
  it("normalisasi rupiah, juta, persen, dan desimal Indonesia", () => {
    expect(numbersInText("Omzet Rp 12.345.678, naik 12,5% dari Rp 12,3 juta, 45 pesanan").map((n) => [n.kind, n.value])).toEqual([
      ["rupiah", 12345678],
      ["persen", 12.5],
      ["rupiah", 12300000],
      ["biasa", 45],
    ]);
  });
  it("angka teks harus ada di hasil tool (dengan pembulatan yang wajar)", () => {
    const tool = [{ omzetRp: 12_345_678, perubahanPersen: { omzet: -12.46 }, pesanan: 45, periode: "minggu ini (12 Okt 2026 sampai 14 Okt 2026)" }];
    expect(unsourcedNumbers(["Omzet minggu ini (12 Okt 2026 sampai 14 Okt 2026) Rp 12.345.678 dari 45 pesanan, turun 12,5%. Sekitar Rp 12,3 juta."], tool)).toEqual([]);
    expect(unsourcedNumbers(["Omzet Rp 13.000.000 dan naik 20%."], tool)).toEqual(["Rp 13.000.000", "20%"]);
    expect(matchesSource({ raw: "3", value: 3, kind: "biasa", scale: 1 }, [])).toBe(true); // bilangan hitung kecil
    expect(matchesSource({ raw: "Rp 3", value: 3, kind: "rupiah", scale: 1 }, [])).toBe(false);
  });
});

describe("saran transfer stok (deterministik)", () => {
  const locations = [
    { id: 1, name: "Gudang Online", type: "gudang" },
    { id: 2, name: "Rona Dinoyo", type: "toko" },
    { id: 3, name: "Rona Sawojajar", type: "toko" },
  ];
  const variants = new Map([[7, { variantId: 7, productName: "Cushion", shadeName: "02N", sku: "C-02N" }]]);
  const cell = (locationId: number, available: number, sold: number): StockCell => ({ variantId: 7, locationId, available, sold });
  const o = { kurangHari: 7, lebihHari: 30, keepMin: 5 };
  it("cabang yang akan habis mendapat transfer dari gudang yang berlebih, tanpa membuat asal kekurangan", () => {
    // Dinoyo laku 1 per hari (14 dalam 14 hari), sisa 3: habis dalam 3 hari. Gudang 120 pcs, laku 1 per hari (cukup 120 hari).
    const [s] = suggestTransfers([cell(1, 120, 14), cell(2, 3, 14), cell(3, 40, 2)], locations, variants, o);
    expect(s).toMatchObject({ fromId: 1, toId: 2, toDaysLeft: 3, quantity: 10 }); // butuh 14 - 3 = 11, dibulatkan ke 10
    expect(s.alasan).toContain("habis dalam sekitar 3 hari");
    expect(120 - s.quantity).toBeGreaterThanOrEqual(30); // asal tetap menyimpan stok 30 hari
  });
  it("tidak ada saran bila tidak ada lokasi yang berlebih, atau penjualan terlalu sedikit", () => {
    expect(suggestTransfers([cell(1, 20, 14), cell(2, 3, 14)], locations, variants, o)).toEqual([]);
    expect(suggestTransfers([cell(1, 120, 0), cell(2, 0, 1)], locations, variants, o)).toEqual([]);
  });
  it("jumlah dibulatkan wajar dan tidak melebihi kelebihan asal", () => {
    expect(niceQuantity(23, 100)).toBe(20);
    expect(niceQuantity(7, 100)).toBe(7);
    expect(niceQuantity(30, 12)).toBe(10);
    expect(niceQuantity(5, 0)).toBe(0);
  });
});

describe("saran flash sale (deterministik)", () => {
  const c = (over: Partial<FlashCandidateInput>): FlashCandidateInput => ({ variantId: 1, productId: 1, productName: "Lip", shadeName: "01", normalPrice: 100_000, effectivePrice: 90_000, onlineStock: 60, sold30: 0, rating: 4.7, reviewCount: 5, recentlyFlashed: false, ...over });
  it("lambat laku dan stok banyak di atas, yang baru ikut flash atau rating buruk tidak diusulkan", () => {
    const list = suggestFlash([c({ variantId: 1, sold30: 18 }), c({ variantId: 2, sold30: 0 }), c({ variantId: 3, recentlyFlashed: true }), c({ variantId: 4, rating: 3.2 }), c({ variantId: 5, onlineStock: 4 })], { minDiscount: 15, maxDiscount: 30 });
    expect(list.map((x) => x.variantId)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ discountPercent: 30, quota: 15 });
    expect(list[0].flashPrice).toBeLessThan(90_000);
    expect(list[1].discountPercent).toBe(15);
  });
  it("harga flash rapi dan selalu di bawah harga efektif", () => {
    expect(niceFlashPrice(100_000, 90_000, 30)).toBe(69_900);
    expect(niceFlashPrice(100_000, 80_000, 10)).toBeLessThan(80_000);
  });
});

describe("pemeriksa klaim deskripsi", () => {
  const ctx = { activeIngredients: ["Niacinamide 10%", "Zinc PCA"], reference: "Ringan, cepat meresap. Tahan 12 jam.", spf: null, netto: "30 ml", avoid: ["kak"] };
  it("kalimat aman lolos", () => {
    expect(checkClaims("Serum ringan dengan niacinamide yang cepat meresap. Tahan 12 jam di kulit.", ctx)).toEqual([]);
  });
  it("bahan di luar daftar, angka tanpa acuan, dan klaim terlarang ditandai beserta alasannya", () => {
    const issues = checkClaims("Mengandung retinol untuk tekstur halus. Mencerahkan dalam 7 hari dengan 99% kepuasan. Dijamin menyembuhkan jerawat.", ctx);
    expect(issues).toHaveLength(3);
    expect(issues[0].alasan).toContain("retinol");
    expect(issues[1].alasan).toContain("7 hari"); // satuan hari ikut diperiksa sejak Fase 8A
    expect(issues[2].alasan).toContain("terlarang");
    expect(checkClaims("Isi bersih 30 ml, cukup untuk 2 bulan.", ctx)[0].alasan).toContain("2 bulan");
    expect(checkClaims("Isi bersih 30 ml.", ctx)).toEqual([]);
    expect(checkClaims("SPF 50 melindungi seharian.", ctx)[0].alasan).toContain("SPF 50");
    expect(checkClaims("Cocok juga untuk kakao lover.", ctx)).toEqual([]); // kata dihindari dicek per kata
    expect(checkClaims("Halo kak, ini serum ringan.", ctx)[0].alasan).toContain("kak");
  });
});

describe("draf balasan ulasan", () => {
  it("situasi ditentukan di kode", () => {
    expect(replySituation({ rating: 5, body: "Suka banget, lembap" })).toBe("pujian");
    expect(replySituation({ rating: 2, body: "Paket datang bocor dan penyok" })).toBe("pengiriman");
    expect(replySituation({ rating: 3, body: "Shade terlalu gelap untukku" })).toBe("salah_shade");
    expect(replySituation({ rating: 2, body: "Bikin kulitku kering" })).toBe("keluhan_produk");
  });
  it("janji uang, menyalahkan pembeli, dan klaim medis ditandai lalu dibuang", () => {
    const t = "Maaf ya. Kami akan kembalikan uang kamu, refund penuh. Seharusnya kamu baca petunjuk. Produk ini menyembuhkan jerawat. Hubungi kami lewat WA.";
    expect(replyProblems(t)).toHaveLength(3);
    expect(stripProblemSentences(t)).toBe("Maaf ya. Hubungi kami lewat WA.");
  });
});

describe("atribusi Advisor di laporan", () => {
  it("pesanan dengan item Advisor, penjualan itemnya, dan rata-rata dengan atau tanpa", () => {
    const range = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-08T00:00:00Z") };
    const order = (id: number, total: number) => ({ id, number: `N${id}`, createdAt: new Date("2026-10-02T00:00:00Z"), paidAt: new Date("2026-10-02T01:00:00Z"), status: "selesai", method: "kirim" as const, locationId: 1, locationName: "G", paymentMethod: "qris", courier: null, customerId: null, buyerKey: `t:${id}`, buyerName: "", subtotal: total, productDiscount: 0, voucherDiscount: 0, shippingCost: 0, shippingDiscount: 0, voucherShippingDiscount: 0, pointsUsed: 0, total, voucherCode: null });
    const item = (orderId: number, source: string | null, price: number) => ({ orderId, variantId: 1, sku: "", productId: 1, productName: "", productSlug: "", shadeName: "", hex: "", packaging: "", brandId: 1, brandName: "", brandColor: "", categoryId: 1, categoryName: "", parentCategoryName: "", quantity: 1, unitPrice: price, normalPrice: price, priceSource: "normal", flashSaleItemId: null, source });
    const data = { range, orders: [order(1, 200_000), order(2, 100_000), order(3, 300_000)], items: [item(1, "advisor", 80_000), item(1, null, 120_000), item(2, null, 100_000), item(3, "rutinitas", 300_000)], firstRevenueAt: new Map(), flashSlots: [], vouchers: [], advisor: { conversations: 40, cartAdds: 9 } } as ReportData;
    expect(advisorPerformance(data)).toEqual({ conversations: 40, cartAdds: 9, orders: 1, ordersShare: 33.3, itemSales: 80_000, aovWith: 200_000, aovWithout: 200_000, ordersWithout: 2 });
  });
});

describe("label tabel asisten (Fase 8A)", () => {
  it("kepala kolom selalu label manusia, bukan camelCase atau snake_case", async () => {
    const { humanizeHeader, looksMachine, formatCell } = await import("./label");
    for (const k of ["penjualanBarangRp", "jumlah_pesanan", "unit", "merek", "nama", "omzetRp", "stok_tersedia"]) {
      const h = humanizeHeader(k);
      expect(looksMachine(h), `${k} -> ${h}`).toBe(false);
      expect(h).not.toMatch(/[a-z][A-Z]|_/);
    }
    expect(humanizeHeader("penjualanBarangRp")).toBe("Penjualan barang");
    expect(formatCell("penjualanBarangRp", "1290000")).toBe("Rp 1.290.000");
    expect(formatCell("unit", "12")).toBe("12");
  });
});
