import { NextRequest } from "next/server";
import {
  getOrCreateProfile,
  updateProfile,
  updateGate,
  updateSkill,
  recordSession,
  buildStudentContext,
  toggleChecklistItem,
  setInterviewPassed,
  saveSelfCheckItem,
  addArchiveEntry,
  addTeacherRequest,
  saveProjectSelection,
  saveEvidenceItem,
  withStudentProfileLock,
} from "@/lib/studentStore";

export const runtime = "nodejs";

// GET: 获取学生档案
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return jsonError("缺少 studentId", 400);
  const profile = await getOrCreateProfile(studentId);
  const context = await buildStudentContext(studentId);
  return Response.json({ profile, context });
}

// POST: 更新学生档案
export async function POST(req: NextRequest) {
  let body: {
    studentId?: string;
    action?: "update_profile" | "update_gate" | "update_skill" | "record_session" | "toggle_checklist" | "set_interview_passed" | "save_selfcheck_item" | "add_archive_entry" | "request_teacher_help" | "save_project_selection" | "save_evidence_item";
    patch?: Record<string, unknown>;
    gate?: number;
    gatePatch?: Record<string, unknown>;
    area?: string;
    level?: number;
    evidence?: string;
    gap?: string;
    itemKey?: string;
    checked?: boolean;
    totalItems?: number;
    passed?: boolean;
    content?: string;
    entryType?: "self_check" | "submission_review" | "interview" | "ai_feedback";
    entryTitle?: string;
    entryDetail?: string;
    entryContent?: string;
    entryAiFeedback?: string;
    entryScore?: number;
    entryPassed?: boolean;
    requestTitle?: string;
    requestDetail?: string;
    projectSelection?: {
      categoryId: string;
      projectName: string;
      targetUser: string;
      dataSource: string;
      scores: Record<string, number>;
      teacherComment?: string;
    };
    evidenceItem?: {
      key: string;
      label: string;
      status: "missing" | "draft" | "submitted" | "approved";
      link?: string;
      note?: string;
      score?: number;
    };
  };
  try { body = await req.json(); } catch { return jsonError("非法 JSON", 400); }

  const { studentId, action } = body;
  if (!studentId) return jsonError("缺少 studentId", 400);

  try {
    return await withStudentProfileLock(studentId, async () => {
      switch (action) {
        case "update_profile":
          return Response.json({ profile: await updateProfile(studentId, body.patch ?? {}) });

        case "update_gate":
          if (!body.gate) return jsonError("缺少 gate", 400);
          return Response.json({
            profile: await updateGate(studentId, body.gate, (body.gatePatch ?? {}) as any),
          });

        case "update_skill":
          if (!body.area || body.level == null) return jsonError("缺少 area/level", 400);
          return Response.json({
            profile: await updateSkill(
              studentId,
              body.area as any,
              body.level,
              body.evidence ?? "",
              body.gap ?? ""
            ),
          });

        case "record_session": {
          const { profile, reward } = await recordSession(studentId);
          return Response.json({ profile, reward });
        }

        case "toggle_checklist": {
          if (!body.gate || !body.itemKey || body.totalItems == null) return jsonError("缺少 gate/itemKey/totalItems", 400);
          const { profile, reward } = await toggleChecklistItem(studentId, body.gate, body.itemKey, !!body.checked, body.totalItems);
          return Response.json({ profile, reward });
        }

        case "set_interview_passed": {
          if (!body.gate) return jsonError("缺少 gate", 400);
          const { profile, reward } = await setInterviewPassed(studentId, body.gate, !!body.passed);
          return Response.json({ profile, reward });
        }

        case "save_selfcheck_item":
          if (!body.gate || body.itemKey == null) return jsonError("缺少 gate/itemKey", 400);
          return Response.json({
            profile: (await saveSelfCheckItem(studentId, body.gate, body.itemKey, body.content ?? "")).profile,
          });

        case "add_archive_entry":
          if (!body.gate || !body.entryTitle || !body.entryDetail) return jsonError("缺少 gate/entryTitle/entryDetail", 400);
          return Response.json({
            profile: (await addArchiveEntry(studentId, body.gate, {
              type: body.entryType ?? "ai_feedback",
              title: body.entryTitle,
              detail: body.entryDetail,
              content: body.entryContent,
              aiFeedback: body.entryAiFeedback,
              score: body.entryScore,
              passed: body.entryPassed,
            })).profile,
          });

        case "request_teacher_help": {
          if (!body.gate || !body.requestTitle || !body.requestDetail) return jsonError("缺少 gate/requestTitle/requestDetail", 400);
          const { profile, request } = await addTeacherRequest(studentId, body.gate, body.requestTitle, body.requestDetail);
          return Response.json({ profile, request });
        }

        case "save_project_selection": {
          if (!body.projectSelection) return jsonError("缺少 projectSelection", 400);
          return Response.json({ profile: await saveProjectSelection(studentId, body.projectSelection) });
        }

        case "save_evidence_item": {
          if (!body.gate || !body.evidenceItem) return jsonError("缺少 gate/evidenceItem", 400);
          return Response.json({ profile: await saveEvidenceItem(studentId, body.gate, body.evidenceItem) });
        }

        default:
          return jsonError(`未知 action: ${action}`, 400);
      }
    });
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
