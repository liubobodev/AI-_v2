"use client";

import type { BasicsReadiness } from "@/lib/studentTypes";

const OPENMAIC_URL = "https://github.com/THU-MAIC/OpenMAIC";

/** 基础准入横幅:OpenMAIC 自学入口 + 轻量准入自测状态。放在闯关地图上方。 */
export default function BasicsBanner({
  readiness,
  onStartBasics,
}: {
  readiness?: BasicsReadiness;
  onStartBasics: () => void;
}) {
  const passed = readiness?.passed === true;
  const tested = !!readiness;

  return (
    <div className="mx-auto mb-4 max-w-5xl px-3 md:px-6">
      <div
        className={[
          "glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center",
          passed ? "!border-emerald-400/40" : "!border-amber-300/30",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{passed ? "🧱" : "📚"}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-white">基础准入</span>
              {passed ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  ✅ 地基已筑 · {readiness!.score}分
                </span>
              ) : tested ? (
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  未达标 · {readiness!.score}分,建议补学
                </span>
              ) : (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">未测试</span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              先用 OpenMAIC 打好 AI 基础(大模型/RAG/Agent/MCP/Evals),再做准入自测解锁八关实战。
              {readiness?.weakConcepts?.length ? ` 待补:${readiness.weakConcepts.join("、")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <a
            href={OPENMAIC_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-spring glow-hover rounded-lg border border-border/60 px-3 py-1.5 text-[12.5px] text-text hover:text-accent2"
          >
            📖 去 OpenMAIC 自学
          </a>
          <button
            onClick={onStartBasics}
            className="btn-spring rounded-lg border border-amber-300/50 bg-amber-300/10 px-3 py-1.5 text-[12.5px] font-semibold text-amber-200 hover:bg-amber-300/20"
          >
            🧱 {tested ? "重测基础自测" : "开始基础自测"}
          </button>
        </div>
      </div>
    </div>
  );
}
