"use client";

import { useEffect, useState } from "react";

type User = { userId: string; name: string; role: string; createdAt: string; lastLoginAt: string };

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newPw, setNewPw] = useState("");

  async function doLogin() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "admin_login", password: adminPw }),
      });
      const data = await res.json();
      if (data.ok) { setAuthenticated(true); loadUsers(); }
      else setError(data.error || "密码错误");
    } catch { setError("网络错误"); }
    setLoading(false);
  }

  async function loadUsers() {
    try {
      const res = await fetch(`/api/users?admin=${encodeURIComponent(adminPw)}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
  }

  async function createNewUser() {
    if (!newName || !newPw) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", admin: adminPw, name: newName, role: newRole, password: newPw }),
      });
      if (res.ok) { setNewName(""); setNewPw(""); loadUsers(); }
    } catch {}
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
          <p className="mt-3 text-[11px] text-muted">默认密码：admin123（可在 .env.local 的 ADMIN_PASSWORD 修改）</p>
        </div>
      </div>
    );
  }

  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const studentCount = users.filter((u) => u.role === "student").length;

  return (
    <div className="min-h-screen bg-base p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">管理员后台</h1>
            <p className="text-[13px] text-muted">{teacherCount} 名教师 · {studentCount} 名学生</p>
          </div>
          <button onClick={() => setAuthenticated(false)} className="rounded-lg border border-border/50 px-4 py-2 text-[13px] text-muted hover:text-text">退出</button>
        </div>

        {/* 新建用户 */}
        <div className="mb-6 rounded-xl border border-border/50 bg-panel/40 p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-white">新建用户</h2>
          <div className="flex flex-wrap gap-2">
            <input className="flex-1 min-w-[120px] rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="用户名" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="rounded-lg border border-border bg-base px-3 py-2 text-sm text-text">
              <option value="teacher">教师</option>
              <option value="student">学生</option>
            </select>
            <input className="w-32 rounded-lg border border-border bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent2" placeholder="密码" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button onClick={createNewUser} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-base hover:brightness-110">创建</button>
          </div>
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
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.role === "admin" ? "bg-red-500/20 text-red-400" : u.role === "teacher" ? "bg-accent/20 text-accent" : "bg-blue-500/20 text-blue-400"}`}>
                      {u.role === "admin" ? "管理员" : u.role === "teacher" ? "教师" : "学生"}
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
