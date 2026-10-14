"use client";

// Animasi produk "terbang" ke ikon keranjang. Mengikuti prefers-reduced-motion.
export function flyToCart(source: HTMLElement | null) {
  if (!source) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = [...document.querySelectorAll<HTMLElement>("[data-cart-icon]")].filter((el) => el.getClientRects().length > 0);
  const target = targets[0];
  if (!target) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  clone.dataset.terbang = "1"; // penanda untuk uji kurangi gerakan
  const size = Math.min(from.width, 160);
  Object.assign(clone.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size * 0.6}px`,
    width: `${size}px`,
    height: `${size * 1.2}px`,
    margin: "0",
    zIndex: "70",
    pointerEvents: "none",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 18px 40px rgb(42 31 29 / 0.25)",
  } as CSSStyleDeclaration);
  document.body.appendChild(clone);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = clone.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(0.55)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 },
    ],
    { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    clone.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
  };
}
