"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import GateLadder from "@/components/GateLadder";
import GateMap from "@/components/GateMap";
import GateWarRoom from "@/components/GateWarRoom";
import QuickCommandBar from "@/components/QuickCommandBar";
import PulseFeed from "@/components/PulseFeed";
import ApiKeyModal from "@/components/ApiKeyModal";
import ModelSelector from "@/components/ModelSelector";
import GrowthPanel from "@/components/GrowthPanel";
import RewardHud from "@/components/RewardHud";
import BasicsBanner from "@/components/BasicsBanner";
import EnvBanner from "@/components/EnvBanner";
import CelebrationOverlay, { type Celebration } from "@/components/CelebrationOverlay";
import CalligraphyBurst from "@/components/CalligraphyBurst";
import AchievementToast, { type ToastItem } from "@/components/AchievementToast";
import { getProviderById } from "@/lib/models";
import type { StudentProfile, RewardDelta } from "@/lib/studentTypes";
import type { GateData } from "@/lib/gateTypes";
import { GATE_NAMES } from "@/lib/gateTypes";
import { computeGateRating, type Tier } from "@/lib/rating";
import { rankForLevel } from "@/lib/gamification";

const STORAGE_KEY = "ai-coach-api-key";
const STORAGE_MESSAGES = "ai-coach-messages";
const STORAGE_GATE = "ai-coach-current-gate";
const STORAGE_PROVIDER = "ai-coach-provider";
const STORAGE_MODEL = "ai-coach-model";
const STORAGE_STUDENT_ID = "ai-coach-student-id";
const STORAGE_USER = "ai-coach-login-user";
const MAX_STORED_MESSAGES = 50;
// 登录态保留一节课(8 小时):课中刷新/关标签页不必重登,次日自动过期回到干净登录页
const LOGIN_TTL_MS = 8 * 60 * 60 * 1000;

const DEFAULT_PROVIDER = "glm";
// 默认用非思考型 glm-4-flash:实测 20s 内出完整回复;思考型 glm-4.7-flash 首字 60s+ 会让学生盯空白
const DEFAULT_MODEL = "glm-4-flash";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type AiMedalProfile = {
  medalName: string;
  color: string;
  accent: string;
  signal: string;
  scores: {
    research: number;
    craft: number;
    innovation: number;
    balance: number;
  };
};

