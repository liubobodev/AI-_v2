import { NextRequest } from "next/server";
import { login, createUser, verifyAdmin } from "@/lib/userStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { action?: string; name?: string; password?: string; role?: string; expectedRole?: string };
  try { body = await req.json(); } catch { return jsonError("非法 JSON", 400); }

  if (body.action === "login") {
    if (!body.name || !body.password) return jsonError("缺少用户名或密码", 400);
    const user = login(body.name, body.password);
    if (!user) return jsonError("用户名或密码错误", 401);

    // 角色校验：前端传入 expectedRole 时，必须匹配
    if (body.expectedRole && user.role !== body.expectedRole) {
      const roleLabels: Record<string, string> = {
        student: "学生",
        teacher: "教师",
        admin: "管理员",
      };
      const actual = roleLabels[user.role] ?? user.role;
      const expected = roleLabels[body.expectedRole] ?? body.expectedRole;
      return jsonError(`该账号是「${actual}」身份，请在「${expected}登录」入口重新登录`, 403);
    }

    const { passwordHash, ...safe } = user;
    console.log(`[auth] login OK: ${user.name} as ${user.role} (expected: ${body.expectedRole ?? "none"})`);
    return Response.json({ ok: true, user: safe });
  }

  if (body.action === "register") {
    if (!body.name || !body.password) return jsonError("缺少用户名或密码", 400);
    if (!body.role || !["teacher"].includes(body.role)) return jsonError("仅支持注册教师账号", 400);
    try {
      const user = createUser(body.name, body.role as "teacher", body.password);
      const { passwordHash, ...safe } = user;
      return Response.json({ ok: true, user: safe });
    } catch (e: any) { return jsonError(e.message, 400); }
  }

  if (body.action === "admin_login") {
    if (!body.password) return jsonError("缺少密码", 400);
    if (verifyAdmin(body.password)) return Response.json({ ok: true, user: { userId: "admin", name: "admin", role: "admin" } });
    return jsonError("管理员密码错误", 401);
  }

  return jsonError("未知 action", 400);
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
}
