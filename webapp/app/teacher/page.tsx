"use client";

import { useEffect, useState } from "react";
import { COURSE_WEEKS, TEACHER_PROMPTS } from "@/lib/enterpriseTraining";
import EnvBanner from "@/components/EnvBanner";

const STORAGE_USER = "ai-coach-login-user";

type SelfCheckDetailItem = { criterion: string; content: string; score?: number; passed?: boolean; feedback: string };
type SubmissionDetail = { status: string; score?: number; topGap: string; link: string } | null;
type InterviewDetail = { score: number; passed: boolean; gaps: string[]; comment: string } | null;
type BasicsReadinessLite = { score: number; passed: boolean; weakConcepts: string[] } | null;

type StudentSummary = {
  studentId: string;
  name: string;
  role: string;
  major: string;
  targetRole: string;
  basicsReadiness: BasicsReadinessLite;
  currentGate: number;
  currentGateName: string;
  selfCheckDetail: SelfCheckDetailItem[];
  submissionDetail: SubmissionDetail;
  interviewDetail: InterviewDetail;
  gatesCompleted: number;
  sessionCount: number;
  lastSessionAt: string;
  skillsCount: number;
  missingDoors: string[];
  daysInactive: number;
  blocked: boolean;
  needsNudge: boolean;
  nextAction: string;
  openRequests: { id: string; gate: number; title: string; detail: string; createdAt: string }[];
  evidenceCompletion: number;
  projectSelection: { projectName: string; totalScore: number; verdict: string } | null;
};

type ClassHotspot = { label: string; count: number };

type TeacherSummary = {
  total: number;
  blocked: number;
  needsNudge: number;
  inactive7d: number;
  completedAll: number;
  avgCompleted: number;
};