const AI_MEDAL_META: Record<string, Omit<AiMedalProfile, "scores">> = {
  "AI智汇新锐": {
    medalName: "AI智汇新锐",
    color: "#5df7ff",
    accent: "#8cffb8",
    signal: "综合成长均衡，AI应用能力完成从入门到上岗的跃迁。",
  },
  "AI数智匠心": {
    medalName: "AI数智匠心",
    color: "#ffd45a",
    accent: "#54f6ff",
    signal: "工程落地与技能成品表现突出，作品完成度和可交付性优秀。",
  },
  "AI智研先锋": {
    medalName: "AI智研先锋",
    color: "#8af0ff",
    accent: "#9f7cff",
    signal: "研究拆解、评测推理和问题洞察能力突出，适合继续深挖高阶方案。",
  },
  "AI科创达人": {
    medalName: "AI科创达人",
    color: "#ffdf6e",
    accent: "#ff7ad9",
    signal: "技术成果、表达呈现和创新发布综合亮眼，具备对外展示与项目发射能力。",
  },
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function average(values: number[], fallback = 0) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function skillScore(profile: StudentProfile, areas: string[]) {
  return average(
    profile.skills
      .filter((skill) => areas.includes(skill.area))
      .map((skill) => skill.level * 20),
    72
  );
}

function scoreFromGates(profile: StudentProfile, picker: (gate: StudentProfile["gateProgress"][number]) => number | undefined) {
  return average(profile.gateProgress.map((gate) => picker(gate)).filter((v): v is number => typeof v === "number"), 76);
}

function buildAiMedalCelebration(profile: StudentProfile, studentName: string): Celebration {
  const selfScore = scoreFromGates(profile, (gate) => gate.selfCheckData?.overallScore);
  const reviewScore = scoreFromGates(profile, (gate) => {
    const scores = (gate.submissions ?? [])
      .filter((s) => s.status === "approved" && typeof s.overallScore === "number")
      .map((s) => s.overallScore as number);
    return scores.length ? average(scores) : undefined;
  });
  const interviewScore = average((profile.interviewResults ?? []).filter((r) => r.passed).map((r) => r.score), 76);
  const completedScore = (profile.gateProgress.filter((gate) => gate.status === "completed").length / 8) * 100;

  const research = clampScore(average([
    skillScore(profile, ["product_analysis", "prompt_engineering", "rag", "evals"]),
    selfScore,
    interviewScore,
  ]));
  const craft = clampScore(average([
    skillScore(profile, ["ai_coding", "rag", "mcp", "agent"]),
    reviewScore,
    completedScore,
  ]));
  const innovation = clampScore(average([
    skillScore(profile, ["presentation", "agent", "evals"]),
    reviewScore,
    interviewScore,
  ]));
  const balance = clampScore(average([research, craft, innovation, completedScore]));

  const ranked = [
    { key: "AI智研先锋", score: research },
    { key: "AI数智匠心", score: craft },
    { key: "AI科创达人", score: innovation },
    { key: "AI智汇新锐", score: balance - Math.abs(research - craft) * 0.2 - Math.abs(craft - innovation) * 0.2 },
  ].sort((a, b) => b.score - a.score);
  const chosen = AI_MEDAL_META[ranked[0].key];
  const cleanName = studentName.trim() || "同学";

  return {
    kind: "ai_medal",
    ...chosen,
    studentName: cleanName,
    title: `恭祝${cleanName}同学斩获${chosen.medalName}勋章`,
    sub: chosen.signal,
    stats: [
      { label: "研究力", value: `${research}` },
      { label: "成品力", value: `${craft}` },
      { label: "创新力", value: `${innovation}` },
    ],
  };
}

/* ============ 登录页面组件（仅学生/教师） ============ */

type LoginMode = "student" | "teacher" | "demo";
type LoginUser = { name: string; role: string; userId: string; loggedIn: boolean; isDemo?: boolean };

function LoginScreen({
  onLogin,
}: {
  onLogin: (user: LoginUser) => void;
}) {
  const [mode, setMode] = useState<"" | LoginMode>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (!username.trim() || !password.trim()) return;
    setLoginError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", name: username.trim(), password, expectedRole: mode === "demo" ? "student" : mode }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        onLogin({
          name: data.user.name,
          role: data.user.role,
          userId: data.user.userId,
          loggedIn: true,
          isDemo: !!data.user.isDemo,
        });
      } else {
        setLoginError(data.error || "用户名或密码错误");
      }
    } catch {
      setLoginError("网络错误，请确认服务已启动");
    }
    setLoading(false);
  }

  if (mode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-3 md:p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel p-4 md:p-6 shadow-2xl">
          <button
            onClick={() => { setMode(""); setLoginError(""); }}
            className="mb-4 text-[13px] text-muted hover:text-text transition-colors"
          >
            ← 返回
          </button>
          <div className="mb-4 flex justify-center">
            <img
              src="/logo.png"
              alt="品哥"
              className="relative h-14 w-14 rounded-xl object-cover ring-2 ring-accent/25 shadow-lg shadow-accent/10"
            />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">
            {mode === "teacher" ? "教师登录" : mode === "demo" ? "演示号登录" : "学生登录"}
          </h1>
          <p className="text-[13px] text-muted mb-4">
            请输入管理员创建的用户名和密码
          </p>
          <input
            className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2.5 text-sm text-text outline-none focus:border-accent2 placeholder:text-muted/50"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            autoFocus
          />
          <input
            type="password"
            className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2.5 text-sm text-text outline-none focus:border-accent2 placeholder:text-muted/50"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
          {loginError && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
              {loginError}
            </div>
          )}
          <button
            onClick={doLogin}
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-base transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "登录中..." : "登录"}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted">
            没有账号？由管理员在<a href="/admin" target="_blank" className="text-accent2 underline ml-1">后台管理</a>中创建
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-3 md:p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-panel p-4 md:p-6 shadow-2xl">
        {/* 品牌Logo */}
        <div className="mb-5 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" />
            <img
              src="/logo.png"
              alt="品哥LOGO"
              className="relative h-[100px] w-[100px] md:h-[120px] md:w-[120px] rounded-2xl object-cover ring-2 ring-accent/40 shadow-xl shadow-accent/10"
            />
          </div>
        </div>
        <h1 className="text-[22px] font-bold text-white mb-1">
          AI 上岗实战<span className="text-accent">总教练</span>
        </h1>
        <p className="text-[13px] text-muted mb-6">选择你的身份并登录</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setMode("student")}
            className="flex flex-col items-start gap-1 rounded-xl border border-border/50 px-4 py-3.5 text-left transition hover:border-accent/40 hover:bg-accent/5"
          >
            <span className="text-[14px] font-semibold text-text">📚 学生登录</span>
            <span className="text-[12px] text-muted">用管理员创建的账号密码登录，同步训练进度</span>
          </button>
          <button
            onClick={() => setMode("teacher")}
            className="flex flex-col items-start gap-1 rounded-xl border border-border/50 px-4 py-3.5 text-left transition hover:border-accent/40 hover:bg-accent/5"
          >
            <span className="text-[14px] font-semibold text-text">👩‍🏫 教师登录</span>
            <span className="text-[12px] text-muted">用教师账号登录，查看全班学生学习进度</span>
          </button>
          <button
            onClick={() => setMode("demo")}
            className="flex flex-col items-start gap-1 rounded-xl border border-amber-400/35 bg-amber-400/5 px-4 py-3.5 text-left transition hover:border-amber-300/60 hover:bg-amber-400/10"
          >
            <span className="text-[14px] font-semibold text-amber-200">🏆 演示号登录</span>
            <span className="text-[12px] text-muted">用于展示逐关点亮、全通关和授勋章流程</span>
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">
          管理员入口：<a href="/admin" target="_blank" className="text-accent2 underline">后台管理</a>
        </p>
      </div>
    </div>
  );
}

/* ============ 欢迎消息生成 ============ */

