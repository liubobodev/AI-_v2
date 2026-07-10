import { NextRequest } from "next/server";
import { getUser, verifyTeacher } from "@/lib/userStore";
import { addArchiveEntry, getOrCreateProfile, markTeacherRequestsAnswered, withStudentProfileLock } from "@/lib/studentStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const teacherId = req.nextUrl.searchParams.get("teacherId") || "";
  if (!(await verifyTeacher(teacherId))) return Response.json({ error: "需要教师权限" }, { status: 403 });
  const teacher = await getUser(teacherId);
  const assigned = teacher?.studentIds ?? [];

  const students: any[] = [];
  const hotspotCounter = new Map<string, number>(); // 全班高频卡点聚合
  const bumpHotspot = (label: string) => {
    const key = label.trim();
    if (key) hotspotCounter.set(key, (hotspotCounter.get(key) ?? 0) + 1);
  };
  const now = Date.now();
  const profiles = await Promise.all(assigned.map((studentId) => getOrCreateProfile(studentId)));
  const users = await Promise.all(assigned.map((studentId) => getUser(studentId)));
  const nameById = new Map(users.filter(Boolean).map((u) => [u!.userId, u!.name]));
  for (const p of profiles) {
        // 只返回摘要
        const completed = (p.gateProgress || []).filter((g: any) => g.status === "completed").length;
        const currentGate = p.currentGate || 1;
        const current: any = (p.gateProgress || []).find((g: any) => g.gate === currentGate) || {};
        const doors = current.doors || {};
        const missingDoors = [
          !doors.selfCheck ? "自检" : "",
          !doors.submissionApproved ? "评审" : "",
          !doors.interviewPassed ? "面试" : "",
        ].filter(Boolean);
        const lastActiveMs = p.lastSessionAt ? Date.parse(p.lastSessionAt) : NaN;
        const daysInactive = Number.isFinite(lastActiveMs)
          ? Math.max(0, Math.floor((now - lastActiveMs) / 86400000))
          : 999;
        const blocked = current.status === "blocked" || missingDoors.length >= 2 && daysInactive >= 7;
        const openRequests = (p.teacherRequests ?? []).filter((r: any) => r.status === "open");
        const evidenceItems = (p.gateProgress || []).flatMap((g: any) => g.evidencePackage || []);
        const evidenceSubmitted = evidenceItems.filter((e: any) => e.status === "submitted" || e.status === "approved").length;
        const needsNudge = blocked || daysInactive >= 7 || missingDoors.length > 0 || openRequests.length > 0;
        const nextAction = blocked
          ? `约 10 分钟诊断第${currentGate}关卡点`
          : openRequests.length > 0
            ? `回复学生求助：${openRequests[0].title}`
          : missingDoors.length > 0
            ? `补齐${missingDoors[0]}门`
            : daysInactive >= 7
              ? "发一次轻量唤醒任务"
              : "保持节奏";
    // ---- 下钻明细:当前关的自检/评审/面试实锤(面谈前 2 分钟看完)----
    const sc = current.selfCheckData;
    const selfCheckDetail = (sc?.items ?? []).map((it: any) => ({
      criterion: String(it.criterion || "").slice(0, 40),
      content: String(it.content || "").slice(0, 200),
      score: it.score, passed: it.passed,
      feedback: String(it.feedback || "").slice(0, 160),
    }));
    const lastSub = [...(current.submissions ?? [])].reverse().find((s: any) => s.status === "approved" || s.status === "rejected");
    const submissionDetail = lastSub ? {
      status: lastSub.status, score: lastSub.overallScore,
      topGap: String(lastSub.topGap || "").slice(0, 120),
      link: lastSub.link,
    } : null;
    const lastIv = [...(p.interviewResults ?? [])].reverse().find((r: any) => r.gate === currentGate);
    const interviewDetail = lastIv ? {
      score: lastIv.score, passed: lastIv.passed,
      gaps: (lastIv.gaps ?? []).slice(0, 3),
      comment: String(lastIv.comment || "").slice(0, 120),
    } : null;

    // ---- 汇入全班卡点榜:自检 FAIL 项 + 评审 topGap + 面试 gaps ----
    for (const it of sc?.items ?? []) {
      if (it.passed === false && it.criterion) bumpHotspot(`自检未过:${String(it.criterion).slice(0, 24)}`);
    }
    if (lastSub?.status === "rejected" && lastSub.topGap) bumpHotspot(`评审:${String(lastSub.topGap).slice(0, 24)}`);
    for (const g of lastIv?.gaps ?? []) bumpHotspot(`面试:${String(g).slice(0, 24)}`);

    students.push({
      studentId: p.studentId,
      name: nameById.get(p.studentId) || p.studentId,
      role: p.role || "未设置",
      major: p.major || "",
      targetRole: p.targetRole || "",
      basicsReadiness: p.basicsReadiness ?? null,
      currentGate,
      currentGateName: current.name || `第${currentGate}关`,
      selfCheckDetail,
      submissionDetail,
      interviewDetail,
      gatesCompleted: completed,
      sessionCount: p.sessionCount || 0,
      lastSessionAt: p.lastSessionAt || "",
      skillsCount: (p.skills || []).length,
      missingDoors,
      daysInactive,
      blocked,
      needsNudge,
      nextAction,
      openRequests,
      evidenceCompletion: evidenceItems.length ? Math.round((evidenceSubmitted / evidenceItems.length) * 100) : 0,
      projectSelection: p.projectSelection ?? null,
    });
  }

  students.sort((a, b) => {
    const priority = (s: any) => (s.blocked ? 3 : s.needsNudge ? 2 : 1);
    return priority(b) - priority(a) || b.daysInactive - a.daysInactive || a.currentGate - b.currentGate;
  });

  const classHotspots = [...hotspotCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  return Response.json({
    students,
    classHotspots,
    summary: {
      total: students.length,
      blocked: students.filter((s) => s.blocked).length,
      needsNudge: students.filter((s) => s.needsNudge).length,
      inactive7d: students.filter((s) => s.daysInactive >= 7).length,
      completedAll: students.filter((s) => s.gatesCompleted >= 8).length,
      avgCompleted: students.length
        ? Math.round((students.reduce((sum, s) => sum + s.gatesCompleted, 0) / students.length) * 10) / 10
        : 0,
    },
  });
}

