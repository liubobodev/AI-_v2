import fs from "fs";
import path from "path";
import type { StudentProfile, GateProgress, SkillArea, GateStatus, SkillAssessment, Milestone } from "./studentTypes";
import { SKILL_LABELS } from "./studentTypes";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "ai-coach-students")
  : path.join(process.cwd(), "data", "students");

const GATE_NAMES: Record<number, string> = {
  1: "侦察关", 2: "AI编程协作关", 3: "Prompt资产关", 4: "RAG工程关",
  5: "工具与MCP关", 6: "Agent系统关", 7: "Evals上线关", 8: "发射关",
};

function defaultProfile(studentId: string): StudentProfile {
  return {
    studentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: "",
    major: "",
    targetRole: "",
    techStack: [],
    currentGate: 1,
    gateProgress: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      gate: n, name: GATE_NAMES[n] ?? `第${n}关`, status: "not_started" as GateStatus,
    })),
    skills: [], milestones: [], weakPoints: [], strengths: [],
    sessionCount: 0, lastSessionAt: new Date().toISOString(),
  };
}

function filePath(studentId: string): string {
  return path.join(DATA_DIR, `${studentId}.json`);
}

function safeRead(studentId: string): StudentProfile | null {
  try { const raw = fs.readFileSync(filePath(studentId), "utf-8"); return JSON.parse(raw) as StudentProfile; }
  catch { return null; }
}

function safeWrite(profile: StudentProfile): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath(profile.studentId), JSON.stringify(profile, null, 2), "utf-8");
}

export function getOrCreateProfile(studentId: string): StudentProfile {
  const existing = safeRead(studentId);
  if (existing) return existing;
  const fresh = defaultProfile(studentId);
  safeWrite(fresh);
  return fresh;
}

export function updateProfile(
  studentId: string, patch: Partial<Omit<StudentProfile, "studentId" | "createdAt">>
): StudentProfile {
  const profile = getOrCreateProfile(studentId);
  Object.assign(profile, patch);
  profile.updatedAt = new Date().toISOString();
  safeWrite(profile);
  return profile;
}

export function updateGate(studentId: string, gate: number, patch: Partial<GateProgress>): StudentProfile {
  const profile = getOrCreateProfile(studentId);
  const idx = profile.gateProgress.findIndex((g) => g.gate === gate);
  if (idx >= 0) {
    profile.gateProgress[idx] = { ...profile.gateProgress[idx], ...patch };
    if (patch.status === "completed" && !profile.gateProgress[idx].completedAt) {
      profile.gateProgress[idx].completedAt = new Date().toISOString();
      profile.milestones.push({
        date: new Date().toISOString(),
        title: `通过第${gate}关：${GATE_NAMES[gate] ?? ""}`,
        detail: patch.evidence ?? "", type: "gate_complete",
      });
    }
  }
  safeWrite(profile);
  return profile;
}

export function updateSkill(
  studentId: string, area: SkillArea, level: number, evidence: string, gap: string
): StudentProfile {
  const profile = getOrCreateProfile(studentId);
  const existing = profile.skills.find((s) => s.area === area);
  if (existing && level > existing.level) {
    profile.milestones.push({
      date: new Date().toISOString(),
      title: `${SKILL_LABELS[area]} L${existing.level} → L${level}`,
      detail: evidence, type: "skill_up",
    });
  }
  const idx = profile.skills.findIndex((s) => s.area === area);
  const assessment: SkillAssessment = { area, level, lastAssessed: new Date().toISOString(), evidence, gap };
  if (idx >= 0) profile.skills[idx] = assessment;
  else profile.skills.push(assessment);
  safeWrite(profile);
  return profile;
}

export function recordSession(studentId: string): StudentProfile {
  const profile = getOrCreateProfile(studentId);
  profile.sessionCount += 1;
  profile.lastSessionAt = new Date().toISOString();
  safeWrite(profile);
  return profile;
}

export function buildStudentContext(studentId: string): string {
  const p = getOrCreateProfile(studentId);
  // 即使角色未设置，也提供基本信息
  const roleLabel: Record<string, string> = {
    teacher: "教师", undergrad: "本科生", master: "硕士生", jobseeker: "求职冲刺者", student: "学生",
  };
  const displayRole = p.role ? (roleLabel[p.role] ?? p.role) : "学生（未设置具体身份）";
  const lines: string[] = [
    `\n## 当前学生画像（动态记忆）`,
    `- 身份：${displayRole}`,
  ];
  if (p.major) lines.push(`- 专业：${p.major}`);
  if (p.targetRole) lines.push(`- 目标岗位：${p.targetRole}`);
  if (p.techStack.length > 0) lines.push(`- 技术栈：${p.techStack.join("、")}`);
  const completed = p.gateProgress.filter((g) => g.status === "completed").length;
  const inProg = p.gateProgress.find((g) => g.status === "in_progress");
  lines.push(`- 关卡进度：${completed}/8 关已通过`);
  if (inProg) lines.push(`- 当前关卡：第${inProg.gate}关「${inProg.name}」`);
  if (p.skills.length > 0) {
    lines.push(`- 技能评估：${p.skills.map((s) => `${SKILL_LABELS[s.area]}:L${s.level}`).join(" ")}`);
  }
  if (p.strengths.length > 0) lines.push(`- 强项：${p.strengths.join("、")}`);
  if (p.weakPoints.length > 0) lines.push(`- 待提升：${p.weakPoints.join("、")}`);
  const recent = p.milestones.slice(-3);
  if (recent.length > 0) {
    lines.push(`- 最近里程碑：`);
    recent.forEach((m) => lines.push(`  - ${m.date.slice(0, 10)} ${m.title}`));
  }
  lines.push(`- 累计训练 ${p.sessionCount} 次，上次 ${p.lastSessionAt.slice(0, 10)}`);
  lines.push(`\n请在回答时结合以上画像：提到学生的强项时给予具体肯定，发现弱点时针对性加练，技能有提升时祝贺并追问证据。`);
  return lines.join("\n");
}