function buildWelcomeMsg(userName: string, userRole: string, gate: number): Message {
  const gateNames = ["侦察关","AI编程协作关","Prompt资产关","RAG工程关","工具与MCP关","Agent系统关","Evals上线关","发射关"];
  const gn = gateNames[gate - 1] ?? `第${gate}关`;
  const roleLabel =
    userRole === "teacher" ? "教师" :
    userRole === "student" ? "学生" :
    userRole === "undergrad" ? "本科生" :
    userRole === "master" ? "硕士生" :
    userRole === "jobseeker" ? "求职冲刺者" : userRole;

  let content: string;
  if (userRole === "teacher") {
    content = `${userName} 老师，欢迎回来！我是 **AI 上岗实战总教练**。\n\n作为教师，你可以：\n- 在左侧「教师面板」查看全班学生训练进度\n- 和我讨论课程设计、学生辅导策略\n- 让我帮你拆解关卡难点、设计课堂案例\n\n需要我帮你做什么？`;
  } else {
    content = `${userName} 同学，欢迎回来！我是你的专属 **AI 上岗实战总教练**。\n\n📍 当前关卡：**第 ${gate} 关 · ${gn}**\n👤 身份：${roleLabel}\n\n我会根据你的关卡进度和技能水平，给你定制化的训练建议。随时问我问题，或使用左侧快捷口令快速进入训练。`;
  }

  return { id: "welcome", role: "assistant", content };
}

function loadMessages(fallback: Message): Message[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [fallback];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [fallback];
    return parsed;
  } catch { return [fallback]; }
}

function messageStorageKey(userId?: string) {
  return userId ? `${STORAGE_MESSAGES}:${userId}` : STORAGE_MESSAGES;
}

function loadMessagesForUser(userId: string, fallback: Message): Message[] {
  try {
    const raw = window.localStorage.getItem(messageStorageKey(userId)) || window.localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [fallback];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [fallback];
    return parsed;
  } catch { return [fallback]; }
}

function saveMessages(msgs: Message[]) {
  try {
    const trimmed = msgs.length > MAX_STORED_MESSAGES ? msgs.slice(-MAX_STORED_MESSAGES) : msgs;
    window.localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(trimmed));
  } catch {}
}

function saveMessagesForUser(userId: string, msgs: Message[]) {
  try {
    const trimmed = msgs.length > MAX_STORED_MESSAGES ? msgs.slice(-MAX_STORED_MESSAGES) : msgs;
    window.localStorage.setItem(messageStorageKey(userId), JSON.stringify(trimmed));
  } catch {}
}

function loadGate(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_GATE);
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return n >= 1 && n <= 8 ? n : 1;
  } catch { return 1; }
}

function saveGate(n: number) { try { window.localStorage.setItem(STORAGE_GATE, String(n)); } catch {} }
function loadStr(key: string, fallback: string): string {
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
}

/** 流式读取 */
async function streamChat(
  res: Response, assistantId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "", acc = "", reasoning = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const evt = JSON.parse(jsonStr);
        const d = evt.choices?.[0]?.delta ?? {};
        const delta: unknown = d.content;
        const think: unknown = d.reasoning_content;
        if (typeof delta === "string" && delta.length > 0) {
          acc += delta;
          const snap = acc;
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m)));
        } else if (typeof think === "string" && think.length > 0 && acc.length === 0) {
          // 思考型模型:正式回答前会先流思考内容。展示"正在推理"+尾部预览,避免学生盯空白"…"
          reasoning += think;
          const preview = reasoning.replace(/\s+/g, " ").trim().slice(-70);
          setMessages((prev) => prev.map((m) => (m.id === assistantId
            ? { ...m, content: `🧠 *正在推理…* ${preview}` }
            : m)));
        }
      } catch {}
    }
  }
  return acc;
}

