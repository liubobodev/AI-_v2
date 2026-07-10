"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = ["我", "命", "由", "我", "不", "由", "天"];

/**
 * 八冠王终局：在闯关地图页面内直接炸出「我命由我不由天」
 * 非遮罩/非全屏，保留闯关地图可见，金紫炸裂效果
 */
export default function CalligraphyBurst({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<{
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    color: string;
    size: number;
    kind: "spark" | "chip" | "ember";
  }[]>([]);
  const pidRef = useRef(0);
  const [shockwave, setShockwave] = useState(false);
  const [rays, setRays] = useState(false);
  const [phase, setPhase] = useState<"intro" | "chars" | "complete">("intro");

  useEffect(() => {
    // Phase 1: 冲击波 + 射线爆发
    const waveTimer = window.setTimeout(() => {
      setShockwave(true);
      setRays(true);
      window.setTimeout(() => setShockwave(false), 1300);
      window.setTimeout(() => setRays(false), 2500);

      // 开场中央大爆粒子
      centralBurst(72, 380, ["#fff6cf", "#ffd14a", "#ff8a24", "#56f4ff", "#2d8bff", "#ffffff"]);
      setPhase("chars");
    }, 80);

    // Phase 2: 逐字爆开
    const delays = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
    const timers: number[] = [];
    const charStartBase = 500;

    delays.forEach((delay, idx) => {
      const t = window.setTimeout(() => {
        charParticleBurst(idx);
        if (idx === 6) {
          window.setTimeout(() => {
            centralBurst(52, 340, ["#fff6cf", "#ffd14a", "#ff8a24", "#56f4ff", "#ffffff"]);
          }, 400);
        }
      }, charStartBase + delay * 1000);
      timers.push(t);
    });

    // Phase 3: 金色粒子雨
    const goldTimer = window.setTimeout(() => {
      goldRainBurst();
    }, 3000);

    // Phase complete
    const completeTimer = window.setTimeout(() => setPhase("complete"), 4200);

    // 5.5秒自动关闭
    const closeTimer = window.setTimeout(() => {
      setPhase("complete");
      window.setTimeout(onClose, 500);
    }, 5500);

    return () => {
      window.clearTimeout(waveTimer);
      timers.forEach(window.clearTimeout);
      window.clearTimeout(goldTimer);
      window.clearTimeout(completeTimer);
      window.clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function centralBurst(count: number, maxDist: number, colors: string[]) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.38;
    const newParticles: typeof particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * maxDist;
      pidRef.current++;
      newParticles.push({
        id: pidRef.current,
        x: centerX,
        y: centerY,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20 + Math.random() * 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 10,
        kind: i % 4 === 0 ? "chip" : i % 3 === 0 ? "ember" : "spark",
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1600);
  }

  function charParticleBurst(idx: number) {
    const chars = containerRef.current?.querySelectorAll(".burst-char");
    const el = chars?.[idx] as HTMLElement | undefined;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newParticles: typeof particles = [];
    const count = 15 + Math.floor(Math.random() * 12);
    const colors = ["#fff6cf", "#ffd14a", "#ff8a24", "#56f4ff", "#2d8bff", "#ffffff"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 160;
      pidRef.current++;
      newParticles.push({
        id: pidRef.current,
        x: cx, y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 6,
        kind: i % 5 === 0 ? "chip" : "spark",
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1200);
  }

  function goldRainBurst() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.4;
    const newParticles: typeof particles = [];
    const goldColors = ["#fff6cf", "#ffd14a", "#ffaa22", "#ffffff"];
    for (let i = 0; i < 42; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const dist = 80 + Math.random() * 250;
      pidRef.current++;
      newParticles.push({
        id: pidRef.current,
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: goldColors[Math.floor(Math.random() * goldColors.length)],
        size: 2 + Math.random() * 4,
        kind: "ember",
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1800);
  }

  return (
    <div className={`burst-on-page ${phase}`} ref={containerRef} aria-live="polite">
      <div className="burst-cyber-stage" aria-hidden="true">
        <div className="burst-halo" />
        <div className="burst-energy-band band-one" />
        <div className="burst-energy-band band-two" />
        <div className="burst-energy-band band-three" />
        <div className="burst-lightning lightning-one" />
        <div className="burst-lightning lightning-two" />
        <div className="burst-lightning lightning-three" />
        <div className="burst-spark-field">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              style={{
                ["--i" as string]: i,
                ["--x" as string]: `${7 + i * 3.7}%`,
                ["--y" as string]: `${[18, 30, 62, 46][i % 4]}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* 金色+紫色射线 */}
      {rays && (
        <div className="burst-rays-bg">
          <div className="burst-ray ray-gold" />
          <div className="burst-ray ray-purple" />
          <div className="burst-ray ray-red" />
        </div>
      )}

      {/* 冲击波环 */}
      <div className={`shockwave-ring-gold ${shockwave ? "wave-active" : ""}`} />
      <div className={`shockwave-ring-purple ${shockwave ? "wave-active" : ""}`} />

      {/* 我命由我不由天 */}
      <div className="chars-row" onClick={(e) => e.stopPropagation()}>
        {CHARS.map((char, i) => (
          <span key={i} className="burst-char" data-text={char}>{char}</span>
        ))}
      </div>

      <div className="burst-subtitle">
        <span>八冠王</span>
        <span>全部优秀通关</span>
        <span>正式上岗</span>
      </div>

      {/* 粒子 */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`calligraphy-particle particle-${p.kind}`}
          style={{
            left: p.x, top: p.y,
            width: p.size, height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}, 0 0 ${p.size * 6}px ${p.color}44`,
            ["--dx" as string]: p.dx + "px",
            ["--dy" as string]: p.dy + "px",
          }}
        />
      ))}
    </div>
  );
}
