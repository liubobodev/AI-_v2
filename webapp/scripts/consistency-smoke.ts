import { assignStudentToTeacher, createUser, deleteUser, getUser } from "../lib/userStore";
import {
  getOrCreateProfile,
  setInterviewPassed,
  toggleChecklistItem,
  updateGate,
} from "../lib/studentStore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const stamp = Date.now().toString(36);
  const password = "QaPass123!";
  const created: string[] = [];
  let teacherId = "";
  let studentA = "";
  let studentB = "";

  try {
    const teacher = await createUser(`consistency_teacher_${stamp}`, "teacher", password);
    const a = await createUser(`consistency_student_a_${stamp}`, "student", password);
    const b = await createUser(`consistency_student_b_${stamp}`, "student", password);
    teacherId = teacher.userId;
    studentA = a.userId;
    studentB = b.userId;
    created.push(studentB, studentA, teacherId);

    await assignStudentToTeacher(teacherId, studentA);
    await assignStudentToTeacher(teacherId, studentB);
    const assignedTeacher = await getUser(teacherId);
    assert(assignedTeacher?.studentIds?.includes(studentA), "teacher lost first assigned student");
    assert(assignedTeacher?.studentIds?.includes(studentB), "teacher lost second assigned student");

    await getOrCreateProfile(studentA);
    await toggleChecklistItem(studentA, 1, "c0", true, 3);
    await toggleChecklistItem(studentA, 1, "c1", true, 3);
    const afterChecklist = await toggleChecklistItem(studentA, 1, "c2", true, 3);
    const checklistGate = afterChecklist.profile.gateProgress.find((g) => g.gate === 1);
    assert(checklistGate?.doors?.selfCheck, "self-check door did not stay lit after checklist completion");

    await updateGate(studentA, 1, {
      doors: { selfCheck: true, submissionApproved: true, interviewPassed: false },
      status: "in_progress",
    });
    await setInterviewPassed(studentA, 1, true);
    const finalProfile = await getOrCreateProfile(studentA);
    const finalGate = finalProfile.gateProgress.find((g) => g.gate === 1);
    assert(finalGate?.doors?.selfCheck, "self-check door was overwritten");
    assert(finalGate?.doors?.submissionApproved, "submission door was overwritten");
    assert(finalGate?.doors?.interviewPassed, "interview door was not lit");
    assert(finalGate?.status === "completed", `gate was not completed, got ${finalGate?.status}`);

    console.log(JSON.stringify({
      ok: true,
      teacherId,
      students: [studentA, studentB],
      doors: finalGate.doors,
      status: finalGate.status,
    }, null, 2));
  } finally {
    for (const userId of created) {
      await deleteUser(userId).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
