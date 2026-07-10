"use client";

import type { StudentProfile } from "@/lib/studentTypes";
import { xpProgress } from "@/lib/gamification";

/** 常驻经验/段位/连击条：放在主内容区顶部，随时可见的成长展示 */
export default function RewardHud({ profile }: { profile: StudentProfile }) {
  const p = xpProgress(profile.xp ?? 0);
  const streak = profile.streak?.count ?? 0;

  return (
    <div className="flex items-center gap-3 border-b border-border/50 bg-panel/30 px-3 py-2 md:px-6">
      {/* 段位徽章 */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[18px]"
        style={{
          background: `${p.rank.color}1a`,
          boxShadow: `0 0 0 1px ${p.rank.color}55, 0 0 12px ${p.rank.color}33`,
        }}
        title={`${p.rank.name} · Lv.${p.level}`}
      >
        {p.rank.icon}
      </div>

      {/* 段位名 + 等级 + 经验条 */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[13px] font-bold text-white">{p.rank.name}</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ background: `${p.rank.color}22`, color: p.rank.color }}
          >
            Lv.{p.level}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            {p.intoLevel}/{p.levelSpan} XP
          </span>
        </div>
        {/* 经验条 */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="relative h-full rounded-full transition-all duration-700 ease-spring"
            style={{
              width: `${p.pct}%`,
              background: `linear-gradient(90deg, ${p.rank.color}, #4cc2ff)`,
              boxShadow: `0 0 8px ${p.rank.color}88`,
            }}
          >
            <span className="xp-shine absolute inset-0 rounded-full" />
          </div>
        </div>
      </div>

      {/* 连击火苗 */}
      {streak > 0 && (
        <div
          className="flex shrink-0 items-center gap-1 rounded-lg border border-orange-400/30 bg-orange-400/10 px-2 py-1"
          title={`连续训练 ${streak} 天（最佳 ${profile.streak?.best ?? streak} 天）`}
        >
          <span className="text-[14px]">🔥</span>
          <span className="font-mono text-[13px] font-bold text-orange-300">{streak}</span>
        </div>
      )}

      {/* 总经验 */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="font-mono text-[14px] font-bold" style={{ color: p.rank.color }}>{p.totalXp}</div>
        <div className="text-[10px] text-muted">总经验</div>
      </div>
    </div>
  );
}
