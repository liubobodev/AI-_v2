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
  onPick,
}: {
  current: number;
  onPick: (n: number, name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        八关进度(点击切换)
      </div>
      {GATES.map((g) => {
        const active = g.n === current;
        const done = g.n < current;
        return (
          <button
            key={g.n}
            onClick={() => onPick(g.n, g.name)}
            className={[
              "group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-all",
              active
                ? "border-accent/50 bg-accent/10 text-white shadow-glow"
                : done
                ? "border-border/60 bg-panel2/40 text-muted hover:border-accent2/40"
                : "border-border/40 bg-transparent text-muted/70 hover:border-border hover:bg-panel2/40",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                active
                  ? "bg-accent text-base"
                  : done
                  ? "bg-accent2/20 text-accent2"
                  : "bg-border/40 text-muted",
              ].join(" ")}
            >
              {done ? "✓" : g.n}
            </span>
            <span className="truncate">{g.name}</span>
          </button>
        );
      })}
    </div>
  );
}
