import type { StudentProfile, GateProgress, SkillArea, GateStatus, SkillAssessment, Submission, GateDoors, RewardDelta, InterviewResult, InterviewVerdict, TeacherRequest, ProjectSelection, EvidenceItem } from "./studentTypes";
import { SKILL_LABELS } from "./studentTypes";
import { XP, levelForXp, rankForLevel, syncAchievements } from "./gamification";
import { listJson, readJson, writeJson } from "@/lib/jsonStore";
import { scoreProject } from "@/lib/enterpriseTraining";

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
      doors: { selfCheck: false, submissionApproved: false, interviewPassed: false } as GateDoors,
      submissions: [] as Submission[],
      checklist: {} as Record<string, boolean>,
    })),
    skills: [], milestones: [], weakPoints: [], strengths: [],
    sessionCount: 0, lastSessionAt: new Date().toISOString(),
    xp: 0, level: 1, achievements: [],
    streak: { count: 0, best: 0, lastActiveDate: "" },
    interviewResults: [],
    teacherRequests: [],
  };
}

/** 旧存档没有游戏化字段，读取后补齐默认值，避免 undefined 崩溃 */
function ensureGamification(p: StudentProfile): void {
  if (typeof p.xp !== "number") p.xp = 0;
  if (typeof p.level !== "number") p.level = 1;
  if (!Array.isArray(p.achievements)) p.achievements = [];
  if (!p.streak || typeof p.streak.count !== "number") p.streak = { count: 0, best: 0, lastActiveDate: "" };
  if (!Array.isArray(p.interviewResults)) p.interviewResults = [];
  if (!Array.isArray(p.teacherRequests)) p.teacherRequests = [];
  for (const g of p.gateProgress ?? []) {
    if (!Array.isArray(g.evidencePackage)) g.evidencePackage = [];
  }
}

/** 收尾：同步成就、重算等级，产出可回传给前端做庆祝动画的奖励增量 */
function finalizeReward(profile: StudentProfile, xpGained: number, reason: string, fromLevel: number): RewardDelta {
  const newly = syncAchievements(profile);
  profile.level = levelForXp(profile.xp);
  const rank = rankForLevel(profile.level);
  return {
    xpGained,
    totalXp: profile.xp,
    leveledUp: profile.level > fromLevel,
    fromLevel,
    toLevel: profile.level,
    rankName: rank.name,
    rankIcon: rank.icon,
    newAchievements: newly,
    reason,
  };
}

const studentKey = (studentId: string) => `students/${studentId}.json`;
const studentLocks = new Map<string, Promise<void>>();

export async function withStudentProfileLock<T>(studentId: string, task: () => Promise<T>): Promise<T> {
  const previous = studentLocks.get(studentId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  studentLocks.set(studentId, previous.then(() => current, () => current));
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (studentLocks.get(studentId) === current) studentLocks.delete(studentId);
  }
}

async function safeRead(studentId: string): Promise<StudentProfile | null> {
  return readJson<StudentProfile>(studentKey(studentId));
}

async function safeWrite(profile: StudentProfile): Promise<void> {
  profile.updatedAt = new Date().toISOString();
  await writeJson(studentKey(profile.studentId), profile);
}

export async function listProfiles(): Promise<StudentProfile[]> {
  const profiles = await listJson<StudentProfile>("students/");
  profiles.forEach(ensureGamification);
  return profiles;
}

export async function getOrCreateProfile(studentId: string): Promise<StudentProfile> {
  const existing = await safeRead(studentId);
  if (existing) { ensureGamification(existing); return existing; }
  // 八冠王演示账号：自动创建全通关档案
  if (studentId === "student_champion_demo") {
    const champion = buildChampionProfile(studentId);
    await safeWrite(champion);
    return champion;
  }
  const fresh = defaultProfile(studentId);
  await safeWrite(fresh);
  return fresh;
}

export async function updateProfile(
  studentId: string, patch: Partial<Omit<StudentProfile, "studentId" | "createdAt">>
): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
  Object.assign(profile, patch);
  profile.updatedAt = new Date().toISOString();
  await safeWrite(profile);
  return profile;
}

