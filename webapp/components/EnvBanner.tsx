"use client";

import { useEffect, useState } from "react";

type EnvItem = {
  key: string;
  present: boolean;
  severity: "critical" | "warning";
  impact: string;
  hint: string;
};

type EnvHealth = {
  ok: boolean;
  hasWarnings: boolean;
  missingCritical: number;
  missingWarning: number;
  items: EnvItem[];
};

/**
 * 环境自检横幅:上课前把缺失的密钥/配置提前暴露给运维与教师,
 * 而不是等学生点对话才撞「缺少 API Key」(POSTMORTEM #2)。
 * 只消费 /api/status 返回的布尔与文案,绝不接触任何密钥值。
 */
export default function EnvBanner() {
  const [env, setEnv] = useState<EnvHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => { if (alive) setEnv(d.env ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!env || dismissed) return null;
  const missing = env.items.filter((i) => !i.present);
  if (missing.length === 0) return null;

  const hasCritical = env.missingCritical > 0;

  return (
    <div className="mx-auto mb-4 max-w-5xl px-3 md:px-6">
      <div
        className={[
          "rounded-2xl border p-3.5 md:p-4",
          hasCritical
            ? "border-red-500/45 bg-red-500/10"
            : "border-amber-300/40 bg-amber-300/10",
        ].join(" ")}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span className="text-xl">{hasCritical ? "⛔" : "⚠️"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[14px] font-bold ${hasCritical ? "text-red-200" : "text-amber-100"}`}>
                {hasCritical ? "环境自检未通过 · 上课前请修复" : "环境自检有警告"}
              </span>
              <span className="text-[12px] text-muted">
                {env.missingCritical > 0 && `${env.missingCritical} 项致命`}
                {env.missingCritical > 0 && env.missingWarning > 0 && " · "}
                {env.missingWarning > 0 && `${env.missingWarning} 项警告`}
              </span>
            </div>
            <p className={`mt-0.5 text-[12.5px] ${hasCritical ? "text-red-100/85" : "text-amber-100/85"}`}>
              {hasCritical
                ? "关键密钥缺失,教练对话/评审/面试会直接报错。检测在服务端完成,此处不显示任何密钥内容。"
                : "核心功能可用,但以下配置建议在正式上课前补齐。"}
            </p>

            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[12px] font-medium text-text/80 underline decoration-dotted underline-offset-2 hover:text-text"
            >
              {expanded ? "收起明细 ▲" : `查看缺失项与修复方法（${missing.length}）▼`}
            </button>

            {expanded && (
              <ul className="mt-2 space-y-2">
                {missing.map((it) => (
                  <li key={it.key} className="rounded-lg border border-border/40 bg-base/30 p-2.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className={it.severity === "critical" ? "text-red-300" : "text-amber-200"}>
                        {it.severity === "critical" ? "致命" : "警告"}
                      </span>
                      <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11.5px] text-accent2">{it.key}</code>
                    </div>
                    <div className="mt-1 text-text/85">影响：{it.impact}</div>
                    <div className="mt-0.5 text-muted">修复：{it.hint}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!hasCritical && (
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-md px-2 py-1 text-[12px] text-muted hover:text-text"
              aria-label="忽略本次警告"
            >
              忽略
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
