"use client";

import type { StudentProfile, SkillArea } from "@/lib/studentTypes";
import { SKILL_LABELS } from "@/lib/studentTypes";

const GATE_NAMES: Record<number, string> = {
  1: "侦察关", 2: "AI编程协作关", 3: "Prompt资产关", 4: "RAG工程关",
  5: "工具与MCP关", 6: "Agent系统关", 7: "Evals上线关", 8: "发射关",
};

function skillBar(level: number) {
  return "█".repeat(level) + "░".repeat(5 - level);
}

export default function GrowthPanel({ profile }: { profile: StudentProfile }) {
  const completed = profile.gateProgress.filter((g) => g.status === "completed").length;
  const inProgress = profile.gateProgress.find((g) => g.status === "in_progress");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-panel2/30 p-3 text-[12px]">
      <div>
        <div className="mb-1 font-semibold text-text">训练进度</div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-border/30 overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(completed / 8) * 100}%` }} />
          </div>
          <span className="text-accent font-mono font-bold">{completed}/8</span>
        </div>
        {inProgress && (
          <div className="mt-1 text-muted">当前：第{inProgress.gate}关「{GATE_NAMES[inProgress.gate] ?? ""}」</div>
        )}
      </div>

      {profile.skills.length > 0 && (
        <div>
          <div className="mb-1 font-semibold text-text">技能评估</div>
          <div className="flex flex-col gap-0.5 font-mono text-[11px]">
            {profile.skills.map((s) => (
              <div key={s.area} className="flex items-center justify-between">
                <span className="text-muted">{SKILL_LABELS[s.area as SkillArea] ?? s.area}</span>
                <span className="text-accent">{skillBar(s.level)} <span className="text-text ml-1">L{s.level}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.milestones.length > 0 && (
        <div>
          <div className="mb-1 font-semibold text-text">最近里程碑</div>
          <div className="flex flex-col gap-1">
            {profile.milestones.slice(-3).reverse().map((m, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="mt-0.5 shrink-0">
                  {m.type === "gate_complete" ? "🏆" : m.type === "skill_up" ? "📈" : m.type === "project" ? "🚀" : "💡"}
                </span>
                <div>
                  <div className="text-text">{m.title}</div>
                  <div className="text-muted">{m.date.slice(0, 10)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between border-t border-border/30 pt-2 text-[11px] text-muted">
        <span>累计 {profile.sessionCount} 次训练</span>
        <span>{profile.role || "未设身份"}</span>
      </div>
    </div>
  );
}
