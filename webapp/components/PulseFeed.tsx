"use client";

import { useEffect, useState } from "react";

type PulseItem = { title: string; url: string; meta: string; date?: string };
type PulseGroup = { key: string; label: string; desc: string; items: PulseItem[]; error?: string; qualityNote?: string };
type PulseData = { ok: boolean; generatedAt?: string; groups?: PulseGroup[]; error?: string };

const GROUP_COLOR: Record<string, string> = {
  hn: "#ff8c42", hf: "#f9c846", cn: "#4cc2ff", scenario: "#35e0d0",
};

export default function PulseFeed({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setLoading(true);
    const qs = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : "";
    fetch(`/api/pulse${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setData({ ok: false, error: String(e) }))
      .finally(() => setLoading(false));
  }, [apiKey]);

  async function copyMarkdown() {
    setCopyState("idle");
    try {
      const qs = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}&format=md` : "?format=md";
      const res = await fetch(`/api/pulse${qs}`);
      if (!res.ok) throw new Error("export failed");
      const md = await res.text();
      await navigator.clipboard.writeText(md);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-base/92 backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-border/60 bg-panel/60 px-3 py-2.5 md:px-6">
        <span className="text-[13.5px] font-semibold text-text">📡 每日脉搏 · 真实联网抓取</span>
        {data?.generatedAt && (
          <span className="text-[11px] text-muted">生成于 {new Date(data.generatedAt).toLocaleString("zh-CN")}</span>
        )}
        <button onClick={copyMarkdown} className="btn-spring ml-auto rounded-lg border border-accent2/40 px-2.5 py-1 text-[12px] text-accent2 hover:bg-accent2/10">
          {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制周报 Markdown"}
        </button>
        <button onClick={onClose} className="btn-spring rounded-lg border border-border/50 px-2.5 py-1 text-[12px] text-muted hover:text-text">
          关闭 ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">
            正在联网抓取 Hacker News / HuggingFace / 智谱实时搜索…
          </div>
        )}

        {!loading && data && !data.ok && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] text-warn">
            脉搏抓取整体失败：{data.error}
          </div>
        )}

        {!loading && data?.groups && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.groups.map((g) => (
              <div key={g.key} className="glass card-lift rounded-xl p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g.key] ?? "#8b95a7" }} />
                  <span className="text-[13px] font-bold text-white">{g.label}</span>
                </div>
                <div className="mb-3 text-[11px] text-muted">{g.desc}</div>

                {g.error && (
                  <div className="rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[12px] text-warn">
                    {g.error}
                  </div>
                )}

                {!g.error && g.qualityNote && (
                  <div className="mb-2 rounded-md border border-border/40 bg-base/40 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-muted">
                    {g.qualityNote}
                  </div>
                )}

                {!g.error && g.items.length === 0 && (
                  <div className="text-[12px] text-muted">暂无结果</div>
                )}

                <ul className="flex flex-col gap-2">
                  {g.items.map((it, i) => (
                    <li key={i}>
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-spring glow-hover flex flex-col gap-0.5 rounded-lg border border-border/40 bg-panel2/30 px-2.5 py-2 no-underline"
                      >
                        <span className="text-[12.5px] font-medium leading-snug text-text/95 hover:text-accent2">
                          {it.title}
                        </span>
                        <span className="text-[11px] text-muted">
                          {it.meta}{it.date ? ` · ${it.date}` : ""}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-muted">
          A类信号（HN/HuggingFace）为免鉴权公开 API 直连；B类信号为智谱 Web Search 实时联网结果——全部真实数据、可点击溯源，不是模型编造。
        </p>
      </div>
    </div>
  );
}
