"use client";

const GATES = [
  { n: 1, name: "侦察关" },
  { n: 2, name: "AI编程协作关" },
  { n: 3, name: "Prompt资产关" },
  { n: 4, name: "RAG工程关" },
  { n: 5, name: "工具与MCP关" },
  { n: 6, name: "Agent系统关" },
  { n: 7, name: "Evals上线关" },
  { n: 8, name: "发射关" },
];

export default function GateLadder({
  current,
  completedGates = [],
  onPick,
}: {
  current: number;
  completedGates?: number[];
  onPick: (n: number, name: string) => void;
}) {
  const doneSet = new Set(completedGates);
  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        八关进度(点击进入作战室)
      </div>
      {GATES.map((g) => {
        const active = g.n === current;
        const done = doneSet.has(g.n); // 真·通关(三门全绿),而非仅"编号小于当前关"
        return (
          <button
            key={g.n}
            onClick={() => onPick(g.n, g.name)}
            className={[
              "group btn-spring glow-hover flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px]",
              active
                ? "border-accent2/60 bg-accent2/10 text-white animate-badge-pulse"
                : done
                ? "border-border/60 bg-panel2/40 text-muted"
                : "border-border/40 bg-transparent text-muted/70 hover:bg-panel2/40",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-all duration-300",
                active
                  ? "bg-accent2 text-base shadow-[0_0_10px_rgba(76,194,255,0.6)]"
                  : done
                  ? "bg-accent/20 text-accent"
                  : "bg-border/40 text-muted",
              ].join(" ")}
            >
              {done ? "✓" : g.n}
            </span>
            <span className="truncate">{g.name}</span>
            {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent2 shadow-[0_0_8px_rgba(76,194,255,0.9)]" />}
          </button>
        );
      })}
    </div>
  );
}