export async function saveProjectSelection(
  studentId: string,
  data: Omit<ProjectSelection, "totalScore" | "verdict" | "updatedAt">
): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
  const scored = scoreProject(data.scores ?? {});
  profile.projectSelection = {
    ...data,
    totalScore: scored.total,
    verdict: scored.verdict,
    updatedAt: new Date().toISOString(),
  };
  await safeWrite(profile);
  return profile;
}

export async function saveEvidenceItem(
  studentId: string,
  gate: number,
  item: Omit<EvidenceItem, "gate" | "updatedAt">
): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
  const g = ensureGate(profile, gate);
  if (!g.evidencePackage) g.evidencePackage = [];
  const next: EvidenceItem = { ...item, gate, updatedAt: new Date().toISOString() };
  const idx = g.evidencePackage.findIndex((x) => x.key === item.key);
  if (idx >= 0) g.evidencePackage[idx] = next;
  else g.evidencePackage.push(next);
  await safeWrite(profile);
  return profile;
}

export async function updateGate(studentId: string, gate: number, patch: Partial<GateProgress>): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
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
  await safeWrite(profile);
  return profile;
}

export async function updateSkill(
  studentId: string, area: SkillArea, level: number, evidence: string, gap: string
): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
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
  await safeWrite(profile);
  return profile;
}

function ensureGate(profile: StudentProfile, gate: number): GateProgress {
  let g = profile.gateProgress.find((x) => x.gate === gate);
  if (!g) {
    g = { gate, name: GATE_NAMES[gate] ?? `第${gate}关`, status: "not_started" };
    profile.gateProgress.push(g);
  }
  if (!g.doors) g.doors = { selfCheck: false, submissionApproved: false, interviewPassed: false };
  if (!g.submissions) g.submissions = [];
  if (!g.checklist) g.checklist = {};
  return g;
}

/** 返回本次因通关而额外奖励的 XP（未通关则 0） */
function maybeCompleteGate(profile: StudentProfile, gate: number): number {
  const g = profile.gateProgress.find((x) => x.gate === gate);
  if (!g?.doors) return 0;
  const allGreen = g.doors.selfCheck && g.doors.submissionApproved && g.doors.interviewPassed;
  if (allGreen && g.status !== "completed") {
    g.status = "completed";
    g.completedAt = new Date().toISOString();
    profile.milestones.push({
      date: new Date().toISOString(),
      title: `通过第${gate}关：${GATE_NAMES[gate] ?? ""}（三门全绿）`,
      detail: "自检 + 提交评审 + 面试质询全部通过",
      type: "gate_complete",
    });
    return XP.gateCompleted;
  } else if (!allGreen && g.status === "not_started") {
    g.status = "in_progress";
    g.startedAt = g.startedAt ?? new Date().toISOString();
  }
  return 0;
}

/** 切换某一条验收标准的自检勾选状态；全部勾选后自动点亮「自检」门 */
export async function toggleChecklistItem(
  studentId: string, gate: number, itemKey: string, checked: boolean, totalItems: number
): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const g = ensureGate(profile, gate);
  const was = !!g.checklist![itemKey];
  g.checklist![itemKey] = checked;
  let xpGained = 0;
  if (checked && !was) xpGained += XP.checklistItem; // 只在首次勾选时给，避免反复勾选刷分
  const checkedCount = Object.values(g.checklist!).filter(Boolean).length;
  g.doors!.selfCheck = totalItems > 0 && checkedCount >= totalItems;
  xpGained += maybeCompleteGate(profile, gate);
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, "勾选验收标准", fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}

/** 学生提交一条 GitHub 链接等待 AI 审核（状态先置为 pending） */
export async function addSubmission(studentId: string, gate: number, link: string): Promise<{ profile: StudentProfile; submissionId: string }> {
  const profile = await getOrCreateProfile(studentId);
  const g = ensureGate(profile, gate);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const submission: Submission = { id, link, submittedAt: new Date().toISOString(), status: "reviewing" };
  g.submissions!.push(submission);
  await safeWrite(profile);
  return { profile, submissionId: id };
}

