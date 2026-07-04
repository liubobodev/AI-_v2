import { NextRequest } from "next/server";
import {
  getOrCreateProfile,
  updateProfile,
  updateGate,
  updateSkill,
  recordSession,
  buildStudentContext,
} from "@/lib/studentStore";

export const runtime = "nodejs";

// GET: 获取学生档案
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return jsonError("缺少 studentId", 400);
  const profile = getOrCreateProfile(studentId);
  const context = buildStudentContext(studentId);
  return Response.json({ profile, context });
}

// POST: 更新学生档案
export async function POST(req: NextRequest) {
  let body: {
    studentId?: string;
    action?: "update_profile" | "update_gate" | "update_skill" | "record_session";
    patch?: Record<string, unknown>;
    gate?: number;
    gatePatch?: Record<string, unknown>;
    area?: string;
    level?: number;
    evidence?: string;
    gap?: string;
  };
  try { body = await req.json(); } catch { return jsonError("非法 JSON", 400); }

  const { studentId, action } = body;
  if (!studentId) return jsonError("缺少 studentId", 400);

  try {
    switch (action) {
      case "update_profile":
        return Response.json({ profile: updateProfile(studentId, body.patch ?? {}) });

      case "update_gate":
        if (!body.gate) return jsonError("缺少 gate", 400);
        return Response.json({
          profile: updateGate(studentId, body.gate, (body.gatePatch ?? {}) as any),
        });

      case "update_skill":
        if (!body.area || body.level == null) return jsonError("缺少 area/level", 400);
        return Response.json({
          profile: updateSkill(
            studentId,
            body.area as any,
            body.level,
            body.evidence ?? "",
            body.gap ?? ""
          ),
        });

      case "record_session":
        return Response.json({ profile: recordSession(studentId) });

      default:
        return jsonError(`未知 action: ${action}`, 400);
    }
  } catch (e: any) {
    return jsonError(e.message ?? "服务器错误", 500);
  }
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
