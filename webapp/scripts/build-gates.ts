/**
 * Build-time script: 解析 Obsidian 库里的任务卡 + 高阶讲解 + 能力体系补充文件，
 * 生成结构化的 lib/gate-cache.ts（Record<number, GateData>）。
 * 单一事实源在 Markdown 文件里，改了文件重跑本脚本即同步，不手写 gateData。
 */
import fs from "fs";
import path from "path";
import { parseGate } from "../lib/gateParser";
import type { GateData } from "../lib/gateTypes";

const VAULT_ROOT = path.join(__dirname, "..", "..");

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

// 五层能力体系的横向补充：哪些关卡该带上哪份补充文件（与 lib/knowledgeBase.ts 的 GATE_FILES 保持一致）
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
  try {
    return fs.readFileSync(path.join(VAULT_ROOT, rel), "utf-8");
  } catch {
    console.warn("[build-gates] missing: " + rel);
    return "";
  }
}

function build() {
  console.log("Building gate cache...");
  const gates: Record<number, GateData> = {} as Record<number, GateData>;
  let missingSourceCount = 0;
  for (let g = 1; g <= 8; g++) {
    const taskMd = safeRead(TASK_CARD[g]);
    const advMd = safeRead(ADVANCED[g]);
    if (!taskMd || !advMd) missingSourceCount++;
    const extraFiles = (EXTRA[g] ?? []).map((e) => ({ title: e.title, md: safeRead(e.file) }));
    gates[g] = parseGate(g, taskMd, advMd, extraFiles);
  }

  const outPath = path.join(__dirname, "..", "lib", "gate-cache.ts");
  if (missingSourceCount > 0 && fs.existsSync(outPath)) {
    console.warn(
      `[build-gates] ${missingSourceCount} gate source pair(s) missing; keeping existing gate-cache.ts instead of overwriting with empty content.`
    );
    return;
  }

  const out = [
    "// AUTO-GENERATED — DO NOT EDIT",
    "// Run: npx tsx scripts/build-gates.ts",
    "",
    'import type { GateData } from "./gateTypes";',
    "",
    "export const GATE_CACHE: Record<number, GateData> = " + JSON.stringify(gates, null, 2) + ";",
    "",
  ].join("\n");

  fs.writeFileSync(outPath, out, "utf-8");
  console.log("Gate cache: " + (out.length / 1024).toFixed(0) + " KB, " + Object.keys(gates).length + " gates");
  // 健全性检查：提示哪些关卡的关键字段解析为空
  for (let g = 1; g <= 8; g++) {
    const d = gates[g];
    const empties: string[] = [];
    if (!d.objective) empties.push("objective");
    if (d.acceptanceCriteria.length === 0) empties.push("acceptanceCriteria");
    if (d.knowledgePoints.length === 0) empties.push("knowledgePoints");
    if (empties.length) console.warn(`  [关卡${g}] 字段为空: ${empties.join(", ")}`);
  }
}

build();
