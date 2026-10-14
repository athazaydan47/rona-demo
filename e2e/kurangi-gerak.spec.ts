import { expect, test } from "@playwright/test";
import { addToCart, pickVariants } from "./helpers";

// Dengan prefers-reduced-motion: tidak ada animasi transform yang berjalan saat tambah ke keranjang, laci terbuka,
// dan kartu katalog masuk. Animasi opacity singkat masih boleh.
test.use({ reducedMotion: "reduce" });

async function transformAnimations(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        const eff = a.effect as KeyframeEffect | null;
        const frames = eff?.getKeyframes?.() ?? [];
        const timing = eff?.getComputedTiming?.();
        const dur = typeof timing?.duration === "number" ? timing.duration : 0;
        return dur > 20 && frames.some((k) => "transform" in k || "translate" in k || "scale" in k);
      })
      .map((a) => ((a.effect as KeyframeEffect).target as HTMLElement | null)?.tagName ?? "?"),
  );
}

test("kurangi gerakan: tanpa animasi transform di katalog, tambah ke keranjang, dan laci", async ({ page }) => {
  await page.goto("/c/bibir");
  await page.waitForLoadState("networkidle");
  expect(await transformAnimations(page)).toEqual([]);
  const [pick] = await pickVariants("gudang-online", null, 2, 1);
  await page.goto(`/p/${pick.productSlug}?shade=${pick.shadeSlug}`);
  await page.getByRole("button", { name: "Tambah ke Keranjang", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Keranjang/ })).toBeVisible();
  expect(await transformAnimations(page)).toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll("[data-terbang]").length)).toBe(0); // tiruan terbang tidak dibuat
  await page.keyboard.press("Escape");
  await addToCart(page, pick);
});