/** AI 审核完成后回写评分结果 */
export async function updateSubmissionResult(
  studentId: string, gate: number, submissionId: string, result: Partial<Submission>
): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const g = ensureGate(profile, gate);
  const idx = g.submissions!.findIndex((s) => s.id === submissionId);
  const wasApproved = idx >= 0 && g.submissions![idx].status === "approved";
  if (idx >= 0) g.submissions![idx] = { ...g.submissions![idx], ...result };

  // 把真实评审结论写进闯关档案(P1-3),让学生可追溯"哪次提交、被判什么、差距在哪"。
  // 只归档带分数/评分卡的真实评审,跳过抓取失败/解析失败这类基础设施报错。
  const isRealReview = (result.status === "approved" || result.status === "rejected")
    && (typeof result.overallScore === "number" || Array.isArray(result.criteria));
  if (isRealReview) {
    const sub = idx >= 0 ? g.submissions![idx] : undefined;
    const aiFeedback = [
      result.topStrength ? `亮点：${result.topStrength}` : "",
      result.topGap ? `最大差距：${result.topGap}` : "",
      result.nextStep ? `下一步：${result.nextStep}` : "",
    ].filter(Boolean).join("\n");
    if (!g.archive) g.archive = [];
    g.archive.push({
      id: "rv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: "submission_review",
      date: new Date().toISOString(),
      title: `第${gate}关 GitHub 评审 — ${result.status === "approved" ? "通过" : "驳回"}${typeof result.overallScore === "number" ? ` ${result.overallScore}分` : ""}`,
      detail: sub?.link ? `仓库：${sub.link}` : "GitHub 仓库评审",
      content: Array.isArray(result.criteria) ? JSON.stringify(result.criteria) : undefined,
      aiFeedback: aiFeedback || undefined,
      score: result.overallScore,
      passed: result.status === "approved",
    });
  }

  let xpGained = 0;
  if (result.status === "approved") {
    if (!g.doors!.submissionApproved) {
      // 首次通过该关评审才给奖励
      xpGained += XP.submissionApprovedBase + Math.round((result.overallScore ?? 70) * XP.submissionScoreFactor);
    }
    g.doors!.submissionApproved = true;
  }
  if (wasApproved) xpGained = 0; // 已通过的重复回写不再给
  xpGained += maybeCompleteGate(profile, gate);
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, "项目评审通过", fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}

/** 面试结算：记录一次面试战绩，通过则点亮面试门并奖励 XP */
export async function scoreInterview(
  studentId: string, gate: number,
  data: { score: number; verdict: InterviewVerdict; passed: boolean; strengths: string[]; gaps: string[]; comment: string }
): Promise<{ profile: StudentProfile; reward: RewardDelta; result: InterviewResult }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const g = ensureGate(profile, gate);
  const result: InterviewResult = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    gate, score: data.score, verdict: data.verdict, passed: data.passed,
    strengths: data.strengths, gaps: data.gaps, comment: data.comment,
    date: new Date().toISOString(),
  };
  profile.interviewResults.push(result);

  let xpGained = data.passed ? XP.interviewPassed : XP.interviewAttempt;
  if (data.passed && !g.doors!.interviewPassed) {
    g.doors!.interviewPassed = true;
    profile.milestones.push({
      date: new Date().toISOString(),
      title: `第${gate}关模拟面试通过（${data.score}分）`,
      detail: data.comment, type: "interview",
    });
  } else if (data.passed) {
    xpGained = XP.interviewAttempt; // 门已亮，重复面试只给参与分
  }
  xpGained += maybeCompleteGate(profile, gate);
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, data.passed ? "面试通过" : "完成面试", fromLevel);
  await safeWrite(profile);
  return { profile, reward, result };
}

/** 基础准入自测结算:记录成绩,通过则奖励 XP(成就由 syncAchievements 判定) */
export async function scoreBasics(
  studentId: string,
  data: { score: number; passed: boolean; weakConcepts: string[]; comment: string }
): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const wasPassed = profile.basicsReadiness?.passed === true;
  profile.basicsReadiness = {
    score: data.score, passed: data.passed,
    weakConcepts: data.weakConcepts, comment: data.comment,
    date: new Date().toISOString(),
  };
  let xpGained = 0;
  if (data.passed && !wasPassed) {
    xpGained = XP.dailySession * 2; // 地基一次性奖励,不刷分
    profile.milestones.push({
      date: new Date().toISOString(),
      title: `基础准入通过（${data.score}分）· 地基已筑`,
      detail: data.comment, type: "breakthrough",
    });
  }
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, "基础准入", fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}

