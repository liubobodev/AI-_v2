"use client";

import { useEffect, useRef } from "react";
import ProgressRing from "@/components/ProgressRing";
import RatingLamp from "@/components/RatingLamp";
import { burstConfetti } from "@/lib/confetti";
import { GATE_NAMES, GATE_ICONS } from "@/lib/gateTypes";
import type { GateProgress, InterviewResult } from "@/lib/studentTypes";
import { computeGateRating, type GateRating, type ModuleRating, type Tier } from "@/lib/rating";

function doorsLit(g?: GateProgress): number {
  if (!g?.doors) return 0;
  return [g.doors.selfCheck, g.doors.submissionApproved, g.doors.interviewPassed].filter(Boolean).length;
}

/** 回放时用：构造一关全优秀 / 全暗的合成评级 */
function syntheticRating(excellent: boolean): GateRating {
  const mk = (kind: ModuleRating["kind"]): ModuleRating =>
    excellent
      ? { kind, tier: 3, score: 96, done: true, detail: "回放：优秀" }
      : { kind, tier: 0, score: null, done: false, detail: "" };
  return {
    self: mk("self"), review: mk("review"), interview: mk("interview"),
    overall: (excellent ? 3 : 0) as Tier, overallDone: excellent, avgScore: excellent ? 96 : null,
  };
}

/** 右上角单关总评标识 */
function OverallBadge({ tier }: { tier: Tier }) {
  if (tier === 0) return null;
  if (tier === 1) {
    return (
      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[12px] text-slate-300">
        ✓
      </span>
    );
  }
  if (tier === 2) {
    return (
      <span
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/40 bg-slate-200/10 text-[15px] silver-glow"
        style={{ color: "#e2e8f0" }}
        title="良好"
      >
        ★
      </span>
    );
  }
  // 优秀：金冠 + 弹跳
  return (
    <span
      className="crown-bounce absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[18px]"
      style={{
        background: "radial-gradient(circle at 50% 40%, rgba(255,215,0,0.25), transparent 70%)",
        filter: "drop-shadow(0 0 8px rgba(255,215,0,0.7))",
      }}
      title="优秀"
    >
      👑
    </span>
  );
}

export default function GateMap({
  currentGate,
  gateProgress,
  interviewResults,
  onEnter,
  replayStep = null,
  onStartReplay,
}: {
  currentGate: number;
  gateProgress: GateProgress[];
  interviewResults: InterviewResult[];
  onEnter: (gate: number) => void;
  replayStep?: number | null; // null=正常；0..8=回放已点亮到第几关
  onStartReplay?: () => void;
}) {
  const replaying = replayStep !== null;
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 回放：每点亮一关，在该卡片撒一把礼花
  useEffect(() => {
    if (replayStep && replayStep >= 1 && replayStep <= 8) {
      const el = cardRefs.current[replayStep - 1];
      if (el) burstConfetti(el, 20);
    }
  }, [replayStep]);

  const totalDone = gateProgress.filter((g) => g.status === "completed").length;
  const excellentCount = gateProgress.filter((g) => {
    const r = computeGateRating(g, interviewResults);
    return r.overall === 3;
  }).length;
  const ratings = gateProgress.map((g) => computeGateRating(g, interviewResults));
  const scored = ratings.filter((r) => typeof r.avgScore === "number");
  const estimatedScore = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + (r.avgScore ?? 0), 0) / scored.length)
    : 0;
  const medalPreview = estimatedScore >= 90
    ? "AI科创达人"
    : estimatedScore >= 82
      ? "AI数智匠心"
      : estimatedScore >= 70
        ? "AI智汇新锐"
        : "待定";

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white md:text-2xl">闯关地图</h1>
          <p className="mt-1 text-[13px] text-muted">
            每关三档灯:<span className="text-emerald-400">自检</span> · <span className="text-sky-400">评审</span> · <span style={{ color: "#ffd700" }}>面试</span>。
            灯越亮质量越高，金冠代表优秀。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <span className="rounded-full border border-accent2/30 bg-accent2/5 px-2.5 py-1 text-accent2">
              当前预估总分：{estimatedScore ? `${estimatedScore}分` : "等待首个评分"}
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/5 px-2.5 py-1 text-amber-200">
              勋章预告：{medalPreview}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          {onStartReplay && excellentCount >= 8 && (
            <button
              onClick={onStartReplay}
              disabled={replaying}
              className="btn-spring glow-hover self-center rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200 disabled:opacity-50"
              style={{ boxShadow: "0 0 14px rgba(255,215,0,0.2)" }}
            >
              🏆 {replaying ? "回放中…" : "八冠回放"}
            </button>
          )}
          {excellentCount > 0 && (
            <div>
              <div className="font-mono text-2xl font-bold" style={{ color: "#ffd700" }}>{excellentCount}</div>
              <div className="text-[11px] text-muted">👑 优秀</div>
            </div>
          )}
          <div>
            <div className="font-mono text-2xl font-bold text-accent">{totalDone}<span className="text-muted text-base">/8</span></div>
            <div className="text-[11px] text-muted">已通关</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
          const g = gateProgress.find((x) => x.gate === n);
          const active = n === currentGate;
          // 回放模式：用合成评级逐个点亮；否则用真实评级
          const rating: GateRating = replaying
            ? syntheticRating((replayStep as number) >= n)
            : computeGateRating(g, interviewResults);
          const lit = replaying ? (rating.overall === 3 ? 3 : 0) : doorsLit(g);
          const excellent = rating.overall === 3;
          const good = rating.overall === 2;

          return (
            <button
              key={n}
              ref={(el) => { cardRefs.current[n - 1] = el; }}
              onClick={() => !replaying && onEnter(n)}
              className={[
                "group card-lift glass relative rounded-2xl p-4 pt-4 text-left",
                excellent
                  ? "excellent-band !border-amber-300/50 shadow-[0_0_20px_rgba(255,215,0,0.22)] -translate-y-1 scale-[1.015]"
                  : good
                  ? "!border-slate-300/40"
                  : active
                  ? "!border-accent2/60 shadow-glow animate-badge-pulse"
                  : rating.overall === 1
                  ? "!border-accent/30"
                  : "hover:!border-accent2/30",
                excellent ? "overflow-visible" : "overflow-hidden",
              ].join(" ")}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{GATE_ICONS[n]}</span>
                  <div>
                    <div className="font-mono text-[11px] text-muted">第 {n} 关</div>
                    <div className="text-[13.5px] font-semibold text-white">{GATE_NAMES[n]}</div>
                  </div>
                </div>
                <ProgressRing lit={lit} />
              </div>

              {/* 三档评级灯标 */}
              <div className="flex gap-1.5">
                <RatingLamp r={rating.self} />
                <RatingLamp r={rating.review} />
                <RatingLamp r={rating.interview} />
              </div>

              {/* 当前关标记（未拿评级时才显示，避免和评级徽章打架） */}
              {active && rating.overall === 0 && (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-accent2 px-1.5 py-0.5 text-[9px] font-bold text-base shadow-[0_0_10px_rgba(76,194,255,0.7)]">
                  当前
                </span>
              )}
              {/* 单关总评标识 */}
              <OverallBadge tier={rating.overall} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
