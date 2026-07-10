"use client";

import { useEffect } from "react";
import type { Achievement } from "@/lib/studentTypes";
import { TIER_STYLE } from "@/lib/gamification";

export type ToastItem =
  | { id: string; kind: "achievement"; achievement: Achievement }
  | { id: string; kind: "note"; icon: string; title: string; sub: string; color: string };

/** 右上角成就/提示 toast 队列，逐条滑入，自动消失 */
export default function AchievementToast({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[90] flex w-72 flex-col gap-2">
      {items.map((it) => (
        <ToastCard key={it.id} item={it} onDismiss={() => onDismiss(it.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4600);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  const { icon, title, sub, color, badge } =
    item.kind === "achievement"
      ? {
          icon: item.achievement.icon,
          title: item.achievement.name,
          sub: item.achievement.desc,
          color: TIER_STYLE[item.achievement.tier].ring,
          badge: TIER_STYLE[item.achievement.tier].label,
        }
      : { icon: item.icon, title: item.title, sub: item.sub, color: item.color, badge: null };

  return (
    <div
      className="toast-in glass pointer-events-auto flex cursor-pointer items-center gap-3 rounded-xl p-3"
      style={{ boxShadow: `0 0 0 1px ${color}55, 0 8px 24px rgba(0,0,0,0.4), 0 0 18px ${color}22` }}
      onClick={onDismiss}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[22px]"
        style={{ background: `${color}1f`, boxShadow: `0 0 10px ${color}44` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-bold text-white">{title}</span>
          {badge && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: `${color}22`, color }}>
              {badge}
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-muted">
          {item.kind === "achievement" ? "🏆 解锁成就 · " : ""}{sub}
        </div>
      </div>
    </div>
  );
}
