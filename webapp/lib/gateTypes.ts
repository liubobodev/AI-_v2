// 关卡结构化数据类型（纯类型，客户端安全，无 Node.js 依赖）

export type KnowledgePoint = { title: string; body: string };
export type SourceLink = { text: string; url: string };

export type GateData = {
  gate: number;
  name: string;
  weekRange: string;
  // ---- 来自任务卡（03_八关任务卡）----
  objective: string;
  jdRef: string;
  techStack: string;
  tasks: string[];
  acceptanceCriteria: string[];
  resumeSentence: string;
  interviewQuestions: string[];
  toolUsage: string;
  // ---- 来自教师高阶讲解（12_高阶知识讲解）----
  positioning: string;
  knowledgePoints: KnowledgePoint[];
  commonMistakes: string[];
  realHook: string;
  sources: SourceLink[];
  // ---- 来自能力体系补充（13_AI应用开发能力体系，仅部分关卡有）----
  extraCompetency: { fileTitle: string; points: KnowledgePoint[] }[];
};

export const GATE_NAMES: Record<number, string> = {
  1: "侦察关", 2: "AI编程协作关", 3: "Prompt资产关", 4: "RAG工程关",
  5: "工具与MCP关", 6: "Agent系统关", 7: "Evals上线关", 8: "发射关",
};

export const GATE_ICONS: Record<number, string> = {
  1: "🔭", 2: "⌨️", 3: "🧩", 4: "📚", 5: "🔌", 6: "🤖", 7: "📊", 8: "🚀",
};
