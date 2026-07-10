// 轻量小礼花：勾掉一条验收标准 / 评审通过时，在元素位置撒一把细碎的青蓝礼花。
// 零依赖，纯 DOM + CSS 动画（keyframes 在 globals.css 的 .confetti-piece）。

const COLORS = ["#35e0d0", "#4cc2ff", "#8ee3ff", "#b8fff4", "#ffffff", "#ffd166"];

export function burstConfetti(anchor: HTMLElement | { x: number; y: number }, count = 18) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  let x: number, y: number;
  if (anchor instanceof HTMLElement) {
    const r = anchor.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else {
    x = anchor.x;
    y = anchor.y;
  }

  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "confetti-piece";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 46 + Math.random() * 64;
    // 向四周炸开，整体略微上飘，收尾带一点下坠感
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist * 0.75 - 34 + Math.random() * 26;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = COLORS[i % COLORS.length];
    el.style.setProperty("--dx", `${dx.toFixed(0)}px`);
    el.style.setProperty("--dy", `${dy.toFixed(0)}px`);
    el.style.setProperty("--rot", `${(Math.random() * 540 - 270).toFixed(0)}deg`);
    el.style.setProperty("--dur", `${(700 + Math.random() * 350).toFixed(0)}ms`);
    if (Math.random() < 0.35) el.style.borderRadius = "50%"; // 混一点圆粒
    document.body.appendChild(el);
    pieces.push(el);
  }
  window.setTimeout(() => pieces.forEach((p) => p.remove()), 1200);
}
