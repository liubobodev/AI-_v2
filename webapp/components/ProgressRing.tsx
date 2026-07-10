"use client";

/** 环形进度指示器：显示三道通关门里点亮了几道，带旋转光晕动画 */
export default function ProgressRing({
  lit,
  total = 3,
  size = 44,
  icon,
}: {
  lit: number;
  total?: number;
  size?: number;
  icon?: string;
}) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? lit / total : 0;
  const full = pct >= 1;
  const partial = pct > 0 && !full;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* 外圈光晕（全亮时旋转） */}
      {full && (
        <div
          className="absolute inset-[-3px] rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent, rgba(53,224,208,0.3), rgba(76,194,255,0.4), transparent)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            animation: "ring-spin 2s linear infinite",
          }}
        />
      )}
      {/* 半亮时柔和光环 */}
      {partial && (
        <div
          className="absolute inset-[-2px] rounded-full opacity-60"
          style={{
            background: "conic-gradient(from 0deg, transparent 60%, rgba(76,194,255,0.25), transparent)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            animation: "ring-spin 3s linear infinite",
          }}
        />
      )}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#29303d" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={full ? "#35e0d0" : partial ? "#4cc2ff" : "#3a4557"}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s ease",
            filter: full ? "drop-shadow(0 0 6px rgba(53,224,208,0.7))" : partial ? "drop-shadow(0 0 3px rgba(76,194,255,0.4))" : "none",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {full ? (
          <span className="text-[13px]" style={{ filter: "drop-shadow(0 0 4px rgba(53,224,208,0.8))" }}>✓</span>
        ) : icon ? (
          <span className="text-[13px]">{icon}</span>
        ) : null}
      </div>
    </div>
  );
}
