"use client";

import { QUICK_COMMANDS } from "@/lib/quickCommands";

export default function QuickCommandBar({
  onPick,
  disabled,
  inline,
  onSpecial,
}: {
  onPick: (message: string) => void;
  disabled: boolean;
  /** 紧凑横向 chip 模式，用于聊天抽屉输入框上方 */
  inline?: boolean;
  /** 某些口令（如"每日脉搏"）需要走独立面板而不是聊天流：返回 true 表示已拦截处理 */
  onSpecial?: (id: string) => boolean;
}) {
  function handleClick(c: (typeof QUICK_COMMANDS)[number]) {
    if (onSpecial?.(c.id)) return;
    onPick(c.message);
  }

  if (inline) {
    return (
      <>
        {QUICK_COMMANDS.map((c) => (
          <button
            key={c.id}
            disabled={disabled}
            title={c.hint}
            onClick={() => handleClick(c)}
            className="rounded-full border border-border/50 bg-panel2/40 px-2.5 py-1 text-[11.5px] text-text/80 transition-colors hover:border-accent2/50 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {c.label}
          </button>
        ))}
      </>
    );
  }

  const groups = ["引导", "诊断", "面试", "情报"] as const;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group}>
          <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {group}
          </div>
          <div className="flex flex-col gap-1">
            {QUICK_COMMANDS.filter((c) => c.group === group).map((c) => (
              <button
                key={c.id}
                disabled={disabled}
                title={c.hint}
                onClick={() => handleClick(c)}
                className="rounded-lg border border-border/50 bg-panel2/40 px-2.5 py-1.5 text-left text-[12.5px] text-text/90 transition-colors hover:border-accent2/50 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
