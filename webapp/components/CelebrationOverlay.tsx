"use client";

import { useEffect } from "react";
import { burstConfetti } from "@/lib/confetti";

export type Celebration =
  | { kind: "levelup"; title: string; sub: string; icon: string; color: string }
  | { kind: "gate_excellent"; title: string; sub: string; icon: string; color: string }
  | {
      kind: "ai_medal";
      title: string;
      sub: string;
      color: string;
      accent: string;
      medalName: string;
      studentName: string;
      signal: string;
      stats: { label: string; value: string }[];
    };

/** 全屏庆祝：升级 / 单关优秀。奖章弹跳 + 光芒射线 + 礼花，点击或 4 秒后关闭。 */
export default function CelebrationOverlay({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const c = celebration;

  useEffect(() => {
    // 连撒两波礼花
    const fire = () => burstConfetti({ x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 34);
    fire();
    const t1 = window.setTimeout(fire, 350);
    const t2 = window.setTimeout(onClose, 5200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [onClose]);

  const bannerText =
    c.kind === "levelup" ? "LEVEL UP" :
    c.kind === "ai_medal" ? "AI MEDAL AWARDED" :
    "优秀 · EXCELLENT";

  if (c.kind === "ai_medal") {
    return (
      <div
        className="overlay-fade ai-medal-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/78 backdrop-blur-md"
        onClick={onClose}
      >
        <div className="ai-medal-grid" aria-hidden="true" />
        <div className="relative flex w-full max-w-3xl flex-col items-center px-5" onClick={(e) => e.stopPropagation()}>
          <div className="ai-medal-rays" style={{ ["--ray" as string]: `${c.color}66`, ["--ray2" as string]: `${c.accent}55` }} />
          <div className="ai-medal-orbit orbit-one" style={{ ["--orbit" as string]: `${c.color}66` }} />
          <div className="ai-medal-orbit orbit-two" style={{ ["--orbit" as string]: `${c.accent}66` }} />

          <div
            className="ai-medal-core medal-pop"
            style={{
              ["--medal" as string]: c.color,
              ["--medal2" as string]: c.accent,
              ["--halo" as string]: `${c.color}55`,
              ["--halo2" as string]: `${c.accent}24`,
            }}
          >
            <span className="ai-medal-circuit circuit-a" />
            <span className="ai-medal-circuit circuit-b" />
            <span className="ai-medal-circuit circuit-c" />
            <span className="ai-medal-ring" />
            <span className="ai-medal-mark">AI</span>
            <span className="ai-medal-name">{c.medalName.replace(/^AI/, "")}</span>
          </div>

          <div
            className="rise-in relative z-10 mt-7 rounded-full px-4 py-1 font-mono text-[12px] font-bold tracking-[0.16em]"
            style={{ background: `${c.color}22`, color: c.color, boxShadow: `0 0 0 1px ${c.color}44, 0 0 24px ${c.accent}22` }}
          >
            {bannerText}
          </div>

          <h2 className="rise-in ai-medal-title relative z-10 mt-5 text-center text-2xl font-extrabold text-white md:text-4xl">
            {c.title}
          </h2>
          <p className="rise-in relative z-10 mt-3 max-w-2xl text-center text-[14px] leading-7 text-slate-300 md:text-[15px]">
            {c.sub}
          </p>

          <div className="rise-in relative z-10 mt-5 grid w-full max-w-lg grid-cols-3 gap-2">
            {c.stats.map((stat) => (
              <div key={stat.label} className="ai-medal-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="btn-spring rise-in relative z-10 mt-7 rounded-full border border-white/20 bg-white/5 px-6 py-2 text-[13px] font-semibold text-white hover:bg-white/10"
          >
            收下勋章
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overlay-fade fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {/* 光芒射线 */}
        <div className="rays" style={{ ["--ray" as string]: `${c.color}55` }} />

        {/* 奖章 */}
        <div
          className="medal-pop medal-halo relative z-10 flex h-32 w-32 items-center justify-center rounded-full text-[64px]"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${c.color}33, ${c.color}0d 70%)`,
            ["--halo" as string]: `${c.color}55`,
            ["--halo2" as string]: `${c.color}22`,
          }}
        >
          {c.icon}
        </div>

        {/* 横幅 */}
        <div
          className="rise-in relative z-10 mt-6 rounded-full px-4 py-1 font-mono text-[13px] font-bold tracking-[0.2em]"
          style={{ background: `${c.color}22`, color: c.color, boxShadow: `0 0 0 1px ${c.color}44` }}
        >
          {bannerText}
        </div>

        {/* 标题 + 副标题 */}
        <h2 className="rise-in relative z-10 mt-4 text-center text-2xl font-extrabold text-white md:text-3xl">{c.title}</h2>
        <p className="rise-in relative z-10 mt-2 max-w-xs text-center text-[14px] text-muted">{c.sub}</p>

        <button
          onClick={onClose}
          className="btn-spring rise-in relative z-10 mt-7 rounded-full border border-white/20 bg-white/5 px-6 py-2 text-[13px] font-semibold text-white hover:bg-white/10"
        >
          继续闯关 →
        </button>
      </div>
    </div>
  );
}
