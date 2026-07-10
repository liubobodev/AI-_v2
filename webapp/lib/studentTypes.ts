// 学生档案类型定义（纯类型，无 Node.js 依赖，客户端安全）

export type StudentRole = "teacher" | "undergrad" | "master" | "jobseeker";
export type GateStatus = "not_started" | "in_progress" | "completed" | "blocked";

export type SubmissionStatus = "pending" | "reviewing" | "approved" | "rejected";

export type CriterionScore = { criterion: string; passed: boolean; evidence: string };

export type Submission = {
  id: string;
  link: string;
  submittedAt: string;
  status: SubmissionStatus;
  overallScore?: number;
  criteria?: CriterionScore[];
  topStrength?: string;
  topGap?: string;
  nextStep?: string;
  rawError?: string;
};

/** 三道通关门:自检 → 提交评审 → 面试质询。全绿才算「已通关」 */

/** 自检清单单项：验收标准原文 + 学生输入内容 + AI 质检反馈 */
export type SelfCheckItem = {
  key: string;
  criterion: string;
  content: string;
  savedAt?: string;
  feedback?: string;
  score?: number;
  passed?: boolean;
};

/** 自检提交记录 */
export type SelfCheckSubmission = {
  items: SelfCheckItem[];
  status: "writing" | "saved" | "submitted" | "reviewed";
  submittedAt?: string;
  reviewedAt?: string;
  overallScore?: number;
  overallPassed?: boolean;
  summary?: string;
};

/** 闯关档案条目：追溯每关的实战实锤 */
export type ArchiveEntry = {
  id: string;
  type: "self_check" | "submission_review" | "interview" | "ai_feedback";
  date: string;
  title: string;
  detail: string;
  content?: string;
  aiFeedback?: string;
  score?: number;
  passed?: boolean;
};

export type TeacherRequestStatus = "open" | "answered";

export type TeacherRequest = {
  id: string;
  gate: number;
  title: string;
  detail: string;
  status: TeacherRequestStatus;
  createdAt: string;
  answeredAt?: string;
};

export type ProjectSelection = {
  categoryId: string;
  projectName: string;
  targetUser: string;
  dataSource: string;
  scores: Record<string, number>;
  totalScore: number;
  verdict: string;
  updatedAt: string;
  teacherComment?: string;
};

export type EvidenceItem = {
  key: string;
  label: string;
  gate: number;
  status: "missing" | "draft" | "submitted" | "approved";
  link?: string;
  note?: string;
  score?: number;
  updatedAt: string;
};
export type GateDoors = {
  selfCheck: boolean;
  submissionApproved: boolean;
  interviewPassed: boolean;
};

export type GateProgress = {
  gate: number;
  name: string;
  status: GateStatus;
  startedAt?: string;
  completedAt?: string;
  evidence?: string;
  coachNotes?: string;
  score?: number;
  doors?: GateDoors;
  submissions?: Submission[];
  checklist?: Record<string, boolean>; // key: 验收标准文本的 hash 或 index，value: 是否自检勾选
  selfCheckData?: SelfCheckSubmission;
  archive?: ArchiveEntry[];
  evidencePackage?: EvidenceItem[];
};

export type SkillArea =
  | "product_analysis" | "ai_coding" | "prompt_engineering"
  | "rag" | "mcp" | "agent" | "evals" | "presentation";

export const SKILL_LABELS: Record<SkillArea, string> = {
  product_analysis: "产品拆解", ai_coding: "AI编程协作",
  prompt_engineering: "Prompt工程", rag: "RAG工程",
  mcp: "MCP集成", agent: "Agent系统",
  evals: "评测工程", presentation: "表达呈现",
};

export type SkillAssessment = {
  area: SkillArea;
  level: number;
  lastAssessed: string;
  evidence: string;
  gap: string;
};

export type Milestone = {
  date: string;
  title: string;
  detail: string;
  type: "gate_complete" | "skill_up" | "project" | "interview" | "breakthrough";
};

/* ===== 游戏化：段位 / 成就 / 连击 / 面试战绩 ===== */

export type AchievementTier = "common" | "rare" | "epic" | "legendary";

/** 成就定义（静态，来自 gamification.ts） */
export type Achievement = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tier: AchievementTier;
};

/** 已解锁记录（存档里的） */
export type UnlockedAchievement = { id: string; unlockedAt: string };

export type StreakState = { count: number; best: number; lastActiveDate: string };

export type InterviewVerdict = "pass" | "edge" | "fail";

export type InterviewResult = {
  id: string;
  gate: number;
  score: number;           // 0-100
  verdict: InterviewVerdict;
  passed: boolean;
  strengths: string[];
  gaps: string[];
  comment: string;
  date: string;
};

/** 一次操作产生的奖励增量，回传给前端做庆祝动画 */
export type RewardDelta = {
  xpGained: number;
  totalXp: number;
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
  rankName: string;
  rankIcon: string;
  newAchievements: Achievement[];
  reason: string;
};

export type StudentProfile = {
  studentId: string;
  createdAt: string;
  updatedAt: string;
  role: StudentRole | "";
  major: string;
  targetRole: string;
  techStack: string[];
  currentGate: number;
  gateProgress: GateProgress[];
  skills: SkillAssessment[];
  milestones: Milestone[];
  weakPoints: string[];
  strengths: string[];
  sessionCount: number;
  lastSessionAt: string;
  // ---- 游戏化字段（旧存档会在 store 里自动补默认值）----
  xp: number;
  level: number;
  achievements: UnlockedAchievement[];
  streak: StreakState;
  interviewResults: InterviewResult[];
  teacherRequests: TeacherRequest[];
  projectSelection?: ProjectSelection;
  // ---- 基础准入(OpenMAIC 自学 + 轻量自测)----
  basicsReadiness?: BasicsReadiness;
};

/** 基础准入自测结果 */
export type BasicsReadiness = {
  score: number;       // 0-100
  passed: boolean;     // ≥70 视为地基已筑
  weakConcepts: string[];
  comment: string;
  date: string;
};
