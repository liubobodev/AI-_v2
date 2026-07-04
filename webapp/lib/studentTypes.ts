// 学生档案类型定义（纯类型，无 Node.js 依赖，客户端安全）

export type StudentRole = "teacher" | "undergrad" | "master" | "jobseeker";
export type GateStatus = "not_started" | "in_progress" | "completed" | "blocked";

export type GateProgress = {
  gate: number;
  name: string;
  status: GateStatus;
  startedAt?: string;
  completedAt?: string;
  evidence?: string;
  coachNotes?: string;
  score?: number;
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
};
