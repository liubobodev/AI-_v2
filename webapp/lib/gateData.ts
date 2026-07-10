import fs from "fs";
import path from "path";
import { parseGate } from "./gateParser";
import type { GateData } from "./gateTypes";

const VAULT_ROOT = path.join(process.cwd(), "..");

const TASK_CARD: Record<number, string> = {
  1: "03_八关任务卡/01_侦察关.md",
  2: "03_八关任务卡/02_AI编程协作关.md",
  3: "03_八关任务卡/03_Prompt资产关.md",
  4: "03_八关任务卡/04_RAG工程关.md",
  5: "03_八关任务卡/05_工具与MCP关.md",
  6: "03_八关任务卡/06_Agent系统关.md",
  7: "03_八关任务卡/07_Evals上线关.md",
  8: "03_八关任务卡/08_发射关.md",
};
const ADVANCED: Record<number, string> = {
  1: "12_高阶知识讲解/01_侦察关_高阶.md",
  2: "12_高阶知识讲解/02_AI编程协作关_高阶.md",
  3: "12_高阶知识讲解/03_Prompt资产关_高阶.md",
  4: "12_高阶知识讲解/04_RAG工程关_高阶.md",
  5: "12_高阶知识讲解/05_工具与MCP关_高阶.md",
  6: "12_高阶知识讲解/06_Agent系统关_高阶.md",
  7: "12_高阶知识讲解/07_Evals上线关_高阶.md",
  8: "12_高阶知识讲解/08_发射关_高阶.md",
};
const EXTRA: Record<number, { title: string; file: string }[]> = {
  2: [{ title: "AI产品UX设计模式", file: "13_AI应用开发能力体系/03_AI产品UX设计模式.md" }],
  3: [{ title: "模型选型与决策框架", file: "13_AI应用开发能力体系/01_模型选型与决策框架.md" }],
  4: [
    { title: "模型选型与决策框架", file: "13_AI应用开发能力体系/01_模型选型与决策框架.md" },
    { title: "多模态应用开发", file: "13_AI应用开发能力体系/02_多模态应用开发.md" },
  ],
  6: [{ title: "AI产品UX设计模式", file: "13_AI应用开发能力体系/03_AI产品UX设计模式.md" }],
  7: [{ title: "模型选型与决策框架", file: "13_AI应用开发能力体系/01_模型选型与决策框架.md" }],
};

function safeRead(rel: string): string {
  try { return fs.readFileSync(path.join(VAULT_ROOT, rel), "utf-8"); }
  catch { return ""; }
}

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const devCache = new Map<number, GateData>();
let prodCache: Record<number, GateData> | null = null;

function loadProd(): Record<number, GateData> {
  if (!prodCache) {
    try {
      prodCache = (require("./gate-cache") as { GATE_CACHE: Record<number, GateData> }).GATE_CACHE;
    } catch {
      prodCache = {};
    }
  }
  return prodCache;
}

export function getGateData(gate: number): GateData | null {
  if (gate < 1 || gate > 8) return null;
  if (isProd) return loadProd()[gate] ?? null;
  if (!devCache.has(gate)) {
    const taskMd = safeRead(TASK_CARD[gate]);
    const advMd = safeRead(ADVANCED[gate]);
    const extraFiles = (EXTRA[gate] ?? []).map((e) => ({ title: e.title, md: safeRead(e.file) }));
    devCache.set(gate, parseGate(gate, taskMd, advMd, extraFiles));
  }
  return devCache.get(gate)!;
}

export function getAllGates(): GateData[] {
  const out: GateData[] = [];
  for (let g = 1; g <= 8; g++) {
    const d = getGateData(g);
    if (d) out.push(d);
  }
  return out;
}