export async function POST(req: NextRequest) {
  let body: { teacherId?: string; studentId?: string; gate?: number; detail?: string; score?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "非法 JSON" }, { status: 400 }); }
  if (!body.teacherId || !body.studentId || !body.gate || !body.detail) {
    return Response.json({ error: "缺少 teacherId/studentId/gate/detail" }, { status: 400 });
  }
  if (!(await verifyTeacher(body.teacherId))) return Response.json({ error: "需要教师权限" }, { status: 403 });
  const teacher = await getUser(body.teacherId);
  if (!teacher || !(teacher.studentIds ?? []).includes(body.studentId)) {
    return Response.json({ error: "该学生未绑定到当前教师" }, { status: 403 });
  }
  return await withStudentProfileLock(body.studentId, async () => {
    const score = typeof body.score === "number" ? Math.max(0, Math.min(100, body.score)) : undefined;
    await addArchiveEntry(body.studentId!, body.gate!, {
      type: "ai_feedback",
      title: `教师跟进：第${body.gate}关`,
      detail: body.detail!,
      aiFeedback: `教师${teacher.name || ""}评分${score === undefined ? "未填写" : score + "分"}`,
      score,
      passed: score === undefined ? undefined : score >= 70,
    });
    const profile = await markTeacherRequestsAnswered(body.studentId!, body.gate!);
    return Response.json({ ok: true, profile });
  });
}
