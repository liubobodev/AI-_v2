import { NextRequest } from "next/server";
import { ensureAdmin, getAllUsers, createDemoUser, createUser, deleteUser, verifyAdmin, assignStudentToTeacher, unassignStudentFromTeacher } from "@/lib/userStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return jsonError("请使用 POST action=list 读取用户，避免管理员密码进入 URL", 405);
}

export async function POST(req: NextRequest) {
  let body: { admin?: string; name?: string; role?: string; password?: string; action?: string; userId?: string; teacherId?: string; studentId?: string };
  try { body = await req.json(); } catch { return jsonError("非法 JSON", 400); }
  await ensureAdmin();

  if (!verifyAdmin(body.admin || "")) return jsonError("需要管理员权限", 403);

  if (body.action === "list") {
    return Response.json({ ok: true, users: await getAllUsers() });
  }

  if (body.action === "create") {
    if (!body.name || !body.password || !body.role) return jsonError("缺少参数", 400);
    if (!["teacher", "student", "demo"].includes(body.role)) return jsonError("角色只能是 teacher、student 或 demo", 400);
    try {
      const user = body.role === "demo"
        ? await createDemoUser(body.name, body.password)
        : await createUser(body.name, body.role as "teacher" | "student", body.password);
      return Response.json({ ok: true, user });
    } catch (e: any) { return jsonError(e.message, 400); }
  }

  if (body.action === "delete") {
    if (!body.userId) return jsonError("缺少 userId", 400);
    await deleteUser(body.userId);
    return Response.json({ ok: true });
  }

  if (body.action === "assign_student") {
    if (!body.teacherId || !body.studentId) return jsonError("缺少 teacherId/studentId", 400);
    const teacher = await assignStudentToTeacher(body.teacherId, body.studentId);
    const { passwordHash, ...safe } = teacher as any;
    return Response.json({ ok: true, teacher: safe });
  }

  if (body.action === "unassign_student") {
    if (!body.teacherId || !body.studentId) return jsonError("缺少 teacherId/studentId", 400);
    const teacher = await unassignStudentFromTeacher(body.teacherId, body.studentId);
    const { passwordHash, ...safe } = teacher as any;
    return Response.json({ ok: true, teacher: safe });
  }

  return jsonError("未知 action", 400);
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
}