export default function TeacherPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [hotspots, setHotspots] = useState<ClassHotspot[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingFeedback, setSavingFeedback] = useState<Record<string, boolean>>({});
  const [teacherTab, setTeacherTab] = useState<"students" | "plan" | "prompts">("students");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_USER);
      if (!raw) return;
      const saved = JSON.parse(raw) as { userId?: string; name?: string; role?: string; loggedIn?: boolean };
      if (saved?.loggedIn && saved.role === "teacher" && saved.userId) {
        setTeacherId(saved.userId);
        setName(saved.name || "");
        setAuthenticated(true);
        loadStudents(saved.userId);
      }
    } catch {}
  }, []);

  async function doLogin() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", name, password, expectedRole: "teacher" }),
      });
      const data = await res.json();
      if (data.ok) {
        try {
          window.localStorage.setItem(STORAGE_USER, JSON.stringify({
            name: data.user.name,
            role: data.user.role,
            userId: data.user.userId,
            loggedIn: true,
          }));
        } catch {}
        setTeacherId(data.user.userId);
        setAuthenticated(true);
        await loadStudents(data.user.userId);
      } else {
        setError(data.error || "登录失败");
      }
    } catch { setError("网络错误"); }
    setLoading(false);
  }

  async function loadStudents(tid: string) {
    try {
      const res = await fetch(`/api/teacher?teacherId=${tid}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "教师数据读取失败");
        setStudents([]);
        setSummary(null);
        return;
      }
      setStudents(data.students || []);
      setSummary(data.summary || null);
      setHotspots(data.classHotspots || []);
    } catch {
      setError("教师数据读取失败，请确认服务已启动");
    }
  }

  async function saveTeacherFeedback(s: StudentSummary) {
    const detail = (feedbackDrafts[s.studentId] || "").trim();
    const scoreRaw = scoreDrafts[s.studentId] || "";
    const score = scoreRaw ? Math.max(0, Math.min(100, Number(scoreRaw))) : undefined;
    const responseGate = s.openRequests[0]?.gate || s.currentGate;
    if (!detail) {
      setError("请先填写教师指导意见");
      return;
    }
    setError("");
    setSavingFeedback((prev) => ({ ...prev, [s.studentId]: true }));
    try {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teacherId,
          studentId: s.studentId,
          gate: responseGate,
          detail: `${detail}\n\n建议动作：${s.nextAction}`,
          score,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(data.error || "保存教师意见失败");
      } else {
        setFeedbackDrafts((prev) => ({ ...prev, [s.studentId]: "" }));
        setScoreDrafts((prev) => ({ ...prev, [s.studentId]: "" }));
        await loadStudents(teacherId);
      }
    } catch {
      setError("网络错误，保存教师意见失败");
    }
    setSavingFeedback((prev) => ({ ...prev, [s.studentId]: false }));
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-3 md:p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel p-5 shadow-2xl md:p-6">
          <div className="mb-4 flex justify-center">
            <img
              src="/logo.png"
              alt="品哥"
              className="h-14 w-14 rounded-xl object-cover ring-1 ring-accent/20 shadow-md"
            />
          </div>
          <h1 className="mb-1 text-xl font-bold text-white">教师工作台</h1>
          <p className="mb-4 text-[13px] text-muted">登录后查看全班进度、卡关学生和介入建议。</p>
          <input className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2.5 text-sm text-text outline-none focus:border-accent2" placeholder="教师用户名" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          <input type="password" className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2.5 text-sm text-text outline-none focus:border-accent2" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <button onClick={doLogin} disabled={loading} className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-40">
            {loading ? "登录中..." : "登录"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base px-3 py-3 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-0 z-20 -mx-3 mb-4 border-b border-border/60 bg-base/95 px-3 py-3 backdrop-blur md:static md:mx-0 md:mb-6 md:border-0 md:bg-transparent md:p-0">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="品哥"
              className="h-9 w-9 rounded-lg object-cover ring-1 ring-accent/20"
            />
            <div>
              <h1 className="text-lg font-bold text-white md:text-2xl">教师工作台</h1>
              <p className="text-[12px] text-muted md:text-[13px]">{students.length} 名学生 · 按干预优先级排序</p>
            </div>
          </div>
          <button
            onClick={() => {
              try { window.localStorage.removeItem(STORAGE_USER); } catch {}
              setAuthenticated(false);
              setTeacherId("");
            }}
            className="shrink-0 rounded-lg border border-border/50 px-3 py-2 text-[12px] text-muted hover:text-text md:px-4 md:text-[13px]"
          >
            退出
          </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}

        <EnvBanner />

        {summary && (
          <div className="mb-4 grid grid-cols-2 gap-2 md:mb-5 md:grid-cols-5 md:gap-3">
            <Stat label="学生总数" value={summary.total} tone="cyan" />
            <Stat label="需干预" value={summary.needsNudge} tone={summary.needsNudge > 0 ? "amber" : "cyan"} />
            <Stat label="疑似卡关" value={summary.blocked} tone={summary.blocked > 0 ? "red" : "cyan"} />
            <Stat label="7天未活跃" value={summary.inactive7d} tone={summary.inactive7d > 0 ? "amber" : "cyan"} />
            <Stat label="平均通关" value={`${summary.avgCompleted}/8`} tone="cyan" />
          </div>
        )}

        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/50">
          {([
            ["students", "学生进度"],
            ["plan", "16周计划"],
            ["prompts", "快捷指令"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTeacherTab(id)}
              className={[
                "border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap",
                teacherTab === id ? "border-accent2 text-accent2" : "border-transparent text-muted hover:text-text",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {teacherTab === "plan" && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {COURSE_WEEKS.map((w) => (
              <div key={w.week} className="rounded-xl border border-border/50 bg-panel/35 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-text">第{w.week}周 · {w.title}</div>
                  <span className="rounded-full border border-accent2/30 px-2 py-0.5 text-[11px] text-accent2">第{w.gate}关</span>
                </div>
                <div className="space-y-1 text-[12px] text-muted">
                  <div>企业能力：{w.enterpriseCapability}</div>
                  <div>学生交付：{w.studentDeliverable}</div>
                  <div>教师介入：{w.teacherIntervention}</div>
                  <div className="text-text/80">验收：{w.acceptance}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {teacherTab === "prompts" && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {TEACHER_PROMPTS.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/50 bg-panel/35 p-3">
                <div className="mb-1 text-[13px] font-semibold text-text">{p.title}</div>
                <div className="mb-2 text-[12px] text-muted">{p.audience} · 输出：{p.output}</div>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-base/60 p-2 text-[11.5px] text-text/80">{p.prompt}</pre>
                <button
                  onClick={() => navigator.clipboard?.writeText(p.prompt).catch(() => {})}
                  className="mt-2 rounded-md border border-accent2/40 px-2.5 py-1.5 text-[12px] text-accent2 hover:bg-accent2/10"
                >
                  复制指令
                </button>
              </div>
            ))}
          </div>
        )}

        {teacherTab === "students" && students.length === 0 && (
          <div className="rounded-xl border border-border/50 bg-panel/35 px-6 py-12 text-center">
            <div className="text-[15px] font-semibold text-text">暂无学生数据</div>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">
              先在管理员后台创建学生账号，并在“师生绑定”里把学生分配给当前教师；学生登录训练后，这里会显示学习成果、训练数据和求助请求。
            </p>
            <a href="/admin" target="_blank" className="mt-4 inline-flex rounded-lg border border-accent2/40 px-3 py-2 text-[13px] font-medium text-accent2 hover:bg-accent2/10">
              打开管理员后台
            </a>
          </div>
        )}

        {teacherTab === "students" && hotspots.length > 0 && (
          <div className="mb-4 rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 md:p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[15px]">🔥</span>
              <span className="text-[14px] font-bold text-orange-200">全班高频卡点榜</span>
              <span className="text-[11px] text-muted">按人次聚合自检未过 / 评审差距 / 面试短板 · 用于决定下节课重讲什么</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hotspots.map((h) => (
                <span key={h.label} className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-base/40 px-2.5 py-1 text-[12px] text-text/90">
                  {h.label}
                  <span className="rounded-full bg-orange-400/20 px-1.5 text-[11px] font-bold text-orange-200">{h.count}人</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {teacherTab === "students" && <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <div key={s.studentId} className={`rounded-xl border p-3 md:p-4 ${s.blocked ? "border-red-500/30 bg-red-500/5" : s.needsNudge ? "border-yellow-500/25 bg-yellow-500/5" : "border-border/50 bg-panel/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="min-w-0 truncate text-[14px] font-semibold text-text md:text-[15px]" title={s.studentId}>{s.name}</span>
                {s.blocked ? (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">卡关</span>
                ) : s.needsNudge ? (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">需跟进</span>
                ) : (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-300">正常</span>
                )}
              </div>
              <div className="space-y-1 text-[12px] text-muted">
                <div>身份：{s.role} · 目标：{s.targetRole || "未设"}</div>
                <div>关卡：{s.gatesCompleted}/8 已通过 | 当前第{s.currentGate}关 · {s.currentGateName}</div>
                <div>缺口：{s.missingDoors?.length ? s.missingDoors.join(" / ") : "三门齐备"}</div>
                <div>技能：{s.skillsCount} 项 | 训练 {s.sessionCount} 次</div>
                <div>证据包：{s.evidenceCompletion}% | 选题：{s.projectSelection ? `${s.projectSelection.projectName}（${s.projectSelection.totalScore}分）` : "未提交"}</div>
                <div>最近活跃：{s.lastSessionAt ? `${s.lastSessionAt.slice(0, 10)} · ${s.daysInactive}天前` : "无"}</div>
              </div>
              <div className="mt-3 rounded-lg border border-border/40 bg-base/35 px-2.5 py-2 text-[12px] text-text/85">
                下一步：<span className="text-accent2">{s.nextAction}</span>
              </div>

              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [s.studentId]: !prev[s.studentId] }))}
                className="mt-3 flex w-full items-center justify-between rounded-lg border border-border/40 bg-base/25 px-2.5 py-1.5 text-[12px] text-text/85 hover:text-accent2"
              >
                <span>🔍 面谈前速览（自检 / 评审 / 面试实锤）</span>
                <span className="text-muted">{expanded[s.studentId] ? "收起 ▲" : "展开 ▼"}</span>
              </button>
              {expanded[s.studentId] && (
                <div className="mt-2 space-y-2 rounded-lg border border-border/40 bg-base/20 p-2.5 text-[12px]">
                  {s.basicsReadiness && (
                    <div className={s.basicsReadiness.passed ? "text-emerald-300" : "text-amber-300"}>
                      🧱 基础准入：{s.basicsReadiness.passed ? "已过" : "未过"} · {s.basicsReadiness.score}分
                      {s.basicsReadiness.weakConcepts?.length ? ` · 待补：${s.basicsReadiness.weakConcepts.join("、")}` : ""}
                    </div>
                  )}
                  <div>
                    <div className="mb-1 font-semibold text-text/80">当前第{s.currentGate}关 · 自检</div>
                    {s.selfCheckDetail.length === 0 ? (
                      <div className="text-muted">尚未提交自检</div>
                    ) : (
                      <ul className="space-y-1">
                        {s.selfCheckDetail.map((it, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span>{it.passed === true ? "🟢" : it.passed === false ? "🔴" : "⚪"}</span>
                            <span className="text-text/85">
                              <span className="font-medium">{it.criterion || `${it.content.slice(0, 24)}…`}</span>
                              {typeof it.score === "number" ? ` · ${it.score}分` : ""}
                              {it.feedback ? <span className="text-muted"> — {it.feedback}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-text/80">GitHub 评审</div>
                    {s.submissionDetail ? (
                      <div className="text-text/85">
                        <span className={s.submissionDetail.status === "approved" ? "text-emerald-300" : "text-red-300"}>
                          {s.submissionDetail.status === "approved" ? "通过" : "驳回"}
                        </span>
                        {typeof s.submissionDetail.score === "number" ? ` · ${s.submissionDetail.score}分` : ""}
                        {s.submissionDetail.topGap ? <span className="text-muted"> · 最大差距：{s.submissionDetail.topGap}</span> : null}
                      </div>
                    ) : (
                      <div className="text-muted">尚未提交仓库评审</div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-text/80">模拟面试</div>
                    {s.interviewDetail ? (
                      <div className="text-text/85">
                        <span className={s.interviewDetail.passed ? "text-emerald-300" : "text-amber-300"}>
                          {s.interviewDetail.passed ? "通过" : "未过"}
                        </span>
                        {` · ${s.interviewDetail.score}分`}
                        {s.interviewDetail.gaps.length ? <span className="text-muted"> · 短板：{s.interviewDetail.gaps.join("、")}</span> : null}
                      </div>
                    ) : (
                      <div className="text-muted">本关尚无面试记录</div>
                    )}
                  </div>
                </div>
              )}

              {s.openRequests.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2">
                  <div className="mb-1 text-[12px] font-semibold text-amber-200">学生请求</div>
                  <div className="space-y-1.5">
                    {s.openRequests.slice(0, 2).map((r) => (
                      <div key={r.id} className="text-[12px] text-text/90">
                        <div className="font-medium">第{r.gate}关 · {r.title}</div>
                        <div className="text-muted">{r.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-border/40 bg-base/25 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreDrafts[s.studentId] || ""}
                    onChange={(e) => setScoreDrafts((prev) => ({ ...prev, [s.studentId]: e.target.value }))}
                    placeholder="预评分"
                    className="w-20 rounded-md border border-border bg-base px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent2"
                  />
                  <span className="text-[11px] text-muted">教师介入评价</span>
                </div>
                <textarea
                  value={feedbackDrafts[s.studentId] || ""}
                  onChange={(e) => setFeedbackDrafts((prev) => ({ ...prev, [s.studentId]: e.target.value }))}
                  placeholder="写给学生的下一步指导、卡点判断或课堂介入建议"
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-base px-2 py-1.5 text-[12px] text-text outline-none placeholder:text-muted/60 focus:border-accent2"
                />
                <button
                  onClick={() => saveTeacherFeedback(s)}
                  disabled={savingFeedback[s.studentId]}
                  className="mt-2 rounded-md border border-accent2/40 px-2.5 py-1.5 text-[12px] font-medium text-accent2 hover:bg-accent2/10 disabled:opacity-50"
                >
                  {savingFeedback[s.studentId] ? "保存中..." : "保存到学生档案"}
                </button>
              </div>
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(s.gatesCompleted / 8) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "cyan" | "amber" | "red" }) {
  const cls = tone === "red"
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : tone === "amber"
      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
      : "border-accent2/25 bg-accent2/5 text-accent2";
  return (
    <div className={`rounded-xl border px-3 py-3 ${cls}`}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
    </div>
  );
}