/* ============ 主页面 ============ */

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentGate, setCurrentGate] = useState(1);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER);
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [studentId, setStudentId] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showGrowth, setShowGrowth] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [user, setUser] = useState<LoginUser | null>(null);
  const [loginReady, setLoginReady] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "warroom">("warroom");
  const [chatOpen, setChatOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [gateDataCache, setGateDataCache] = useState<Record<number, GateData>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const initDoneRef = useRef(false);
  // ---- 游戏化庆祝 ----
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [showCalligraphy, setShowCalligraphy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevRatingsRef = useRef<Map<number, Tier> | null>(null); // 上一份各关总评快照

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const pushToasts = useCallback((items: ToastItem[]) => {
    if (items.length) setToasts((prev) => [...items, ...prev].slice(0, 4));
  }, []);
  const closeTopCelebration = useCallback(() => {
    setCelebrations((prev) => prev.slice(1));
  }, []);

  // ---- 冠军回放：8 关金冠逐个亮起 → 终场「八冠王」庆祝 ----
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const replayTimer = useRef<number | null>(null);
  const startReplay = useCallback(() => {
    if (replayTimer.current) return;
    setReplayStep(0);
    let step = 0;
    replayTimer.current = window.setInterval(() => {
      step += 1;
      setReplayStep(step);
      if (step >= 8) {
        if (replayTimer.current) { window.clearInterval(replayTimer.current); replayTimer.current = null; }
        // 终场：品哥LOGO设计需求图光爆炸裂（先LOGO爆开 → 后大皇冠）
        window.setTimeout(() => {
          setShowCalligraphy(true);
          window.setTimeout(() => setReplayStep(null), 600); // 收尾回到真实状态
        }, 500);
      }
    }, 850);
  }, []);
  useEffect(() => () => { if (replayTimer.current) window.clearInterval(replayTimer.current); }, []);

  /** 应用一次档案更新：对比评级快照 + 消费 reward，触发全屏庆祝 / toast */
  const applyProfileUpdate = useCallback((next: StudentProfile, reward?: RewardDelta) => {
    const newRatings = new Map<number, Tier>();
    for (const g of next.gateProgress) {
      newRatings.set(g.gate, computeGateRating(g, next.interviewResults ?? []).overall);
    }
    const prev = prevRatingsRef.current;
    const cele: Celebration[] = [];
    const notes: ToastItem[] = [];

    if (prev) {
      // 关卡评级跃升检测
      for (const [gate, tier] of newRatings) {
        const before = prev.get(gate) ?? 0;
        if (tier > before) {
          const name = GATE_NAMES[gate] ?? `第${gate}关`;
          if (tier === 3) {
            cele.push({ kind: "gate_excellent", icon: "👑", color: "#ffd700",
              title: `第 ${gate} 关 · ${name}  优秀通关！`, sub: "三项综合达到优秀，金冠已收入囊中，继续冲下一关！" });
          } else if (tier === 2) {
            notes.push({ id: `good-${gate}-${Date.now()}`, kind: "note", icon: "★", color: "#cbd5e1",
              title: `第${gate}关 · 良好`, sub: `${name} 综合评级升到良好` });
          } else if (tier === 1) {
            notes.push({ id: `pass-${gate}-${Date.now()}`, kind: "note", icon: "✓", color: "#8b95a7",
              title: `第${gate}关 · 及格`, sub: `${name} 达到通关基线` });
          }
        }
      }
    }

    // reward：升级全屏庆祝 + 成就 toast
    if (reward) {
      if (reward.leveledUp) {
        const rank = rankForLevel(reward.toLevel);
        cele.push({ kind: "levelup", icon: rank.icon, color: rank.color,
          title: `升到 Lv.${reward.toLevel} · ${rank.name}`, sub: `经验值 +${reward.xpGained}，段位越来越硬核了！` });
      }
      for (const a of reward.newAchievements ?? []) {
        notes.push({ id: `ach-${a.id}-${Date.now()}`, kind: "achievement", achievement: a });
      }
    }

    prevRatingsRef.current = newRatings;
    if (cele.length) setCelebrations((p) => [...p, ...cele]);
    if (notes.length) pushToasts(notes);
    // 八关全部通关检测（仅记录，不再触发爆开——爆开由回放冠军流程触发）
    const completedCount = next.gateProgress.filter((g) => g.status === "completed").length;
    if (completedCount >= 8) {
      // LOGO爆开由回放冠军流程触发，此处不执行
    }
    setProfile(next);
  }, [pushToasts]);

  // ---- 初始化 ----
  useEffect(() => {
    if (initDoneRef.current) return;
    // 恢复未过期的学生登录态(P2-4):课中刷新不再被踢回登录页。
    // 教师走 /teacher,演示号每次重进以便完整回放,故此处只恢复真实学生。
    try {
      const raw = window.localStorage.getItem(STORAGE_USER);
      const savedId = window.localStorage.getItem(STORAGE_STUDENT_ID);
      const parsed = raw ? (JSON.parse(raw) as LoginUser & { ts?: number }) : null;
      const fresh = !!parsed && typeof parsed.ts === "number" && Date.now() - parsed.ts < LOGIN_TTL_MS;
      if (fresh && parsed!.loggedIn && !parsed!.isDemo && parsed!.role !== "teacher" && (parsed!.userId || savedId)) {
        setUser({ name: parsed!.name, role: parsed!.role, userId: parsed!.userId, loggedIn: true });
        setStudentId(parsed!.userId || savedId || "");
      } else {
        window.localStorage.removeItem(STORAGE_USER);
        window.localStorage.removeItem(STORAGE_STUDENT_ID);
      }
    } catch {
      try { window.localStorage.removeItem(STORAGE_USER); window.localStorage.removeItem(STORAGE_STUDENT_ID); } catch {}
    }
    setApiKey(loadStr(STORAGE_KEY, ""));
    setProviderId(loadStr(STORAGE_PROVIDER, DEFAULT_PROVIDER));
    setModelId(loadStr(STORAGE_MODEL, DEFAULT_MODEL));
    setMounted(true);
    setLoginReady(true);
    initDoneRef.current = true;
  }, []);

  // ---- 登录后加载档案 ----
  useEffect(() => {
    if (!mounted || !user?.loggedIn || !studentId) return;
    fetch(`/api/student?studentId=${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          applyProfileUpdate(d.profile); // 首次加载：建立评级基线，不庆祝
          // 同步档案中的角色和关卡信息
          const p = d.profile as StudentProfile;
          if (p.currentGate && p.currentGate !== currentGate) {
            setCurrentGate(p.currentGate);
            saveGate(p.currentGate);
          }
          // 更新欢迎消息以反映最新档案
          const displayRole = p.role || user!.role;
          const gate = p.currentGate || currentGate;
          const welcome = buildWelcomeMsg(user!.name, displayRole, gate);
          // 只在消息为空时设置（首次登录）
          if (messages.length === 0 || (messages.length === 1 && messages[0].id === "welcome")) {
            setMessages([welcome]);
          }
        }
      })
      .catch(() => {});
  }, [mounted, user, studentId]);

  // 会话记录
  useEffect(() => {
    if (!mounted || !user?.loggedIn || !studentId) return;
    fetch("/api/student", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, action: "record_session" }),
    }).catch(() => {});
  }, [mounted, user?.loggedIn, studentId]);

  useEffect(() => {
    if (!mounted || !user?.loggedIn || !studentId) return;
    saveMessagesForUser(studentId, messages);
  }, [messages, mounted, user?.loggedIn, studentId]);

  // ---- 加载全部关卡结构化数据（一次性）----
  useEffect(() => {
    if (!mounted || !user?.loggedIn) return;
    fetch("/api/gates")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.gates)) {
          const map: Record<number, GateData> = {};
          for (const g of d.gates as GateData[]) map[g.gate] = g;
          setGateDataCache(map);
        }
      })
      .catch(() => {});
  }, [mounted, user?.loggedIn]);

  const refreshProfile = useCallback(() => {
    if (!studentId) return;
    fetch(`/api/student?studentId=${studentId}`)
      .then((r) => r.json())
      .then((d) => { if (d.profile) applyProfileUpdate(d.profile, d.reward); })
      .catch(() => {});
  }, [studentId, applyProfileUpdate]);

  function handleEnterGate(n: number) {
    setGateWithPersist(n);
    setViewMode("warroom");
  }

  function handleAskCoach(message: string) {
    setChatOpen(true);
    send(message);
  }

  function hasInterviewDraft(gate: number) {
    const marker = `【第 ${gate} 关面试】`;
    return messages.some((m) => m.content.includes(marker));
  }

  function handleStartInterview(gate: number) {
    const gateName = gateDataCache[gate]?.name ?? `第${gate}关`;
    const prompt = hasInterviewDraft(gate)
      ? `【第 ${gate} 关面试】请继续刚才没有完成的模拟面试。先简短复述上一个问题和我的已答要点，再接着追问下一题，不要从头重新开始。`
      : `【第 ${gate} 关面试】请开始模拟面试。围绕「${gateName}」按真实面试官方式一次只问一个问题，先问第一题，等我回答后再追问。`;
    handleAskCoach(prompt);
  }

  const BASICS_MARKER = "【基础准入自测】";
  function hasBasicsDraft() {
    return messages.some((m) => m.content.includes(BASICS_MARKER));
  }
  function handleStartBasics() {
    handleAskCoach(`${BASICS_MARKER}请给我做基础准入自测。围绕大模型/幻觉、上下文窗口、Prompt四要素、结构化输出、Embedding与向量检索、RAG链路、Agent与工具调用、MCP、Evals 这 9 个基础概念,一次问一题,等我答完再问下一题,共问 8-10 题。我答完会点"结算基础自测"。`);
  }
  async function handleSettleBasics() {
    if (!studentId || settling) return;
    const startIdx = messages.map((m) => m.content.includes(BASICS_MARKER)).lastIndexOf(true);
    const convo = (startIdx >= 0 ? messages.slice(startIdx + 1) : messages)
      .filter((m) => m.content.trim() && !m.content.includes(BASICS_MARKER))
      .map((m) => ({ role: m.role, content: m.content }));
    if (convo.length < 2) { setErrorBanner("先答几题基础自测,再结算。"); return; }
    setSettling(true); setErrorBanner(null);
    try {
      const res = await fetch("/api/basics", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, transcript: convo, providerId, modelId, apiKey }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setErrorBanner(d.error || "基础自测结算失败"); setSettling(false); return; }
      const r = d.result;
      const card = `## 🧱 基础准入结算 · ${r.score} 分 · ${r.passed ? "✅ 地基已筑,解锁八关" : "❌ 未达标,建议回 OpenMAIC 补学"}\n\n` +
        (r.weakConcepts?.length ? `**薄弱概念**\n${r.weakConcepts.map((s: string) => `- ${s}`).join("\n")}\n\n` : "") +
        `**总评**:${r.comment}`;
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: card }]);
      if (d.profile) applyProfileUpdate(d.profile, d.reward);
    } catch { setErrorBanner("网络错误,基础自测结算未完成。"); }
    setSettling(false);
  }

  async function handleSettleInterview() {
    if (!studentId || settling) return;
    const marker = `【第 ${currentGate} 关面试】`;
    const startIdx = messages.map((m) => m.content.includes(marker)).lastIndexOf(true);
    // 取本次面试从 marker 起的问答(去掉那条 marker 指令本身)
    const convo = (startIdx >= 0 ? messages.slice(startIdx + 1) : messages)
      .filter((m) => m.content.trim() && !m.content.includes(marker))
      .map((m) => ({ role: m.role, content: m.content }));
    if (convo.length < 2) {
      setErrorBanner("先完成至少一轮面试问答,再结算成绩。");
      return;
    }
    setSettling(true);
    setErrorBanner(null);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, gate: currentGate, transcript: convo, providerId, modelId, apiKey }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setErrorBanner(d.error || "面试结算失败"); setSettling(false); return; }
      // 把记分卡作为一条教练消息插入对话
      const r = d.result;
      const card =
        `## 📋 面试结算 · ${r.score} 分 · ${r.passed ? "✅ 通过" : "❌ 未过"}\n\n` +
        (r.strengths?.length ? `**亮点**\n${r.strengths.map((s: string) => `- ${s}`).join("\n")}\n\n` : "") +
        (r.gaps?.length ? `**最伤漏洞**\n${r.gaps.map((s: string) => `- ${s}`).join("\n")}\n\n` : "") +
        `**总评**:${r.comment}`;
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: card }]);
      if (d.profile) applyProfileUpdate(d.profile, d.reward);
    } catch {
      setErrorBanner("网络错误,面试结算未完成,请重试。");
    }
    setSettling(false);
  }

  function handleChecklistToggle(itemKey: string, checked: boolean, total: number) {
    if (!studentId) return;
    fetch("/api/student", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, action: "toggle_checklist", gate: currentGate, itemKey, checked, totalItems: total }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.profile) applyProfileUpdate(d.profile, d.reward); })
      .catch(() => {});
  }

  const setGateWithPersist = useCallback((n: number) => {
    setCurrentGate(n);
    saveGate(n);
    if (studentId) {
      fetch("/api/student", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, action: "update_profile", patch: { currentGate: n } }),
      }).catch(() => {});
    }
  }, [studentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function saveKey(key: string) { setApiKey(key); if (key) window.localStorage.setItem(STORAGE_KEY, key); else window.localStorage.removeItem(STORAGE_KEY); }

  function handleModelChange(np: string, nm: string) {
    setProviderId(np); setModelId(nm);
    try { window.localStorage.setItem(STORAGE_PROVIDER, np); window.localStorage.setItem(STORAGE_MODEL, nm); } catch {}
  }

  const providerName = getProviderById(providerId)?.name ?? providerId;

  async function doChatRequest(msgs: Message[], aId: string, retry: boolean): Promise<{ ok: boolean; acc: string }> {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey, gate: currentGate, providerId, modelId, studentId,
          userRole: user?.role || "", userName: user?.name || "",
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const ej = await res.json().catch(() => ({ error: "未知错误" }));
        setErrorBanner(ej.error || `请求失败(${res.status})`);
        setMessages((prev) => prev.filter((m) => m.id !== aId));
        return { ok: false, acc: "" };
      }
      const acc = await streamChat(res, aId, setMessages);
      return { ok: true, acc };
    } catch {
      if (retry) {
        setErrorBanner("服务正在启动，自动重试中...");
        await new Promise((r) => setTimeout(r, 2500));
        setErrorBanner(null);
        return doChatRequest(msgs, aId, false);
      }
      setErrorBanner("无法连接服务。请确认服务已启动，地址 http://localhost:3000");
      setMessages((prev) => prev.filter((m) => m.id !== aId));
      return { ok: false, acc: "" };
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setErrorBanner(null);
    const userMsg: Message = { id: uid(), role: "user", content: trimmed };
    const aId = uid();
    const next = [...messages, userMsg];
    setMessages([...next, { id: aId, role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    const { ok } = await doChatRequest(next, aId, true);
    setSending(false);
    if (!ok) return;
    if (studentId) {
      fetch(`/api/student?studentId=${studentId}`).then((r) => r.json()).then((d) => { if (d.profile) applyProfileUpdate(d.profile, d.reward); }).catch(() => console.warn("[profile] failed to load"));
    }
  }

  function handleGatePick(n: number) {
    handleEnterGate(n);
    setShowMobileSidebar(false);
  }

  // ---- 登录处理 ----
  function handleLogin(userData: LoginUser) {
    try {
      window.localStorage.setItem(STORAGE_USER, JSON.stringify({ ...userData, ts: Date.now() }));
      window.localStorage.setItem(STORAGE_STUDENT_ID, userData.userId);
    } catch (e) {
      console.warn("[login] storage write failed (may be private mode):", e);
    }
    if (userData.role === "teacher") {
      window.location.href = "/teacher";
      return;
    }
    setUser(userData);
    setStudentId(userData.userId);
    const welcome = buildWelcomeMsg(userData.name, userData.role, currentGate);
    setMessages(loadMessagesForUser(userData.userId, welcome));
    if (userData.isDemo) {
      window.setTimeout(() => startReplay(), 600);
    }
  }

  
  function handleSwitchIdentity() {
    try {
      window.localStorage.removeItem(STORAGE_USER);
      window.localStorage.removeItem(STORAGE_STUDENT_ID);
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_PROVIDER);
      window.localStorage.removeItem(STORAGE_MODEL);
    } catch (e) {
      console.warn("[logout] storage cleanup failed:", e);
    }
    setUser(null);
    setProfile(null);
    prevRatingsRef.current = null; // 换账号：清空评级基线，避免误庆祝
    setCelebrations([]);
    setToasts([]);
    setStudentId("");
    setShowGrowth(false);
    setMessages([]);
    saveMessages([]);
  }
  function clearChat() {
    if (!window.confirm("确定要清除当前聊天记录吗?此操作不可撤销。")) return;
    const welcome = user ? buildWelcomeMsg(user.name, user.role, currentGate) : buildWelcomeMsg("用户", "student", currentGate);
    setMessages([welcome]);
    if (studentId) saveMessagesForUser(studentId, [welcome]);
    else saveMessages([welcome]);
  }

  // ---- 渲染 ----
  if (!mounted) return null;

  // 未登录 → 显示登录页面（仅学生/教师）
  if (loginReady && !user?.loggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // 已登录 → 聊天界面
  const identityLabel = user?.role === "teacher" ? "教师" : user?.role === "student" ? "学生" : user?.name ?? "用户";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-base">
      {/* 桌面端侧边栏 */}
      <aside className={`${showMobileSidebar ? "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl" : "hidden"} md:flex md:relative md:w-64 md:shrink-0 flex-col gap-4 border-r border-border/60 glass p-4 overflow-y-auto`}>
        <div className="flex items-center justify-between md:hidden mb-3">
          <span className="text-[13px] font-semibold text-muted">菜单</span>
          <button onClick={() => setShowMobileSidebar(false)} className="text-[20px] text-muted hover:text-text transition-colors">&times;</button>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="品哥"
              className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-accent/30 shadow-lg shadow-accent/10"
            />
            <div>
              <div className="text-[15px] font-extrabold tracking-tight text-white">
                AI 上岗实战<span className="text-accent">总教练</span>
              </div>
              <div className="text-[11px] text-muted hidden md:block">应用开发与智能体工程实战训练营</div>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-muted truncate">{identityLabel} · {user?.name}</span>
          </div>
        </div>

        <button
          onClick={() => { setViewMode("map"); setShowMobileSidebar(false); }}
          className={[
            "btn-spring glow-hover flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium",
            viewMode === "map" ? "border-accent2/50 bg-accent2/10 text-accent2 shadow-glow-soft" : "border-border/50 text-muted hover:text-text",
          ].join(" ")}
        >
          🗺️ 闯关地图
        </button>

        <GateLadder
          current={currentGate}
          completedGates={(profile?.gateProgress ?? []).filter((g) => g.status === "completed").map((g) => g.gate)}
          onPick={handleGatePick}
        />

        {profile && (
          <button
            onClick={() => setShowGrowth(!showGrowth)}
            className="btn-spring glow-hover flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px] text-accent hover:bg-accent/10"
          >
            <span className="text-base">{showGrowth ? "📊" : "🌱"}</span>
            {showGrowth ? "收起成长面板" : "我的成长面板"}
            {profile.sessionCount > 0 && (
              <span className="ml-auto text-[11px] text-muted">{profile.sessionCount}次训练</span>
            )}
          </button>
        )}

        {showGrowth && profile && <GrowthPanel profile={profile} />}

        <div className="h-px bg-border/50" />
        <button
          onClick={() => { setChatOpen(true); setShowMobileSidebar(false); }}
          className="btn-spring glow-hover flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-[12.5px] text-muted hover:text-accent"
        >
          💬 快捷口令 / 找教练聊
        </button>
        <div className="h-px bg-border/50" />

        <div className="hidden md:block">
          <ModelSelector providerId={providerId} modelId={modelId} onChange={handleModelChange} />
        </div>
        <div className="md:hidden">
          <button
            onClick={() => setShowMobileSettings((v) => !v)}
            className="btn-spring glow-hover flex w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-[12.5px] text-muted hover:text-text"
          >
            <span>⚙️ 模型与账号</span>
            <span className="text-[11px] text-accent2">{showMobileSettings ? "收起" : "展开"}</span>
          </button>
          {showMobileSettings && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/40 bg-base/35 p-2">
              <ModelSelector providerId={providerId} modelId={modelId} onChange={handleModelChange} />
              <button onClick={() => setModalOpen(true)} className="btn-spring glow-hover flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:text-text">
                <span>API Key</span>
                <span className="max-w-[120px] truncate text-[11px] text-accent2">{apiKey ? providerName : "未设置"}</span>
              </button>
              <div className="grid grid-cols-2 gap-1">
                <a href="/teacher" target="_blank" className="rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">教师面板</a>
                <a href="/admin" target="_blank" className="rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">后台管理</a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="h-px bg-border/50" />
          <button
            onClick={handleSwitchIdentity}
            className="btn-spring glow-hover flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:text-accent"
          >
            <span>🔄 切换身份</span>
          </button>
          <button onClick={clearChat} className="btn-spring glow-hover flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:!border-warn/40 hover:text-warn">
            <span>清除聊天记录</span>
          </button>
          <div className="hidden gap-1 md:flex">
            <a href="/teacher" target="_blank" className="flex-1 rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">教师面板</a>
            <a href="/admin" target="_blank" className="flex-1 rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">后台管理</a>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn-spring glow-hover hidden items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:text-text md:flex">
            <span>API Key</span>
            <span className="max-w-[80px] truncate text-[11px] text-accent2">{apiKey ? providerName : "未设置"}</span>
          </button>
        </div>
      </aside>
      {/* end sidebar */}

<main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 移动端顶部栏 */}
        <div className="hamburger-btn flex items-center gap-2 border-b border-border/60 bg-panel/60 px-3 py-2.5 safe-bottom">
          <button onClick={() => setShowMobileSidebar(true)} className="text-[20px] text-text hover:text-accent transition-colors">
            ☰
          </button>
          <img
            src="/logo.png"
            alt="品哥"
            className="h-7 w-7 shrink-0 rounded-lg object-cover ring-2 ring-accent/20"
          />
          <span className="text-[13px] font-semibold text-text truncate">
            {viewMode === "map" ? "闯关地图" : `第 ${currentGate} 关 · ${gateDataCache[currentGate]?.name ?? ""}`}
          </span>
          <span className="text-[11px] text-muted ml-auto">{identityLabel}</span>
        </div>

        {/* 常驻成长 HUD：段位 / 经验条 / 连击，明显位置随时可见 */}
        {profile && user?.role !== "teacher" && <RewardHud profile={profile} />}

        <div className="flex-1 overflow-y-auto">
          {viewMode === "map" && (
            <>
              {/* 八冠全部点亮后：在闯关地图页面上方直接炸出「我命由我不由天」 */}
              {showCalligraphy && (
                <div className="burst-wrapper">
                  <CalligraphyBurst onClose={() => {
                    setShowCalligraphy(false);
                    if (profile) {
                      setCelebrations((p) => [...p, buildAiMedalCelebration(profile, user?.name ?? "同学")]);
                    }
                  }} />
                </div>
              )}
              {replayStep === null && <EnvBanner />}
              {profile && replayStep === null && (
                <BasicsBanner readiness={profile.basicsReadiness} onStartBasics={handleStartBasics} />
              )}
              {profile && (
                <GateMap
                  currentGate={currentGate}
                  gateProgress={profile.gateProgress}
                  interviewResults={profile.interviewResults ?? []}
                  onEnter={handleEnterGate}
                  replayStep={replayStep}
                  onStartReplay={startReplay}
                />
              )}
            </>
          )}
          {viewMode === "warroom" && gateDataCache[currentGate] && (
            <GateWarRoom
              gateData={gateDataCache[currentGate]}
              gateProgress={profile?.gateProgress.find((g) => g.gate === currentGate)}
              profile={profile}
              studentId={studentId}
              providerId={providerId}
              modelId={modelId}
              apiKey={apiKey}
              onAskCoach={handleAskCoach}
              onStartInterview={() => handleStartInterview(currentGate)}
              hasInterviewDraft={hasInterviewDraft(currentGate)}
              onChecklistToggle={handleChecklistToggle}
              onSubmissionDone={(p, r) => { if (p) applyProfileUpdate(p, r); else refreshProfile(); }}
            />
          )}
          {viewMode === "warroom" && !gateDataCache[currentGate] && (
            <div className="flex h-full items-center justify-center text-[13px] text-muted">加载关卡数据中…</div>
          )}
        </div>

        {/* 浮动"问教练"按钮 */}
        <button
          onClick={() => setChatOpen(true)}
          className="btn-spring absolute bottom-5 right-5 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-[13px] font-semibold text-base shadow-glow-teal hover:brightness-110"
        >
          💬 问教练
        </button>

        {/* 每日脉搏：真实联网抓取，独立结构化面板 */}
        {pulseOpen && <PulseFeed apiKey={apiKey} onClose={() => setPulseOpen(false)} />}

        {/* 聊天侧滑抽屉 */}
        {!pulseOpen && chatOpen && (
          <div className="absolute inset-0 z-40 flex flex-col bg-base/90 backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-border/60 bg-panel/60 px-3 py-2.5 md:px-6">
              <span className="text-[13.5px] font-semibold text-text">💬 和教练对话</span>
              <span className="text-[11px] text-muted">第 {currentGate} 关 · {providerName}</span>
              {hasBasicsDraft() ? (
                <button
                  onClick={handleSettleBasics}
                  disabled={settling || sending}
                  className="btn-spring ml-auto rounded-lg border border-amber-300/50 bg-amber-300/10 px-2.5 py-1 text-[12px] font-semibold text-amber-200 hover:bg-amber-300/20 disabled:opacity-50"
                  title="让教练给这次基础自测打分,决定是否解锁八关"
                >
                  🧱 {settling ? "结算中…" : "结算基础自测"}
                </button>
              ) : hasInterviewDraft(currentGate) && (
                <button
                  onClick={handleSettleInterview}
                  disabled={settling || sending}
                  className="btn-spring ml-auto rounded-lg border border-amber-300/50 bg-amber-300/10 px-2.5 py-1 text-[12px] font-semibold text-amber-200 hover:bg-amber-300/20 disabled:opacity-50"
                  title="让教练给这次模拟面试打分,成绩计入面试门与档案"
                >
                  🎤 {settling ? "结算中…" : "结束并结算面试"}
                </button>
              )}
              <button onClick={() => setChatOpen(false)} className={`${hasBasicsDraft() || hasInterviewDraft(currentGate) ? "" : "ml-auto"} rounded-lg border border-border/50 px-2.5 py-1 text-[12px] text-muted hover:border-accent/40 hover:text-accent`}>
                收起 ✕
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 md:px-6 py-3 md:py-6">
              {messages.map((m) => (<ChatMessage key={m.id} message={m} />))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border bg-panel px-4 py-2.5 text-[13px] text-muted">
                    教练正在思考<span className="animate-pulse">…</span>
                  </div>
                </div>
              )}
            </div>

            {errorBanner && (
              <div className="mx-3 md:mx-6 mb-2 whitespace-pre-line rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-300">
                {errorBanner}
              </div>
            )}

            <div className="border-t border-border/60 bg-panel/40 p-3 md:p-4 safe-bottom">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <QuickCommandBar
                  onPick={send}
                  disabled={sending}
                  inline
                  onSpecial={(id) => {
                    if (id === "pulse") { setPulseOpen(true); return true; }
                    return false;
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="跟教练说点什么…(Enter 发送,Shift+Enter 换行)" rows={2}
                  className="flex-1 resize-none rounded-xl border border-border bg-base px-3.5 py-2.5 text-[14px] text-text outline-none placeholder:text-muted/60 focus:border-accent2"
                />
                <button onClick={() => send(input)} disabled={sending || !input.trim()}
                  className="btn-spring h-full shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base shadow-glow-teal hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                  发送
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <ApiKeyModal providerName={providerName} open={modalOpen} initialKey={apiKey} onClose={() => setModalOpen(false)} onSave={saveKey} />

      {/* 全屏庆祝（升级 / 单关优秀）+ 成就 toast */}
      {celebrations.length > 0 && (
        <CelebrationOverlay celebration={celebrations[0]} onClose={closeTopCelebration} />
      )}


      <AchievementToast items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
