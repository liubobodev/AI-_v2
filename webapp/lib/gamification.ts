// 游戏化引擎（纯函数，客户端 + 服务端共用）：段位曲线、经验规则、成就判定。
import type { StudentProfile, Achievement, UnlockedAchievement } from "./studentTypes";

/* ============ 段位（按等级映射，越往上越有牌面） ============ */

export type Rank = { name: string; icon: string; minLevel: number; color: string };

export const RANKS: Rank[] = [
  { name: "实习萌新", icon: "🌱", minLevel: 1, color: "#8ee3ff" },
  { name: "初级开发", icon: "🔧", minLevel: 3, color: "#4cc2ff" },
  { name: "应用工程师", icon: "⚙️", minLevel: 5, color: "#35e0d0" },
  { name: "资深工程师", icon: "🛠️", minLevel: 8, color: "#49dccb" },
  { name: "系统架构师", icon: "🏗️", minLevel: 11, color: "#c084fc" },
  { name: "AI 上岗大师", icon: "👑", minLevel: 15, color: "#ffd166" },
];

export function rankForLevel(level: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) r = rank;
  return r;
}

/* ============ 等级曲线 ============
   每升一级所需经验递增：req(n) = 120 + (n-1)*80。
   levelForXp(xp) 返回当前等级；下面几个函数给进度条用。 */

function reqForLevel(level: number): number {
  return 120 + (level - 1) * 80;
}

/** 达到某等级所需的累计经验（level 1 = 0） */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let k = 1; k < level; k++) sum += reqForLevel(k);
  return sum;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= totalXpForLevel(level + 1)) level++;
  return level;
}

export type XpProgress = {
  level: number;
  rank: Rank;
  totalXp: number;
  curLevelFloor: number;   // 当前等级起点累计经验
  nextLevelAt: number;     // 下一级所需累计经验
  intoLevel: number;       // 当前等级内已获得
  levelSpan: number;       // 当前等级跨度
  pct: number;             // 0-100 当前等级进度
};

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const curLevelFloor = totalXpForLevel(level);
  const nextLevelAt = totalXpForLevel(level + 1);
  const intoLevel = xp - curLevelFloor;
  const levelSpan = nextLevelAt - curLevelFloor;
  return {
    level,
    rank: rankForLevel(level),
    totalXp: xp,
    curLevelFloor,
    nextLevelAt,
    intoLevel,
    levelSpan,
    pct: levelSpan > 0 ? Math.min(100, Math.round((intoLevel / levelSpan) * 100)) : 100,
  };
}

/* ============ 经验规则 ============ */

export const XP = {
  checklistItem: 12,        // 勾选一条验收标准
  submissionApprovedBase: 50, // 评审通过基础分
  submissionScoreFactor: 0.6, // + score*0.6（90分≈+104）
  interviewPassed: 90,      // 面试通过
  interviewAttempt: 25,     // 面试参与（未过也给）
  gateCompleted: 150,       // 三门全绿通关额外奖励
  dailySession: 15,         // 每日首次训练
  streakStep: 6,            // 连击每天额外 +streak*6
} as const;

/* ============ 成就定义 ============ */

export const ACHIEVEMENTS: (Achievement & { check: (p: StudentProfile) => boolean })[] = [
  { id: "basics_ready", name: "地基已筑", icon: "🧱", tier: "common", desc: "通过基础准入自测(OpenMAIC 自学后)",
    check: (p) => p.basicsReadiness?.passed === true },
  { id: "first_step", name: "破冰", icon: "🎯", tier: "common", desc: "完成第一次训练动作",
    check: (p) => p.sessionCount >= 1 || p.xp > 0 },
  { id: "first_check", name: "第一勾", icon: "✅", tier: "common", desc: "勾选第一条验收标准",
    check: (p) => p.gateProgress.some((g) => Object.values(g.checklist ?? {}).some(Boolean)) },
  { id: "first_pass", name: "首战告捷", icon: "🥇", tier: "rare", desc: "第一次通过项目评审",
    check: (p) => p.gateProgress.some((g) => g.doors?.submissionApproved) },
  { id: "interviewer_slayer", name: "舌战面试官", icon: "🎤", tier: "rare", desc: "第一次通过模拟面试",
    check: (p) => (p.interviewResults ?? []).some((r) => r.passed) },
  { id: "perfectionist", name: "满分猎手", icon: "💯", tier: "epic", desc: "拿到一次 95+ 的评审分",
    check: (p) => p.gateProgress.some((g) => (g.submissions ?? []).some((s) => (s.overallScore ?? 0) >= 95)) },
  { id: "interview_ace", name: "面霸", icon: "🔥", tier: "epic", desc: "一次面试拿到 90+ 分",
    check: (p) => (p.interviewResults ?? []).some((r) => r.score >= 90) },
  { id: "triple_green", name: "三门齐开", icon: "🚪", tier: "rare", desc: "让一关的三道门全部点亮",
    check: (p) => p.gateProgress.some((g) => g.doors?.selfCheck && g.doors?.submissionApproved && g.doors?.interviewPassed) },
  { id: "gate1_clear", name: "侦察兵", icon: "🔭", tier: "common", desc: "通关第 1 关",
    check: (p) => p.gateProgress.find((g) => g.gate === 1)?.status === "completed" },
  { id: "half_way", name: "半程英雄", icon: "🏃", tier: "epic", desc: "累计通关 4 关",
    check: (p) => p.gateProgress.filter((g) => g.status === "completed").length >= 4 },
  { id: "eval_believer", name: "评测信徒", icon: "📊", tier: "epic", desc: "通关第 7 关（Evals 上线关）",
    check: (p) => p.gateProgress.find((g) => g.gate === 7)?.status === "completed" },
  { id: "streak3", name: "三日连击", icon: "⚡", tier: "rare", desc: "连续 3 天训练",
    check: (p) => (p.streak?.best ?? 0) >= 3 },
  { id: "streak7", name: "七日不辍", icon: "🌟", tier: "epic", desc: "连续 7 天训练",
    check: (p) => (p.streak?.best ?? 0) >= 7 },
  { id: "grinder", name: "训练狂人", icon: "💪", tier: "rare", desc: "累计训练 20 次",
    check: (p) => p.sessionCount >= 20 },
  { id: "all_clear", name: "通关王者", icon: "👑", tier: "legendary", desc: "八关全部通关，正式上岗",
    check: (p) => p.gateProgress.filter((g) => g.status === "completed").length >= 8 },
];

export const TIER_STYLE: Record<Achievement["tier"], { ring: string; glow: string; label: string }> = {
  common:    { ring: "#8b95a7", glow: "rgba(139,149,167,0.4)", label: "普通" },
  rare:      { ring: "#4cc2ff", glow: "rgba(76,194,255,0.55)", label: "稀有" },
  epic:      { ring: "#c084fc", glow: "rgba(192,132,252,0.6)", label: "史诗" },
  legendary: { ring: "#ffd166", glow: "rgba(255,209,102,0.7)", label: "传说" },
};

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** 重新判定成就，返回本次新解锁的完整成就对象（会 mutate profile.achievements） */
export function syncAchievements(profile: StudentProfile): Achievement[] {
  if (!Array.isArray(profile.achievements)) profile.achievements = [];
  const owned = new Set(profile.achievements.map((a) => a.id));
  const newly: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!owned.has(a.id) && a.check(profile)) {
      profile.achievements.push({ id: a.id, unlockedAt: new Date().toISOString() } as UnlockedAchievement);
      newly.push({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, tier: a.tier });
    }
  }
  return newly;
}
