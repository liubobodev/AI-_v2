"use client";

import type { ModuleRating, Tier } from "@/lib/rating";
import { TIER_LABEL } from "@/lib/rating";

const KIND_LABEL: Record<ModuleRating["kind"], string> = {
  self: "自检", review: "评审", interview: "面试",
};

// 每个模块四档颜色（0 未完成 / 1 及格 / 2 良好 / 3 优秀）
const PALETTE: Record<ModuleRating["kind"], [string, string, string, string]> = {
  self:      ["#4b5563", "#86efac", "#22c55e", "#4ade80"], // 绿
  review:    ["#4b5563", "#93c5fd", "#3b82f6", "#38bdf8"], // 蓝
  interview: ["#4b5563", "#fdba74", "#fb923c", "#ffd700"], // 橙→鎏金
};

// 每档发光强度（box-shadow 半径）
const GLOW: Record<Tier, string> = {
  0: "none",
  1: "0 0 5px var(--lamp)",
  2: "0 0 8px var(--lamp), 0 0 16px var(--lamp)",
  3: "0 0 10px var(--lamp), 0 0 22px var(--lamp)",
};

export default function RatingLamp({ r }: { r: ModuleRating }) {
  const color = PALETTE[r.kind][r.tier];
  const excellent = r.tier === 3;

  // 优秀档的专属动画类
  const animClass =
    r.tier === 3 && r.kind === "self" ? "lamp-breathe" :
    r.tier === 3 && r.kind === "interview" ? "lamp-gold" : "";

  return (
    <div className="group/lamp relative flex-1">
      <div
        className={[
          "flex items-center justify-center gap-1 rounded-md border px-1 py-1 transition-all duration-300",
          r.tier === 0 ? "border-border/30 bg-border/10" : "border-white/10",
        ].join(" ")}
        style={{
          background: r.tier === 0 ? undefined : `${color}1a`,
        }}
      >
        {/* 灯珠 */}
        <span
          className={["relative h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300", animClass].join(" ")}
          style={
            {
              background: color,
              opacity: r.tier === 0 ? 0.45 : 1,
              boxShadow: r.tier === 0 ? "none" : GLOW[r.tier],
              // CSS 变量喂给动画
              ["--lamp" as any]: color,
            } as React.CSSProperties
          }
        >
          {/* 评审·优秀：蓝色流动光扫过灯珠 */}
          {excellent && r.kind === "review" && (
            <span className="lamp-flow absolute inset-0 rounded-full" />
          )}
          {/* 面试·优秀：鎏金粒子流光 */}
          {excellent && r.kind === "interview" && (
            <>
              <span className="gold-sparkle" style={{ ["--sx" as any]: "8px", ["--sy" as any]: "-9px", animationDelay: "0s", left: "50%", top: "50%" }} />
              <span className="gold-sparkle" style={{ ["--sx" as any]: "-9px", ["--sy" as any]: "-6px", animationDelay: "0.5s", left: "50%", top: "50%" }} />
              <span className="gold-sparkle" style={{ ["--sx" as any]: "6px", ["--sy" as any]: "9px", animationDelay: "0.9s", left: "50%", top: "50%" }} />
            </>
          )}
        </span>
        <span
          className="text-[10px] font-medium leading-none transition-colors duration-300"
          style={{ color: r.tier === 0 ? "#7c8598" : color }}
        >
          {KIND_LABEL[r.kind]}
        </span>
      </div>

      {/* 悬停 tooltip */}
      <div className="rating-tip pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0d1119]/95 px-2.5 py-2 text-left shadow-xl backdrop-blur group-hover/lamp:block">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white">{KIND_LABEL[r.kind]}</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>
            {TIER_LABEL[r.tier]}
          </span>
        </div>
        <div className="text-[11px] leading-relaxed text-muted">
          {r.detail}
          {typeof r.score === "number" && (
            <div className="mt-0.5 font-mono text-[12px]" style={{ color }}>得分 {r.score}</div>
          )}
        </div>
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-[#0d1119]" />
      </div>
    </div>
  );
}
