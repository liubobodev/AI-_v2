// 通用 Markdown 结构化解析器（纯函数，build-time 和 dev-time 共用）
// 依据本训练营文档的固定标题约定解析：
//   任务卡：## 目标 / JD 原文对标 / 技术栈 / 任务 / 验收 rubric / 简历句模板 / 面试追问预演 / 双工具用法
//   高阶讲解：## 定位 / 一、二、三...（知识点）/ 常见误区 / 来源锚点 / 本关实战钩子 / 深挖资源

import type { GateData, KnowledgePoint, SourceLink } from "./gateTypes";
import { GATE_NAMES } from "./gateTypes";

type Section = { heading: string; body: string };

function splitSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
      current = { heading: m[1], body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
  return sections;
}

function findSection(sections: Section[], keywords: string[]): Section | undefined {
  return sections.find((s) => keywords.some((k) => s.heading.includes(k)));
}

function findBody(sections: Section[], keywords: string[]): string {
  return findSection(sections, keywords)?.body ?? "";
}

function extractBullets(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l))
    .map((l) =>
      l
        .replace(/^[-*]\s+(\[[ xX]\]\s*)?/, "")
        .replace(/^\d+\.\s+/, "")
        .trim()
    )
    .filter(Boolean);
}

function extractLinks(body: string): SourceLink[] {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out: SourceLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push({ text: m[1], url: m[2] });
  return out;
}

const NUMERAL_RE = /^[一二三四五六七八九十]+、/;
const EXCLUDE_KEYWORDS = ["常见误区", "来源锚点", "本关实战钩子", "深挖资源"];

/** 从「高阶讲解」类文档中提取编号小节作为知识点卡片（排除误区/来源/钩子/深挖） */
function extractKnowledgePoints(sections: Section[]): KnowledgePoint[] {
  return sections
    .filter((s) => NUMERAL_RE.test(s.heading) && !EXCLUDE_KEYWORDS.some((k) => s.heading.includes(k)))
    .map((s) => ({ title: s.heading.replace(NUMERAL_RE, "").trim(), body: s.body }));
}

function parseWeekRange(title: string): string {
  const m = title.match(/[（(]\s*(W[\d–-]+)\s*[）)]/);
  return m ? m[1] : "";
}

/** 解析单个关卡：任务卡原文 + 高阶讲解原文 + 可选的能力体系补充文件（{标题, 原文}[]） */
export function parseGate(
  gate: number,
  taskCardMd: string,
  advancedMd: string,
  extraFiles: { title: string; md: string }[]
): GateData {
  const taskTitle = (taskCardMd.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();
  const taskSections = splitSections(taskCardMd);
  const advSections = splitSections(advancedMd);

  const acceptanceCriteria = extractBullets(findBody(taskSections, ["验收"]));
  const tasks = extractBullets(findBody(taskSections, ["任务"]));
  const interviewQuestions = extractBullets(findBody(taskSections, ["面试追问"]));
  const commonMistakes = extractBullets(findBody(advSections, ["常见误区"]));
  const sources = extractLinks(findBody(advSections, ["来源锚点"]));

  const extraCompetency = extraFiles.map((f) => {
    const sec = splitSections(f.md);
    return { fileTitle: f.title, points: extractKnowledgePoints(sec) };
  });

  return {
    gate,
    name: GATE_NAMES[gate] ?? `第${gate}关`,
    weekRange: parseWeekRange(taskTitle),
    objective: findBody(taskSections, ["目标"]),
    jdRef: findBody(taskSections, ["JD 原文对标", "JD原文对标", "简历筛选事实"]),
    techStack: findBody(taskSections, ["技术栈"]),
    tasks,
    acceptanceCriteria,
    resumeSentence: findBody(taskSections, ["简历句模板"]),
    interviewQuestions,
    toolUsage: findBody(taskSections, ["双工具用法"]),
    positioning: findBody(advSections, ["定位"]),
    knowledgePoints: extractKnowledgePoints(advSections),
    commonMistakes,
    realHook: findBody(advSections, ["本关实战钩子"]),
    sources,
    extraCompetency,
  };
}
