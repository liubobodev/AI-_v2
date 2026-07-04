export type QuickCommand = {
  id: string;
  label: string;
  hint: string;
  message: string;
  group: "诊断" | "情报" | "关卡" | "面试" | "引导";
};

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "demo",
    label: "示例对话",
    hint: "第一次用？看一段教练的标准六段式回答",
    message:
      "请给我展示一段示例对话。假设我是一名本科生，正在第 4 关 RAG 工程关，我的检索召回率卡在 60% 上不去。请用标准的六段结构（判断→最小可行动作→执行步骤→验收标准→就业转化→下一步）给我一个示范回答。",
    group: "引导",
  },
  {
    id: "diagnose",
    label: "诊断我的项目",
    hint: "贴上你的 GitHub 链接或项目描述,教练按四件套 rubric 打分",
    message: "帮我诊断一下我当前的项目,按照四件套(README/evals/COST/POSTMORTEM)标准检查。",
    group: "诊断",
  },
  {
    id: "advanced",
    label: "讲高阶",
    hint: "讲这一关对应的教师高阶知识点",
    message: "讲高阶:我现在在这一关,请讲这一关的高阶知识点。",
    group: "关卡",
  },
  {
    id: "card",
    label: "记录卡点",
    hint: "卡壳超过 25 分钟?先解决问题,再生成一张卡点卡片",
    message: "记录卡点:我卡住了,请先帮我解决问题,再生成一张卡点卡片。",
    group: "关卡",
  },
  {
    id: "select-module",
    label: "选模块",
    hint: "从 A-F 六个方向模块里推荐适合我的一个",
    message: "选模块:请帮我从工具生态的 A-F 模块里推荐一个适合我的方向。",
    group: "诊断",
  },
  {
    id: "select-scenario",
    label: "选企业场景",
    hint: "从 12 个真实办公场景里推荐 2 个给我选",
    message: "选企业场景:请从场景选题矩阵推荐 2 个适合我的场景。",
    group: "诊断",
  },
  {
    id: "pulse",
    label: "每日脉搏",
    hint: "中文头部科技媒体+社区近三天热点(需联网)",
    message: "每日脉搏:给我今天的 AI 行业热点简报,附来源链接。",
    group: "情报",
  },
  {
    id: "interview",
    label: "面试我",
    hint: "切换四种面试官人格,连续追问 5 轮",
    message: "面试我。",
    group: "面试",
  },
  {
    id: "hard-question",
    label: "难题抽问",
    hint: "按你认领的企业落地十大难题深挖",
    message: "难题抽问:请按我认领的企业落地难题,以面试官身份深挖。",
    group: "面试",
  },
];
