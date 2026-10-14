// Endpoint transkripsi Asisten Admin dengan model mock: tanpa sesi staf ditolak 401, rekaman sah menjadi teks, dan
// kegagalan (format salah, model gagal, galat tak terduga) tidak pernah menjadi 500.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const staffRef: { current: unknown } = { current: null };
const modelRef: { kind: "mock" | "rusak" } = { kind: "mock" };
vi.mock("@/lib/admin/current", () => ({ currentStaff: async () => staffRef.current }));
vi.mock("@/lib/security/origin", () => ({ rejectCrossOrigin: () => null }));
vi.mock("@/lib/ai/usage", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/usage")>()), checkDailyFeatureLimit: async () => ({ ok: true }), logAi: async () => {} }));
vi.mock("@/lib/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/ai")>();
  const { withStream } = await import("@/lib/ai/client");
  return { ...real, aiModel: () => (modelRef.kind === "mock" ? real.aiModel("asistenAdmin", { ...real.aiConfig({ AI_PROVIDER: "mock" }) }) : withStream({ name: "rusak", generate: async () => Promise.reject(new Error("HTTP 503")) })) };
});

const post = async (body?: FormData) => {
  const { POST } = await import("./route");
  return POST(new Request("http://localhost:3000/api/admin/asisten/transkripsi", { method: "POST", body: body ?? new FormData() }) as never);
};
const audio = (bytes: number[]) => {
  const f = new FormData();
  f.append("audio", new Blob([new Uint8Array(bytes)], { type: "audio/webm" }), "suara");
  return f;
};

describe("endpoint transkripsi", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", process.env.DATABASE_URL || "postgres://uji@127.0.0.1:1/tidak-dipakai");
    vi.stubEnv("AI_PROVIDER", "mock");
    modelRef.kind = "mock";
  });
  afterEach(() => vi.unstubAllEnvs());

  it("tanpa sesi staf ditolak 401", async () => {
    staffRef.current = null;
    const r = await post(audio([0x1a, 0x45, 0xdf, 0xa3]));
    expect(r.status).toBe(401);
  });
  it("rekaman sah menjadi teks untuk kotak ketik", async () => {
    staffRef.current = { id: 1, name: "Uji", roleSlug: "owner", isActive: true, grants: [], revokes: [], locationIds: [] };
    const r = await post(audio([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, teks: "Omzet minggu ini dibanding minggu lalu" });
  });
  it("format salah, tanpa berkas, dan model gagal dijawab rapi, bukan 500", async () => {
    staffRef.current = { id: 1, name: "Uji", roleSlug: "owner", isActive: true, grants: [], revokes: [], locationIds: [] };
    expect((await post(audio([1, 2, 3, 4]))).status).toBe(422);
    expect((await post()).status).toBe(400);
    modelRef.kind = "rusak";
    const r = await post(audio([0x1a, 0x45, 0xdf, 0xa3, 1]));
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ ok: false, message: expect.stringContaining("Ketik") });
  });
});