/** 手动设置面试门（教师/调试用），带 XP 结算 */
export async function setInterviewPassed(studentId: string, gate: number, passed: boolean): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const g = ensureGate(profile, gate);
  let xpGained = 0;
  if (passed && !g.doors!.interviewPassed) xpGained += XP.interviewPassed;
  g.doors!.interviewPassed = passed;
  xpGained += maybeCompleteGate(profile, gate);
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, "面试通过", fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}

export async function recordSession(studentId: string): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  profile.sessionCount += 1;
  profile.lastSessionAt = new Date().toISOString();

  // ---- 连击：按自然日计算 ----
  const today = new Date().toISOString().slice(0, 10);
  let xpGained = 0;
  if (profile.streak.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    profile.streak.count = profile.streak.lastActiveDate === yesterday ? profile.streak.count + 1 : 1;
    profile.streak.best = Math.max(profile.streak.best, profile.streak.count);
    profile.streak.lastActiveDate = today;
    xpGained += XP.dailySession + profile.streak.count * XP.streakStep;
  }
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, "每日训练", fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}


/** 暂存自检单项内容 */
export async function saveSelfCheckItem(
  studentId: string, gate: number, itemKey: string, content: string
): Promise<{ profile: StudentProfile }> {
  const profile = await getOrCreateProfile(studentId);
  const g = ensureGate(profile, gate);
  if (!g.selfCheckData) {
    g.selfCheckData = { items: [], status: "writing" };
  }
  const existing = g.selfCheckData.items.find((i) => i.key === itemKey);
  if (existing) {
    existing.content = content;
    existing.savedAt = new Date().toISOString();
  } else {
    const criterion = g.checklist ? Object.keys(g.checklist)[g.selfCheckData.items.length + g.selfCheckData.items.filter(i => i.key !== itemKey).length] || "" : "";
    g.selfCheckData.items.push({
      key: itemKey,
      criterion: "",
      content,
      savedAt: new Date().toISOString(),
    });
  }
  g.selfCheckData.status = "saved";
  await safeWrite(profile);
  return { profile };
}

/** 提交全部自检项 → 前端调用 /api/selfcheck 后回调此函数写入反馈 */
export async function submitSelfCheckResult(
  studentId: string, gate: number,
  results: { items: { key: string; score: number; feedback: string; passed: boolean }[];
    overallScore: number; overallPassed: boolean; summary: string }
): Promise<{ profile: StudentProfile; reward: RewardDelta }> {
  const profile = await getOrCreateProfile(studentId);
  const fromLevel = levelForXp(profile.xp);
  const g = ensureGate(profile, gate);
  if (!g.selfCheckData) return { profile, reward: finalizeReward(profile, 0, "", fromLevel) };

  g.selfCheckData.status = "reviewed";
  g.selfCheckData.submittedAt = new Date().toISOString();
  g.selfCheckData.reviewedAt = new Date().toISOString();
  g.selfCheckData.overallScore = results.overallScore;
  g.selfCheckData.overallPassed = results.overallPassed;
  g.selfCheckData.summary = results.summary;

  for (const r of results.items) {
    const item = g.selfCheckData.items.find((i) => i.key === r.key);
    if (item) {
      item.score = r.score;
      item.feedback = r.feedback;
      item.passed = r.passed;
    }
  }

  // 点亮自检门
  if (results.overallPassed && !g.doors) g.doors = { selfCheck: false, submissionApproved: false, interviewPassed: false };
  if (results.overallPassed && g.doors) g.doors.selfCheck = true;

  // 加到关卡档案
  if (!g.archive) g.archive = [];
  g.archive.push({
    id: "sc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: "self_check",
    date: new Date().toISOString(),
    title: `第${gate}关自检评估 — ${results.overallScore}分`,
    detail: results.summary,
    content: JSON.stringify(g.selfCheckData.items.map(i => ({ key: i.key, criterion: i.criterion, content: i.content }))),
    aiFeedback: results.summary,
    score: results.overallScore,
    passed: results.overallPassed,
  });

  // 通关结算
  let xpGained = results.overallPassed ? 40 : 0;  // 自检通过奖励
  xpGained += maybeCompleteGate(profile, gate);
  profile.xp += xpGained;
  const reward = finalizeReward(profile, xpGained, results.overallPassed ? `第${gate}关自检通过` : `第${gate}关自检完成`, fromLevel);
  await safeWrite(profile);
  return { profile, reward };
}

