// Fitur dimatikan lewat NEXT_PUBLIC_FITUR_NONAKTIF (Fase 8B): menu, halaman, tool AI, dan aturan server terkait ikut
// hilang. Modul dimuat ulang setelah env diatur karena sakelar dibaca saat modul dimuat (sama seperti saat build).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const SEMUA_MATI = "aiPembeli,aiFotoLink,asistenAdmin,flashSale,poin,ambilDiToko,multiCabang";

describe("semua fitur opsional dimatikan", () => {
  beforeAll(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_FITUR_NONAKTIF", SEMUA_MATI);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sakelar terbaca mati", async () => {
    const { semuaFitur } = await import("./fitur");
    expect(Object.values(semuaFitur()).some(Boolean)).toBe(false);
  });

  it("menu: Toko kami, Flash Sale, dan Poin tersembunyi; langkah panduan flash dan Advisor hilang", async () => {
    const { HELP_LINKS } = await import("@/lib/content/bantuan");
    expect(HELP_LINKS.map((l) => l.href)).not.toContain("/toko");
    const { ACCOUNT_MENU } = await import("@/components/account/account-nav");
    expect(ACCOUNT_MENU.map((m) => m.href)).not.toContain("/akun/poin");
    const { LANGKAH } = await import("@/lib/demo/panduan");
    expect(LANGKAH.map((l) => l.id)).not.toContain("flash");
    expect(LANGKAH.map((l) => l.id)).not.toContain("advisor");
  });

  it("AI: model tidak tersedia walau kunci AI ada", async () => {
    const { aiConfig, aiModel, aiTersedia } = await import("@/lib/ai");
    const cfg = aiConfig({ AI_PROVIDER: "mock" });
    for (const f of ["aiPembeli", "aiFotoLink", "asistenAdmin"] as const) {
      expect(aiModel(f, cfg)).toBeNull();
      expect(aiTersedia(f, cfg)).toBe(false);
    }
  });

  it("Asisten Admin: tool flash sale, transfer, dan Advisor tidak diberikan ke model", async () => {
    const { toolsFor } = await import("@/lib/asisten/tools");
    const owner = { id: 1, name: "Owner", email: "o@x", roleSlug: "owner" as const, isActive: true, grants: [], revokes: [], locationIds: [] };
    const names = toolsFor(owner).map((t) => t.name);
    expect(names).not.toContain("saran_flash_sale");
    expect(names).not.toContain("kinerja_flash_sale");
    expect(names).not.toContain("saran_transfer_stok");
    expect(names).not.toContain("kinerja_advisor");
    expect(names).toContain("ringkasan_penjualan");
  });

  it("server: harga flash tidak dimuat, Ambil di Toko ditolak", async () => {
    const { loadLiveFlash } = await import("@/lib/orders/pricing-loader");
    const db = new Proxy({}, { get: () => () => Promise.reject(new Error("database tidak boleh disentuh")) });
    const out = await loadLiveFlash(db as never, [1, 2, 3], { customerId: null, phone: "" } as never, new Date());
    expect(out.size).toBe(0);
    const { pickupAktif, DEFAULT_SETTINGS } = await import("@/lib/settings");
    expect(pickupAktif(DEFAULT_SETTINGS)).toBe(false);
    const { flashSaleGate } = await import("@/lib/flash/gate");
    expect(flashSaleGate()).toBeDefined();
  });
});

describe("semua fitur aktif (bawaan)", () => {
  it("tool, menu, dan Ambil di Toko tersedia", async () => {
    vi.resetModules();
    const { toolsFor } = await import("@/lib/asisten/tools");
    const owner = { id: 1, name: "Owner", email: "o@x", roleSlug: "owner" as const, isActive: true, grants: [], revokes: [], locationIds: [] };
    expect(toolsFor(owner).map((t) => t.name)).toContain("saran_flash_sale");
    const { pickupAktif, DEFAULT_SETTINGS } = await import("@/lib/settings");
    expect(pickupAktif(DEFAULT_SETTINGS)).toBe(true);
    const { flashSaleGate } = await import("@/lib/flash/gate");
    expect(flashSaleGate()).toBeUndefined();
  });
});
