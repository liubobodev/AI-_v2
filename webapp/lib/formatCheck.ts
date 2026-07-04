/**
 * 检测模型输出是否包含系统提示词要求的 6 段固定结构。
 * 缺失超过 2 段时追加格式提醒。
 */

const REQUIRED_SECTIONS = [
  { key: "judgment", patterns: ["判断", "**判断**", "问题判断", "核心问题"] },
  { key: "action", patterns: ["最小可行动作", "**最小可行动作**", "最小可行", "今天能做"] },
  { key: "steps", patterns: ["执行步骤", "**执行步骤**", "具体步骤", "操作步骤"] },
  { key: "criteria", patterns: ["验收标准", "**验收标准**", "检查标准", "通过标准"] },
  { key: "career", patterns: ["就业转化", "**就业转化**", "简历", "面试能答"] },
  { key: "next", patterns: ["下一步", "**下一步**", "后续行动"] },
];

export type FormatReport = {
  missing: string[];
  ok: boolean;
};

export function checkFormat(text: string): FormatReport {
  const missing: string[] = [];
  for (const section of REQUIRED_SECTIONS) {
    const found = section.patterns.some((p) => text.includes(p));
    if (!found) {
      missing.push(section.key);
    }
  }
  return { missing, ok: missing.length <= 2 };
}

const SECTION_LABELS: Record<string, string> = {
  judgment: "判断",
  action: "最小可行动作",
  steps: "执行步骤",
  criteria: "验收标准",
  career: "就业转化",
  next: "下一步",
};

export function formatWarning(missing: string[]): string {
  if (missing.length === 0) return "";
  const names = missing.map((k) => `「${SECTION_LABELS[k] || k}」`).join("、");
  return `\n\n---\n> ⚠️ **格式提醒**：本次回答缺少以下固定段落：${names}。你可以输入「请按六段结构重新回答」让教练补全。`;
}
