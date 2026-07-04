/**
 * Build-time script: 读取仓库根目录的所有知识库 Markdown 文件，
 * 生成 lib/knowledge-cache.ts，将所有内容嵌入为字符串常量。
 * Vercel 部署时无需访问仓库文件系统。
 */
import fs from "fs";
import path from "path";

const VAULT_ROOT = path.join(__dirname, "..", "..");

const SYSTEM_PROMPT_REL = "01_智能体设定/实战总教练_系统提示词.md";

const COMMON_FILES = [
  "02_课程总纲/训练营总纲_2026版.md",
  "03_八关任务卡/关卡总览.md",
  "04_评测与安全/Evals实战手册.md",
  "12_高阶知识讲解/00_模块说明.md",
];

const GATE_FILES: Record<number, string[]> = {
  1: ["03_八关任务卡/01_侦察关.md","05_就业面试/2026_AI岗位能力地图.md","09_GitHub资源引擎/GitHub资源引擎.md","09_GitHub资源引擎/活水来源设计.md","10_企业场景案例库/场景选题矩阵.md","10_企业场景案例库/企业落地十大难题.md","12_高阶知识讲解/01_侦察关_高阶.md"],
  2: ["03_八关任务卡/02_AI编程协作关.md","09_GitHub资源引擎/GitHub资源引擎.md","12_高阶知识讲解/02_AI编程协作关_高阶.md"],
  3: ["03_八关任务卡/03_Prompt资产关.md","12_高阶知识讲解/03_Prompt资产关_高阶.md"],
  4: ["03_八关任务卡/04_RAG工程关.md","12_高阶知识讲解/04_RAG工程关_高阶.md"],
  5: ["03_八关任务卡/05_工具与MCP关.md","11_工具生态连动设计/工具生态总图.md","11_工具生态连动设计/学习难点飞轮.md","12_高阶知识讲解/05_工具与MCP关_高阶.md"],
  6: ["03_八关任务卡/06_Agent系统关.md","12_高阶知识讲解/06_Agent系统关_高阶.md"],
  7: ["03_八关任务卡/07_Evals上线关.md","12_高阶知识讲解/07_Evals上线关_高阶.md"],
  8: ["03_八关任务卡/08_发射关.md","05_就业面试/2026_AI岗位能力地图.md","05_就业面试/面试官人格库与追问题库.md","12_高阶知识讲解/08_发射关_高阶.md"],
};

function safeRead(relPath: string): string {
  const full = path.join(VAULT_ROOT, relPath);
  try { return fs.readFileSync(full, "utf-8"); }
  catch { console.warn("Missing: " + relPath); return ""; }
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function build() {
  console.log("Building knowledge cache...");
  const systemPrompt = safeRead(SYSTEM_PROMPT_REL);

  const allSet = new Set<string>();
  COMMON_FILES.forEach((f) => allSet.add(f));
  for (let g = 1; g <= 8; g++) GATE_FILES[g].forEach((f) => allSet.add(f));
  const fullText = [...allSet].map((f) => {
    const c = safeRead(f);
    return c ? "\n\n---\n### 【" + f + "】\n\n" + c : "";
  }).join("");

  const gateTexts: Record<number, string> = {};
  for (let g = 1; g <= 8; g++) {
    const files = [...COMMON_FILES, ...GATE_FILES[g]];
    gateTexts[g] = files.map((f) => {
      const c = safeRead(f);
      return c ? "\n\n---\n### 【" + f + "】\n\n" + c : "";
    }).join("");
  }

  const lines: string[] = [
    "// AUTO-GENERATED — DO NOT EDIT",
    "// Run: npx tsx scripts/build-kb.ts",
    "",
    "export const SYSTEM_PROMPT = `" + esc(systemPrompt) + "`;",
    "",
    "export const KNOWLEDGE_FULL = `" + esc(fullText) + "`;",
    "",
    "export const KNOWLEDGE_BY_GATE: Record<number, string> = {",
  ];
  for (let g = 1; g <= 8; g++) {
    lines.push("  " + g + ": `" + esc(gateTexts[g]) + "`,");
  }
  lines.push("};");

  const out = lines.join("\n");
  const outPath = path.join(__dirname, "..", "lib", "knowledge-cache.ts");
  fs.writeFileSync(outPath, out, "utf-8");
  console.log("Knowledge cache: " + (out.length / 1024).toFixed(0) + " KB");
}

build();