/** 添加任意闯关档案条目（教师/面试结果/AI反馈等） */
export async function addArchiveEntry(
  studentId: string, gate: number,
  entry: { type: "self_check" | "submission_review" | "interview" | "ai_feedback"; title: string; detail: string; content?: string; aiFeedback?: string; score?: number; passed?: boolean }
): Promise<{ profile: StudentProfile }> {
  const profile = await getOrCreateProfile(studentId);
  const g = ensureGate(profile, gate);
  if (!g.archive) g.archive = [];
  g.archive.push({
    id: "arc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: entry.type,
    date: new Date().toISOString(),
    title: entry.title,
    detail: entry.detail,
    content: entry.content,
    aiFeedback: entry.aiFeedback,
    score: entry.score,
    passed: entry.passed,
  });
  await safeWrite(profile);
  return { profile };
}

export async function addTeacherRequest(
  studentId: string,
  gate: number,
  title: string,
  detail: string
): Promise<{ profile: StudentProfile; request: TeacherRequest }> {
  const profile = await getOrCreateProfile(studentId);
  const request: TeacherRequest = {
    id: "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    gate,
    title,
    detail,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  profile.teacherRequests.push(request);
  await safeWrite(profile);
  return { profile, request };
}

export async function markTeacherRequestsAnswered(studentId: string, gate: number): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(studentId);
  for (const req of profile.teacherRequests) {
    if (req.gate === gate && req.status === "open") {
      req.status = "answered";
      req.answeredAt = new Date().toISOString();
    }
  }
  await safeWrite(profile);
  return profile;
}

/** 获取关卡档案 */
export async function getGateArchive(studentId: string, gate: number): Promise<Array<any>> {
  const profile = await getOrCreateProfile(studentId);
  const g = profile.gateProgress.find((p) => p.gate === gate);
  return g?.archive ?? [];
}


