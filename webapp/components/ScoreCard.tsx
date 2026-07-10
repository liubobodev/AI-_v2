"use client";

import type { Submission } from "@/lib/studentTypes";

const STATUS_LABEL: Record<Submission["status"], { text: string; cls: string }> = {
  pending: { text: "等待处理", cls: "text-muted border-border/50" },
  reviewing: { text: "AI 评审中…", cls: "text-accent border-accent/40 animate-pulse" },
  approved: { text: "✓ 已通过", cls: "text-accent2 border-accent2/50 bg-accent2/10" },
  rejected: { text: "未通过", cls: "text-warn border-warn/50 bg-warn/10" },
};

export default function ScoreCard({ submission: s }: { submission: Submission }) {
  const st = STATUS_LABEL[s.status];
  return (
    <div className="glass animate-pop-in rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <a href={s.link} target="_blank" rel="noreferrer" className="truncate text-[12px] text-accent2 underline">
          {s.link}
        </a>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.text}</span>
      </div>

      {s.rawError && <div className="text-[12.5px] text-warn">{s.rawError}</div>}

      {typeof s.overallScore === "number" && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/30">
              <div
                className={`h-full rounded-full transition-all ${s.overallScore >= 70 ? "bg-accent2" : "bg-warn"}`}
                style={{ width: `${s.overallScore}%` }}
              />
            </div>
            <span className="font-mono text-[13px] font-bold text-white">{s.overallScore}</span>
          </div>

          {s.criteria && s.criteria.length > 0 && (
            <div className="mb-2 flex flex-col gap-1">
              {s.criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px]">
                  <span className={c.passed ? "text-accent2" : "text-warn"}>{c.passed ? "✓" : "✗"}</span>
                  <div>
                    <div className="text-text/90">{c.criterion}</div>
                    <div className="text-muted">{c.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-3">
            {s.topStrength && (
              <div className="rounded-md bg-accent2/10 px-2 py-1.5">
                <div className="text-[10px] font-semibold text-accent2">最大亮点</div>
                <div className="text-text/90">{s.topStrength}</div>
              </div>
            )}
            {s.topGap && (
              <div className="rounded-md bg-warn/10 px-2 py-1.5">
                <div className="text-[10px] font-semibold text-warn">最大差距</div>
                <div className="text-text/90">{s.topGap}</div>
              </div>
            )}
            {s.nextStep && (
              <div className="rounded-md bg-accent/10 px-2 py-1.5">
                <div className="text-[10px] font-semibold text-accent">下一步</div>
                <div className="text-text/90">{s.nextStep}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
