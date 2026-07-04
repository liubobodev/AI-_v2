"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import GateLadder from "@/components/GateLadder";
import QuickCommandBar from "@/components/QuickCommandBar";
import ApiKeyModal from "@/components/ApiKeyModal";
import ModelSelector from "@/components/ModelSelector";
import GrowthPanel from "@/components/GrowthPanel";
import { checkFormat, formatWarning } from "@/lib/formatCheck";
import { getProviderById } from "@/lib/models";
import type { StudentProfile } from "@/lib/studentTypes";

const STORAGE_KEY = "ai-coach-api-key";
const STORAGE_MESSAGES = "ai-coach-messages";
const STORAGE_GATE = "ai-coach-current-gate";
const STORAGE_PROVIDER = "ai-coach-provider";
const STORAGE_MODEL = "ai-coach-model";
const STORAGE_STUDENT_ID = "ai-coach-student-id";
const STORAGE_USER = "ai-coach-login-user";
const MAX_STORED_MESSAGES = 50;

const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_MODEL = "deepseek-v4-flash";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ============ 登录页面组件（仅学生/教师） ============ */

type LoginUser = { name: string; role: string; userId: string; loggedIn: boolean };

function LoginScreen({
  onLogin,
}: {
  onLogin: (user: LoginUser) => void;
}) {
  const [mode, setMode] = useState<"" | "student" | "teacher">("");
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
        body: JSON.stringify({ action: "login", name: username.trim(), password, expectedRole: mode }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        onLogin({
          name: data.user.name,
          role: data.user.role,
          userId: data.user.userId,
          loggedIn: true,
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
      <div className="flex min-h-screen items-center justify-center bg-base p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel p-6 shadow-2xl">
          <button
            onClick={() => { setMode(""); setLoginError(""); }}
            className="mb-4 text-[13px] text-muted hover:text-text transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-white mb-1">
            {mode === "teacher" ? "教师登录" : "学生登录"}
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
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-panel p-6 shadow-2xl">
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

function saveMessages(msgs: Message[]) {
  try {
    const trimmed = msgs.length > MAX_STORED_MESSAGES ? msgs.slice(-MAX_STORED_MESSAGES) : msgs;
    window.localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(trimmed));
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
  let buffer = "", acc = "";
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
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          acc += delta;
          const snap = acc;
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m)));
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
  const [user, setUser] = useState<LoginUser | null>(null);
  const [loginReady, setLoginReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initDoneRef = useRef(false);

  // ---- 初始化 ----
  useEffect(() => {
    if (initDoneRef.current) return;
    
    // 检查是否有已登录的用户
    try {
      const savedUser = window.sessionStorage.getItem(STORAGE_USER);
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as LoginUser;
        if (parsed.loggedIn) {
          setUser(parsed);
          setStudentId(parsed.userId);
          setApiKey(loadStr(STORAGE_KEY, ""));
          setCurrentGate(loadGate());
          setProviderId(loadStr(STORAGE_PROVIDER, DEFAULT_PROVIDER));
          setModelId(loadStr(STORAGE_MODEL, DEFAULT_MODEL));
          const welcome = buildWelcomeMsg(parsed.name, parsed.role, loadGate());
          setMessages(loadMessages(welcome));
          setMounted(true);
          setLoginReady(true);
          initDoneRef.current = true;
          return;
        }
      }
    } catch {}

    // 未登录
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
          setProfile(d.profile);
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

  useEffect(() => { if (!mounted) return; saveMessages(messages); }, [messages, mounted]);

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
    const { ok, acc } = await doChatRequest(next, aId, true);
    setSending(false);
    if (!ok) return;
    if (acc.length > 100) {
      const report = checkFormat(acc);
      if (!report.ok) {
        const w = formatWarning(report.missing);
        setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content: acc + w } : m)));
      }
    }
    if (studentId) {
      fetch(`/api/student?studentId=${studentId}`).then((r) => r.json()).then((d) => { if (d.profile) setProfile(d.profile); }).catch(() => {});
    }
  }

  function handleGatePick(n: number, name: string) {
    setGateWithPersist(n);
    send(`我现在在第 ${n} 关「${name}」,请简要说明这一关的重点、教师高阶知识点、以及验收标准。`);
  }

  // ---- 登录处理 ----
  function handleLogin(userData: LoginUser) {
    setUser(userData);
    setStudentId(userData.userId);
    window.sessionStorage.setItem(STORAGE_USER, JSON.stringify(userData));
    window.localStorage.setItem(STORAGE_STUDENT_ID, userData.userId);

    // 设置初始欢迎消息
    const welcome = buildWelcomeMsg(userData.name, userData.role, currentGate);
    setMessages([welcome]);
  }

  function handleSwitchIdentity() {
    window.sessionStorage.removeItem(STORAGE_USER);
    setUser(null);
    setProfile(null);
    setShowGrowth(false);
    setMessages([]);
    saveMessages([]);
  }

  function clearChat() {
    if (!window.confirm("确定要清除当前聊天记录吗?此操作不可撤销。")) return;
    const welcome = user ? buildWelcomeMsg(user.name, user.role, currentGate) : buildWelcomeMsg("用户", "student", currentGate);
    setMessages([welcome]);
    saveMessages([welcome]);
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
      <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-border/60 bg-panel/40 p-4 overflow-y-auto">
        <div>
          <div className="text-[15px] font-extrabold tracking-tight text-white">
            AI 上岗实战<span className="text-accent">总教练</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">应用开发与智能体工程实战训练营</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-muted">{identityLabel} · {user?.name}</span>
          </div>
        </div>

        <GateLadder current={currentGate} onPick={handleGatePick} />

        {profile && (
          <button
            onClick={() => setShowGrowth(!showGrowth)}
            className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px] text-accent transition hover:bg-accent/10"
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
        <QuickCommandBar onPick={send} disabled={sending} />
        <div className="h-px bg-border/50" />
        <ModelSelector providerId={providerId} modelId={modelId} onChange={handleModelChange} />

        <div className="mt-auto flex flex-col gap-2">
          <div className="h-px bg-border/50" />
          <button
            onClick={handleSwitchIdentity}
            className="flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:border-accent/40 hover:text-accent transition-colors"
          >
            <span>🔄 切换身份</span>
          </button>
          <button onClick={clearChat} className="flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:border-warn/40 hover:text-warn transition-colors">
            <span>清除聊天记录</span>
          </button>
          <div className="flex gap-1">
            <a href="/teacher" target="_blank" className="flex-1 rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">教师面板</a>
            <a href="/admin" target="_blank" className="flex-1 rounded-lg border border-border/50 px-2 py-1.5 text-center text-[11px] text-muted hover:border-accent/30 hover:text-accent transition-colors">后台管理</a>
          </div>
          <button onClick={() => setModalOpen(true)} className="flex items-center justify-between rounded-lg border border-border/50 px-2.5 py-2 text-[12.5px] text-muted hover:border-accent2/40 hover:text-text">
            <span>API Key</span>
            <span className="max-w-[80px] truncate text-[11px] text-accent2">{apiKey ? providerName : "未设置"}</span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
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
          <div className="mx-6 mb-2 whitespace-pre-line rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-300">
            {errorBanner}
          </div>
        )}

        <div className="border-t border-border/60 bg-panel/40 p-4">
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="跟教练说点什么…(Enter 发送,Shift+Enter 换行)" rows={2}
              className="flex-1 resize-none rounded-xl border border-border bg-base px-3.5 py-2.5 text-[14px] text-text outline-none placeholder:text-muted/60 focus:border-accent2"
            />
            <button onClick={() => send(input)} disabled={sending || !input.trim()}
              className="h-full shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
              发送
            </button>
          </div>
        </div>
      </main>

      <ApiKeyModal providerName={providerName} open={modalOpen} initialKey={apiKey} onClose={() => setModalOpen(false)} onSave={saveKey} />
    </div>
  );
}
