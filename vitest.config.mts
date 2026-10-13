import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Uji integrasi berbagi satu database lokal (penghitung nomor pesanan, stok, flash sale),
    // jadi berkas uji dijalankan berurutan supaya hasilnya deterministik.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