/** 八冠王演示账号：全 8 关已通关、金冠评级、经验拉满 */
function buildChampionProfile(studentId: string): StudentProfile {
  const now = Date.now();
  const day = 86400000;
  const GATE_NAMES: Record<number, string> = {
    1: "\u4fa6\u5bdf\u5173", 2: "AI\u7f16\u7a0b\u534f\u4f5c\u5173", 3: "Prompt\u8d44\u4ea7\u5173", 4: "RAG\u5de5\u7a0b\u5173",
    5: "\u5de5\u5177\u4e0eMCP\u5173", 6: "Agent\u7cfb\u7edf\u5173", 7: "Evals\u4e0a\u7ebf\u5173", 8: "\u53d1\u5c04\u5173",
  };
  const makeSub = (g: number, s: number) => ({
    id: "demo_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    link: "https://github.com/demo/ai-cohort-gate-" + g,
    submittedAt: new Date(now - (8 - g) * day).toISOString(),
    status: "approved" as const,
    overallScore: s,
    criteria: [
      { criterion: GATE_NAMES[g] + " \u9a8c\u6536\u6807\u51c61", passed: true, evidence: "\u5df2\u5b8c\u6210" },
      { criterion: GATE_NAMES[g] + " \u9a8c\u6536\u6807\u51c62", passed: true, evidence: "\u5df2\u5b8c\u6210" },
    ],
    topStrength: "\u4efb\u52a1\u62c6\u89e3\u6e05\u6670\uff0c\u4ee3\u7801\u8d28\u91cf\u4f18\u79c0",
    topGap: "\u53ef\u8fdb\u4e00\u6b65\u4f18\u5316\u6587\u6863\u7ed3\u6784",
    nextStep: "\u7ee7\u7eed\u4e0b\u4e00\u5173\u6311\u6218",
  });
  const makeInterview = (g: number, s: number) => ({
    id: "int_" + Date.now().toString(36),
    gate: g, score: s, verdict: "pass" as const, passed: true,
    strengths: ["\u903b\u8f91\u6e05\u6670", "\u6280\u672f\u7406\u89e3\u6df1\u5165"],
    gaps: ["\u53ef\u589e\u52a0\u67b6\u6784\u5bf9\u6bd4\u5206\u6790"],
    comment: "\u8868\u73b0\u51fa\u8272\uff0c\u901a\u8fc7",
    date: new Date(now - (8 - g) * day + 3600000).toISOString(),
  });
  const gateProgress: GateProgress[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    gate: n, name: GATE_NAMES[n], status: "completed" as GateStatus,
    startedAt: new Date(now - (8 - n + 2) * day).toISOString(),
    completedAt: new Date(now - (8 - n) * day).toISOString(),
    evidence: n + "\u5173\u5b9e\u6218\u8bc1\u636e\u5907\u4efd",
    doors: { selfCheck: true, submissionApproved: true, interviewPassed: true },
    submissions: [makeSub(n, 92 + Math.floor(Math.random() * 8))],
    selfCheckData: {
      status: "reviewed" as const,
      items: [],
      submittedAt: new Date(now - (8 - n) * day + 1800000).toISOString(),
      reviewedAt: new Date(now - (8 - n) * day + 3600000).toISOString(),
      overallScore: 94 + Math.floor(Math.random() * 6),
      overallPassed: true,
      summary: "优秀，各项指标均达标",
    },
    checklist: { c0: true, c1: true, c2: true, c3: true },
  }));
  return {
    studentId, role: "undergrad", major: "\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f",
    targetRole: "AI\u5e94\u7528\u5f00\u53d1\u5de5\u7a0b\u5e08",
    techStack: ["Python", "Next.js", "LangChain", "RAG", "MCP"],
    currentGate: 8, gateProgress,
    createdAt: new Date(now - 30 * day).toISOString(),
    updatedAt: new Date().toISOString(),
    skills: [
      { area: "product_analysis" as SkillArea, level: 5, lastAssessed: new Date().toISOString(), evidence: "\u5b8c\u62103\u4e2aAI\u4ea7\u54c1\u6df1\u5ea6\u62c6\u89e3", gap: "" },
      { area: "ai_coding" as SkillArea, level: 5, lastAssessed: new Date().toISOString(), evidence: "\u5b8c\u6210AI\u7f16\u7a0b\u534f\u4f5c\u5173\u6240\u6709\u4efb\u52a1", gap: "" },
      { area: "prompt_engineering" as SkillArea, level: 4, lastAssessed: new Date().toISOString(), evidence: "\u7248\u672c\u5316prompt + \u8bc4\u6d4b\u96c6\u8fed\u4ee3", gap: "" },
      { area: "rag" as SkillArea, level: 4, lastAssessed: new Date().toISOString(), evidence: "RAG\u7cfb\u7edf\u6784\u5efa+\u53ec\u56de\u7387\u4f18\u5316", gap: "" },
      { area: "mcp" as SkillArea, level: 5, lastAssessed: new Date().toISOString(), evidence: "MCP server\u5f00\u53d1+\u767d\u540d\u5355\u9632\u62a4", gap: "" },
      { area: "agent" as SkillArea, level: 4, lastAssessed: new Date().toISOString(), evidence: "Agent loop + \u6545\u969c\u6062\u590d", gap: "" },
      { area: "evals" as SkillArea, level: 4, lastAssessed: new Date().toISOString(), evidence: "\u8bc4\u6d4b\u96c6+LLM judge", gap: "" },
      { area: "presentation" as SkillArea, level: 5, lastAssessed: new Date().toISOString(), evidence: "\u8def\u6f14\u89c6\u9891+\u7ec8\u9762\u7b54\u8fa9", gap: "" },
    ],
    milestones: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      date: new Date(now - (8 - n) * day).toISOString(),
      title: "\u901a\u8fc7\u7b2c" + n + "\u5173\uff1a" + GATE_NAMES[n] + "\uff08\u4e09\u95e8\u5168\u7eff\uff09",
      detail: "\u81ea\u68c0 + \u63d0\u4ea4\u8bc4\u5ba1 + \u9762\u8bd5\u8d28\u8be2\u5168\u90e8\u901a\u8fc7",
      type: "gate_complete" as const,
    })),
    weakPoints: [], strengths: ["\u81ea\u9a71\u529b\u5f3a", "\u4ea7\u54c1\u601d\u7ef4", "\u5168\u6808\u843d\u5730\u80fd\u529b"],
    sessionCount: 48, lastSessionAt: new Date().toISOString(),
    xp: 4500, level: 16, achievements: [], streak: { count: 12, best: 15, lastActiveDate: new Date().toISOString().slice(0, 10) },
    interviewResults: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => makeInterview(n, 88 + Math.floor(Math.random() * 10))),
    teacherRequests: [],
    projectSelection: {
      categoryId: "knowledge-base",
      projectName: "企业知识库 RAG 问答系统",
      targetUser: "企业内部新员工与客服团队",
      dataSource: "制度文档、产品手册、FAQ、历史工单",
      scores: { realUser: 5, realData: 5, demo: 5, technicalDepth: 5, evalFeasibility: 5, jobStory: 5, riskBoundary: 4 },
      totalScore: 34,
      verdict: "适合作为企业上岗级主项目",
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function buildStudentContext(studentId: string): Promise<string> {
  const p = await getOrCreateProfile(studentId);
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

  // ---- 本关实战实锤：把学生亲手写的自检、被评审揪出的差距、面试短板注入，
  //      让教练能引用具体内容做精准指导，而不是泛泛而谈(P1-8 病根:回答机械不贴场景) ----
  const curGateNum = inProg?.gate ?? p.currentGate;
  const cur = p.gateProgress.find((g) => g.gate === curGateNum);
  const evidence: string[] = [];

  const failedChecks = (cur?.selfCheckData?.items ?? []).filter((it) => it.passed === false || (typeof it.score === "number" && it.score < 60));
  if (failedChecks.length > 0) {
    evidence.push(`- 自检未过的条目(学生原文→质检反馈)：`);
    failedChecks.slice(0, 3).forEach((it) => {
      const label = (it.criterion || "").trim() || `${(it.content || "").trim().slice(0, 20)}…`;
      const wrote = (it.content || "").trim().slice(0, 80);
      const fb = (it.feedback || "").trim().slice(0, 80);
      evidence.push(`  - 「${label}」学生写：${wrote || "(空)"}${fb ? `；质检指出：${fb}` : ""}`);
    });
  }

  const lastSub = [...(cur?.submissions ?? [])].reverse().find((s) => s.status === "approved" || s.status === "rejected");
  if (lastSub) {
    const verdict = lastSub.status === "approved" ? "通过" : "驳回";
    evidence.push(`- GitHub 评审：${verdict}${typeof lastSub.overallScore === "number" ? ` ${lastSub.overallScore}分` : ""}${lastSub.topGap ? `，最大差距：${String(lastSub.topGap).slice(0, 80)}` : ""}`);
  }

  const lastIv = [...(p.interviewResults ?? [])].reverse().find((r) => r.gate === curGateNum);
  if (lastIv && (lastIv.gaps?.length || !lastIv.passed)) {
    evidence.push(`- 模拟面试：${lastIv.passed ? "通过" : "未过"} ${lastIv.score}分${lastIv.gaps?.length ? `，短板：${lastIv.gaps.slice(0, 2).map((g) => String(g).slice(0, 50)).join("；")}` : ""}`);
  }

  if (p.basicsReadiness && p.basicsReadiness.passed === false && p.basicsReadiness.weakConcepts?.length) {
    evidence.push(`- 基础准入未过，薄弱概念：${p.basicsReadiness.weakConcepts.join("、")}(可引导回 OpenMAIC 补学)`);
  }

  if (evidence.length > 0) {
    lines.push(`\n## 本关实战实锤（第${curGateNum}关，用于精准指导）`);
    lines.push(...evidence);
    lines.push(`\n请优先针对上述实锤给建议：引用学生自检的原话、评审揪出的差距、面试的短板，指出下一步最小动作；不要泛泛而谈。`);
  } else {
    lines.push(`\n请在回答时结合以上画像：提到学生的强项时给予具体肯定，发现弱点时针对性加练，技能有提升时祝贺并追问证据。`);
  }
  return lines.join("\n");
}
