"use client";

import { useEffect, useState } from "react";

type StudentSummary = {
  studentId: string;
  role: string;
  major: string;
  targetRole: string;
  currentGate: number;
  gatesCompleted: number;
  sessionCount: number;
  lastSessionAt: string;
  skillsCount: number;
  blocked: boolean;
};

export default function TeacherPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doLogin() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", name, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setTeacherId(data.user.userId);
        setAuthenticated(true);
        loadStudents(data.user.userId);
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
      setStudents(data.students || []);
    } catch {}
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel p-6">
          <h1 className="mb-4 text-xl font-bold text-white">教师登录</h1>
          <input className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="用户名" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          <input type="password" className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <button onClick={doLogin} disabled={loading} className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-40">
            {loading ? "登录中..." : "登录"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">教师面板</h1>
            <p className="text-[13px] text-muted">{students.length} 名学生</p>
          </div>
          <button onClick={() => { setAuthenticated(false); setTeacherId(""); }} className="rounded-lg border border-border/50 px-4 py-2 text-[13px] text-muted hover:text-text">退出</button>
        </div>

        {students.length === 0 && <div className="py-12 text-center text-muted">暂无学生数据</div>}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <div key={s.studentId} className={`rounded-xl border p-4 ${s.blocked ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-panel/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[15px] font-semibold text-text">{s.studentId.slice(0, 12)}...</span>
                {s.blocked && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">卡关</span>}
              </div>
              <div className="space-y-1 text-[12px] text-muted">
                <div>身份：{s.role} | 目标：{s.targetRole || "未设"}</div>
                <div>关卡：{s.gatesCompleted}/8 已通过 | 当前第{s.currentGate}关</div>
                <div>技能：{s.skillsCount} 项 | 训练 {s.sessionCount} 次</div>
                <div>最近活跃：{s.lastSessionAt ? s.lastSessionAt.slice(0, 10) : "无"}</div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(s.gatesCompleted / 8) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
