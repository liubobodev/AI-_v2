const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3010";
const admin = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";
const password = "QaPass123!";

type JsonResponse = {
  ok: boolean;
  status: number;
  ms: number;
  json: any;
};

async function post(path: string, body: Record<string, unknown>): Promise<JsonResponse> {
  const started = Date.now();
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, ms: Date.now() - started, json };
}

async function get(path: string): Promise<JsonResponse> {
  const started = Date.now();
  const res = await fetch(base + path);
  let json: any = {};
  try {
    json = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, ms: Date.now() - started, json };
}

function assert(condition: unknown, message: string, details?: unknown): asserts condition {
  if (!condition) {
    const suffix = details ? "\n" + JSON.stringify(details, null, 2) : "";
    throw new Error(message + suffix);
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  const names = {
    teacher: `api_consistency_teacher_${stamp}`,
    studentA: `api_consistency_student_a_${stamp}`,
    studentB: `api_consistency_student_b_${stamp}`,
  };
  const ids: { teacher?: string; studentA?: string; studentB?: string } = {};
  const timings: Record<string, number> = {};

  try {
    let res = await post("/api/users", { action: "create", admin, name: names.teacher, role: "teacher", password });
    ids.teacher = res.json.user?.userId;
    timings.createTeacher = res.ms;
    assert(res.ok && ids.teacher, "failed to create teacher", res);

    res = await post("/api/users", { action: "create", admin, name: names.studentA, role: "student", password });
    ids.studentA = res.json.user?.userId;
    timings.createStudentA = res.ms;
    assert(res.ok && ids.studentA, "failed to create student A", res);

    res = await post("/api/users", { action: "create", admin, name: names.studentB, role: "student", password });
    ids.studentB = res.json.user?.userId;
    timings.createStudentB = res.ms;
    assert(res.ok && ids.studentB, "failed to create student B", res);

    res = await post("/api/users", { action: "assign_student", admin, teacherId: ids.teacher, studentId: ids.studentA });
    timings.assignA = res.ms;
    assert(res.ok, "failed to assign student A", res);

    res = await post("/api/users", { action: "assign_student", admin, teacherId: ids.teacher, studentId: ids.studentB });
    timings.assignB = res.ms;
    assert(res.ok, "failed to assign student B", res);

    await post("/api/student", { studentId: ids.studentA, action: "toggle_checklist", gate: 1, itemKey: "c0", checked: true, totalItems: 3 });
    await post("/api/student", { studentId: ids.studentA, action: "toggle_checklist", gate: 1, itemKey: "c1", checked: true, totalItems: 3 });
    res = await post("/api/student", { studentId: ids.studentA, action: "toggle_checklist", gate: 1, itemKey: "c2", checked: true, totalItems: 3 });
    timings.checklist3 = res.ms;
    const checklistGate = res.json.profile?.gateProgress?.find((g: any) => g.gate === 1);
    assert(checklistGate?.doors?.selfCheck, "self-check door did not light via API", checklistGate);

    await post("/api/student", {
      studentId: ids.studentA,
      action: "update_gate",
      gate: 1,
      gatePatch: { doors: { selfCheck: true, submissionApproved: true, interviewPassed: false }, status: "in_progress" },
    });
    res = await post("/api/student", { studentId: ids.studentA, action: "set_interview_passed", gate: 1, passed: true });
    timings.interview = res.ms;
    const interviewGate = res.json.profile?.gateProgress?.find((g: any) => g.gate === 1);
    assert(interviewGate?.doors?.selfCheck && interviewGate?.doors?.submissionApproved && interviewGate?.doors?.interviewPassed, "gate doors were overwritten in API response", interviewGate);

    res = await get(`/api/student?studentId=${ids.studentA}`);
    timings.studentRead = res.ms;
    const finalGate = res.json.profile?.gateProgress?.find((g: any) => g.gate === 1);
    assert(finalGate?.doors?.selfCheck && finalGate?.doors?.submissionApproved && finalGate?.doors?.interviewPassed, "gate doors were not durable", finalGate);
    assert(finalGate?.status === "completed", "gate did not complete", finalGate);

    res = await get(`/api/teacher?teacherId=${ids.teacher}`);
    timings.teacherRead = res.ms;
    const students = res.json.students ?? [];
    assert(students.some((s: any) => s.studentId === ids.studentA), "teacher cannot see student A", students);
    assert(students.some((s: any) => s.studentId === ids.studentB), "teacher cannot see student B", students);

    res = await post("/api/student", {
      studentId: ids.studentB,
      action: "request_teacher_help",
      gate: 1,
      requestTitle: "评测集设计求助",
      requestDetail: "我不知道如何证明项目有效。",
    });
    timings.requestHelp = res.ms;
    assert(res.ok && res.json.request?.status === "open", "student B help request failed", res);

    res = await post("/api/teacher", {
      teacherId: ids.teacher,
      studentId: ids.studentB,
      gate: 1,
      detail: "先做 10 条最小评测集，包含标准答案、引用来源和拒答边界。",
      score: 78,
    });
    timings.teacherFeedback = res.ms;
    assert(res.ok, "teacher feedback failed", res);

    res = await get(`/api/student?studentId=${ids.studentB}`);
    timings.feedbackRead = res.ms;
    const profileB = res.json.profile;
    const gateB = profileB?.gateProgress?.find((g: any) => g.gate === 1);
    assert(profileB?.teacherRequests?.every((r: any) => r.status !== "open"), "teacher request was not closed", profileB?.teacherRequests);
    assert(gateB?.archive?.some((a: any) => String(a.detail ?? "").includes("最小评测集")), "teacher feedback did not reach student archive", gateB?.archive);

    console.log(JSON.stringify({ ok: true, ids, timings }, null, 2));
  } finally {
    for (const userId of [ids.studentB, ids.studentA, ids.teacher].filter(Boolean)) {
      await post("/api/users", { action: "delete", admin, userId }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
