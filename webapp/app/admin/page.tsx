"use client";

import { useEffect, useState } from "react";
import { COURSE_WEEKS, FRONTIER_ANCHORS, PROJECT_CATEGORIES, PROJECT_SCORE_CRITERIA } from "@/lib/enterpriseTraining";

type User = { userId: string; name: string; role: string; createdAt: string; lastLoginAt: string; isDemo?: boolean; studentIds?: string[] };

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [securityWarning, setSecurityWarning] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newPw, setNewPw] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");

  async function doLogin() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "admin_login", password: adminPw }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthenticated(true);
        setSecurityWarning(data.security?.usingDefaultAdminPassword ? "当前未配置 ADMIN_PASSWORD，正在使用本地初始化管理员密码。正式上课或部署前必须设置环境变量。" : "");
        loadUsers();
      }
      else setError(data.error || "密码错误");
    } catch { setError("网络错误"); }
    setLoading(false);
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list", admin: adminPw }),
      });
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
      else setError(data.error || "读取用户失败");
    } catch { setError("网络错误，读取用户失败"); }
  }

  async function createNewUser() {
    if (!newName || !newPw) return;
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", admin: adminPw, name: newName, role: newRole, password: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setNewName(""); setNewPw(""); loadUsers(); }
      else setError(data.error || "创建失败");
    } catch { setError("网络错误，创建失败"); }
  }

  async function removeUser(userId: string) {
    if (!confirm("确定删除？")) return;
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", admin: adminPw, userId }),
      });
      loadUsers();
    } catch {}
  }

  async function assignStudent() {
    if (!assignTeacherId || !assignStudentId) return;
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "assign_student", admin: adminPw, teacherId: assignTeacherId, studentId: assignStudentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) setError(data.error || "绑定失败");
      else loadUsers();
    } catch { setError("网络错误，绑定失败"); }
  }

  async function unassignStudent(teacherId: string, studentId: string) {
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unassign_student", admin: adminPw, teacherId, studentId }),
      });
      loadUsers();
    } catch {}
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel p-6">
          <h1 className="mb-4 text-xl font-bold text-white">管理员登录</h1>
          <input type="password" className="mb-3 w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="管理员密码" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <button onClick={doLogin} disabled={loading} className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-40">
            {loading ? "登录中..." : "登录"}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            管理员密码从环境变量 <span className="font-mono text-accent2">ADMIN_PASSWORD</span> 读取。若未配置，本地开发会使用初始化密码；正式上课前请务必改掉。
          </p>
        </div>
      </div>
    );
  }

  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const studentCount = users.filter((u) => u.role === "student").length;
  const teachers = users.filter((u) => u.role === "teacher");
  const students = users.filter((u) => u.role === "student");

  return (
    <div className="min-h-screen bg-base p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">管理员后台</h1>
            <p className="text-[13px] text-muted">{teacherCount} 名教师 · {studentCount} 名学生（含演示帐号）</p>
          </div>
          <button onClick={() => setAuthenticated(false)} className="rounded-lg border border-border/50 px-4 py-2 text-[13px] text-muted hover:text-text">退出</button>
        </div>

        {securityWarning && (
          <div className="mb-4 rounded-lg border border-yellow-500/35 bg-yellow-500/10 px-3 py-2 text-[13px] leading-relaxed text-yellow-200">
            {securityWarning}
          </div>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-accent2/25 bg-accent2/5 p-4">
            <h2 className="mb-2 text-[15px] font-semibold text-white">课程内容管理 / 导入结果</h2>
            <div className="space-y-1 text-[12px] text-muted">
              <div>已整合：16 周课堂执行、企业项目库、选题评分、教师指令、学生证据包、硕士增强路径。</div>
              <div>已补强：RAG、Agent、MCP、Evals/LLMOps、安全治理、AI 编程协作。</div>
              <div>当前主线：v2 八关保持不变，旧版七关仅作为教学表达参考。</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FRONTIER_ANCHORS.map((item) => (
                <span key={item} className="rounded-full border border-border/50 px-2 py-1 text-[11px] text-muted">{item.split(":")[0]}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-panel/40 p-4">
            <h2 className="mb-2 text-[15px] font-semibold text-white">项目库管理</h2>
            <div className="text-[12px] text-muted">{PROJECT_CATEGORIES.length} 类企业场景 · {PROJECT_SCORE_CRITERIA.length} 项选题评分 · {COURSE_WEEKS.length} 周执行表</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROJECT_CATEGORIES.map((cat) => (
                <div key={cat.id} className="rounded-lg border border-border/40 bg-base/30 px-2.5 py-2">
                  <div className="text-[12px] font-semibold text-text">{cat.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{cat.enterpriseVersion}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 新建用户 */}
        <div className="mb-6 rounded-xl border border-border/50 bg-panel/40 p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-white">新建用户</h2>
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input className="flex-1 min-w-[120px] rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="用户名" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="rounded-lg border border-border bg-base px-3 py-2 text-sm text-text">
              <option value="teacher">教师</option>
              <option value="student">学生</option>
              <option value="demo">演示帐号</option>
            </select>
            <input className="w-32 rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="密码" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button onClick={createNewUser} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-base hover:brightness-110">创建</button>
          </div>
          {newRole === "demo" && (
            <p className="mt-2 text-[12px] text-muted">
              演示帐号会创建为固定的全通关学生档案，同一时间只允许存在 1 个。
            </p>
          )}
        </div>

        {/* 师生绑定 */}
        <div className="mb-6 rounded-xl border border-border/50 bg-panel/40 p-4">
          <h2 className="mb-1 text-[15px] font-semibold text-white">师生绑定</h2>
          <p className="mb-3 text-[12px] text-muted">一个教师可绑定多个学生；同一个学生也可绑定给多个教师。教师端只显示自己绑定的学生。</p>
          <div className="flex flex-wrap gap-2">
            <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-border bg-base px-3 py-2 text-sm text-text">
              <option value="">选择教师</option>
              {teachers.map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}
            </select>
            <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-border bg-base px-3 py-2 text-sm text-text">
              <option value="">选择学生</option>
              {students.map((s) => <option key={s.userId} value={s.userId}>{s.name}{s.isDemo ? "（演示）" : ""}</option>)}
            </select>
            <button onClick={assignStudent} className="rounded-lg border border-accent2/40 px-4 py-2 text-sm font-semibold text-accent2 hover:bg-accent2/10">绑定</button>
          </div>
          {teachers.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {teachers.map((t) => (
                <div key={t.userId} className="rounded-lg border border-border/40 bg-base/25 p-3">
                  <div className="mb-2 text-[13px] font-semibold text-text">{t.name}</div>
                  {(t.studentIds ?? []).length === 0 ? (
                    <div className="text-[12px] text-muted">暂未绑定学生</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(t.studentIds ?? []).map((sid) => {
                        const student = students.find((s) => s.userId === sid);
                        return (
                          <button key={sid} onClick={() => unassignStudent(t.userId, sid)} className="rounded-full border border-border/50 px-2 py-1 text-[11px] text-muted hover:border-red-400/50 hover:text-red-300">
                            {student?.name || sid} ×
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 用户列表 */}
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/50 bg-panel2/40 text-left text-muted">
                <th className="px-4 py-2.5 font-medium">用户名</th>
                <th className="px-4 py-2.5 font-medium">角色</th>
                <th className="px-4 py-2.5 font-medium">创建时间</th>
                <th className="px-4 py-2.5 font-medium">最近登录</th>
                <th className="px-4 py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-b border-border/30 hover:bg-panel2/20">
                  <td className="px-4 py-2.5 text-text">{u.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.role === "admin" ? "bg-red-500/20 text-red-400" : u.role === "teacher" ? "bg-accent/20 text-accent" : u.isDemo ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-400"}`}>
                      {u.role === "admin" ? "管理员" : u.role === "teacher" ? "教师" : u.isDemo ? "演示帐号" : "学生"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{u.createdAt?.slice(0, 10) || "-"}</td>
                  <td className="px-4 py-2.5 text-muted">{u.lastLoginAt?.slice(0, 10) || "从未"}</td>
                  <td className="px-4 py-2.5">
                    {u.role !== "admin" && (
                      <button onClick={() => removeUser(u.userId)} className="text-red-400 hover:text-red-300 text-[12px]">删除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
