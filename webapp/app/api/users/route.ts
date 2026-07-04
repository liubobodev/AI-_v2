import { NextRequest } from "next/server";
import { getAllUsers, createUser, deleteUser, verifyAdmin } from "@/lib/userStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get("admin") || "";
  if (!verifyAdmin(pw)) return jsonError("需要管理员权限", 403);
  return Response.json({ users: getAllUsers() });
}

export async function POST(req: NextRequest) {
  let body: { admin?: string; name?: string; role?: string; password?: string; action?: string; userId?: string };
  try { body = await req.json(); } catch { return jsonError("非法 JSON", 400); }

  if (!verifyAdmin(body.admin || "")) return jsonError("需要管理员权限", 403);

  if (body.action === "create") {
    if (!body.name || !body.password || !body.role) return jsonError("缺少参数", 400);
    if (!["teacher", "student"].includes(body.role)) return jsonError("角色只能是 teacher 或 student", 400);
    try {
      const user = createUser(body.name, body.role as "teacher" | "student", body.password);
      return Response.json({ ok: true, user });
    } catch (e: any) { return jsonError(e.message, 400); }
  }

  if (body.action === "delete") {
    if (!body.userId) return jsonError("缺少 userId", 400);
    deleteUser(body.userId);
    return Response.json({ ok: true });
  }

  return jsonError("未知 action", 400);
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
}
