import fs from "fs";
import path from "path";

const VAULT_ROOT = path.join(process.cwd(), "..");
const SYSTEM_PROMPT_REL = "01_智能体设定/实战总教练_系统提示词.md";

const COMMON_FILES = [
  "02_课程总纲/训练营总纲_2026版.md",
  "03_八关任务卡/关卡总览.md",
  "04_评测与安全/Evals实战手册.md",
  "12_高阶知识讲解/00_模块说明.md",
  "13_AI应用开发能力体系/00_核心能力地图.md",
  "14_基础准入/OpenMAIC基础自学与准入自测.md",
];

const GATE_FILES: Record<number, string[]> = {
  1: ["03_八关任务卡/01_侦察关.md","05_就业面试/2026_AI岗位能力地图.md","09_GitHub资源引擎/GitHub资源引擎.md","09_GitHub资源引擎/活水来源设计.md","10_企业场景案例库/场景选题矩阵.md","10_企业场景案例库/企业落地十大难题.md","12_高阶知识讲解/01_侦察关_高阶.md"],
  2: ["03_八关任务卡/02_AI编程协作关.md","09_GitHub资源引擎/GitHub资源引擎.md","12_高阶知识讲解/02_AI编程协作关_高阶.md","13_AI应用开发能力体系/03_AI产品UX设计模式.md"],
  3: ["03_八关任务卡/03_Prompt资产关.md","12_高阶知识讲解/03_Prompt资产关_高阶.md","13_AI应用开发能力体系/01_模型选型与决策框架.md"],
  4: ["03_八关任务卡/04_RAG工程关.md","12_高阶知识讲解/04_RAG工程关_高阶.md","13_AI应用开发能力体系/01_模型选型与决策框架.md","13_AI应用开发能力体系/02_多模态应用开发.md"],
  5: ["03_八关任务卡/05_工具与MCP关.md","11_工具生态连动设计/工具生态总图.md","11_工具生态连动设计/学习难点飞轮.md","12_高阶知识讲解/05_工具与MCP关_高阶.md"],
  6: ["03_八关任务卡/06_Agent系统关.md","12_高阶知识讲解/06_Agent系统关_高阶.md","13_AI应用开发能力体系/03_AI产品UX设计模式.md"],
  7: ["03_八关任务卡/07_Evals上线关.md","12_高阶知识讲解/07_Evals上线关_高阶.md","13_AI应用开发能力体系/01_模型选型与决策框架.md"],
  8: ["03_八关任务卡/08_发射关.md","05_就业面试/2026_AI岗位能力地图.md","05_就业面试/面试官人格库与追问题库.md","12_高阶知识讲解/08_发射关_高阶.md"],
};

function safeRead(relPath: string): string | null {
  try { return fs.readFileSync(path.join(VAULT_ROOT, relPath), "utf-8"); }
  catch { return null; }
}

function buildText(files: string[]): string {
  return files.map((f) => { const c = safeRead(f); return c ? `\n\n---\n### 【${f}】\n\n${c}` : ""; }).join("");
}

let cachedFull: string | null = null;
const cachedGate = new Map<number, string>();

// ---- 开发模式：运行时读文件 ----

function devPrompt(): string {
  return safeRead(SYSTEM_PROMPT_REL) ?? "（系统提示词文件读取失败）";
}

function devKnowledge(gate?: number): string {
  if (gate && gate >= 1 && gate <= 8) {
    if (!cachedGate.has(gate)) cachedGate.set(gate, buildText([...COMMON_FILES, ...GATE_FILES[gate]]));
    return cachedGate.get(gate)!;
  }
  if (!cachedFull) {
    const all = new Set<string>();
    COMMON_FILES.forEach((f) => all.add(f));
    for (let g = 1; g <= 8; g++) GATE_FILES[g].forEach((f) => all.add(f));
    cachedFull = buildText([...all]);
  }
  return cachedFull;
}

// ---- 生产模式（Vercel）：build-time 嵌入 ----

let prodPrompt: string | null = null;
let prodFull: string | null = null;
const prodGate = new Map<number, string>();

function loadProd() {
  try {
    // 动态 import 仅在服务端可用
    const cache = require("./knowledge-cache");
    prodPrompt = cache.SYSTEM_PROMPT;
    prodFull = cache.KNOWLEDGE_FULL;
    for (let g = 1; g <= 8; g++) prodGate.set(g, (cache.KNOWLEDGE_BY_GATE as Record<number,string>)[g] ?? "");
  } catch { /* dev 模式无此文件，回退到文件读取 */ }
}

// 判断是否在生产环境（Vercel / 非本地 dev）
const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

if (isProd) loadProd();

// ---- 公开 API ----

export function getBaseSystemPrompt(): string {
  if (isProd && prodPrompt) return prodPrompt;
  return devPrompt();
}

export function getKnowledgeBaseText(gate?: number): string {
  if (isProd && prodFull) {
    if (gate && gate >= 1 && gate <= 8) return prodGate.get(gate) ?? prodFull;
    return prodFull;
  }
  return devKnowledge(gate);
}

export function getKnowledgeStats() {
  const all = new Set<string>();
  COMMON_FILES.forEach((f) => all.add(f));
  for (let g = 1; g <= 8; g++) GATE_FILES[g].forEach((f) => all.add(f));
  const found: string[] = [];
  const missing: string[] = [];
  for (const f of all) {
    if (safeRead(f) !== null) found.push(f);
    else missing.push(f);
  }
  return { found, missing, vaultRoot: VAULT_ROOT };
}
