import {
  GATE_DEFINITIONS,
  type CoachMessage,
  type CoachScene,
} from "./chatScope";

type ScopeAction = "allow" | "refuse" | "redirect" | "clarify";

export type ScopeDecision = {
  action: ScopeAction;
  message: string;
  targetGate?: number;
  reason: string;
};

const GATE_PATTERNS: ReadonlyArray<{ gate: number; pattern: RegExp }> = [
  { gate: 1, pattern: /\bJD\b|岗位画像|岗位分析|产品拆解|竞品分析|个人赛道|场景选题|企业场景|用户调研/i },
  { gate: 2, pattern: /Claude\s*Code|Cursor|AI\s*编程|规格驱动|spec\s*driven|\bTDD\b|测试驱动/i },
  { gate: 3, pattern: /\bPrompt\b|提示词|结构化输出|JSON\s*Schema|模板版本|提示模板|few[ -]?shot|system\s*prompt/i },
  { gate: 4, pattern: /\bRAG\b|混合检索|向量检索|召回率?|embedding|切片|分块|重排|rerank|知识库问答|引用问答/i },
  { gate: 5, pattern: /\bMCP\b|Model\s*Context\s*Protocol|function\s*call|tool\s*call|工具调用|MCP\s*(server|client)|外部工具/i },
  { gate: 6, pattern: /\bAgent\b|智能体|多\s*Agent|多智能体|multi[ -]?agent|长期记忆|短期记忆|任务规划|工具编排|orchestrator|worker|失败重试|失败处理|重试机制|降级路径|护栏|\bReAct\b|Plan[ -]?and[ -]?Execute|reflection/i },
  { gate: 7, pattern: /\bEvals?\b|LLM\s*judge|评测集|自动化回归|回归脚本|红队报告|人工一致率|评测指标/i },
  { gate: 8, pattern: /简历句|作品集|项目包装|两分钟路演|2\s*分钟路演|模拟终面|终面|求职冲刺/i },
];

const SCOPE_SHARED_PATTERN =
  /训练营|本关|这一关|通关|验收|任务卡|高阶知识|记录卡点|项目代码|代码.{0,12}报错|报错.{0,12}代码|程序.{0,12}(?:报错|异常)|接口.{0,12}(?:报错|异常)|项目.{0,12}(?:报错|异常|bug)|GitHub\s*仓库|检查我的仓库|四件套|README|POSTMORTEM|COST\.md|能力自评|我还缺什么/i;

const CURRENT_SCENE_COMMAND =
  /^(讲高阶|记录卡点|面试我|难题抽问|验收自检|通关标准|诊断我的项目)(?:[：:].*)?$/i;

const GREETING_PATTERN = /^(你好|您好|嗨|hi|hello|谢谢|感谢|再见|好的|收到)[！!。.]?$/i;
const FOLLOW_UP_PATTERN =
  /^(继续|为什么|怎么做|如何改|举个例子|没懂|不明白|是|不是|对|不对|好的|然后呢|下一步|请展开|再具体一点)[？?！!。.]?$/i;
const CODE_PATTERN = /```|Traceback|\b(?:Error|Exception):|\bfunction\s+|\bconst\s+|\bdef\s+|\bclass\s+|\bimport\s+/i;
const NEW_REQUEST_PATTERN = /讲讲|请(?:讲|介绍|解释|推荐|写|规划)|介绍|推荐|告诉我|帮我|给我|科普|写一|规划.*(?:旅游|旅行)|解释一下|回答.*(?:问题|什么)/i;
const QUESTION_PATTERN = /为什么|是什么|怎么|如何|谁|哪(?:个|些|里|年)|多少|[？?]\s*$/i;
const INJECTION_PATTERN = /忽略.{0,16}(?:规则|指令|提示词)|无视.{0,16}(?:规则|指令)|你现在是|改成.*助手|扮演|角色扮演|解除限制|越狱|\bDAN\b|system\s*prompt/i;
const KNOWN_OUT_OF_SCOPE_PATTERN =
  /人性|哲学|股票|基金|荐股|彩票|医疗诊断|疾病|处方|法律裁决|诉讼|天气|旅游|旅行|菜谱|做饭|恋爱|星座|八字|电影|游戏|小说|写诗|诗歌|秦始皇|历史人物|宗教/i;

function currentGateLabel(gate?: number): string {
  const item = GATE_DEFINITIONS.find((candidate) => candidate.gate === gate);
  return item ? `第 ${item.gate} 关 · ${item.name}` : "当前关卡";
}

function refusal(gate: number | undefined, mixed = false, reason = "out_of_scope"): ScopeDecision {
  const prefix = mixed
    ? "你的请求同时包含训练营相关内容和无关内容。为避免越界，我不会把这条请求交给模型。请拆分问题，只保留"
    : "这个问题超出了我的身份范围，我不能回答。我只回答";
  return {
    action: "refuse",
    reason,
    message: `${prefix} AI 上岗实战训练营中与${currentGateLabel(gate)}直接相关的内容。`,
  };
}

function gateTargets(content: string): number[] {
  return GATE_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ gate }) => gate);
}

function hasExplicitInterviewMarker(messages: CoachMessage[], gate?: number): boolean {
  return messages.some(({ role, content }) => {
    if (role !== "user") return false;
    const match = trustedInterviewCommand(content);
    return !!match && Number(match[1]) === gate;
  });
}

function trustedInterviewCommand(content: string): RegExpMatchArray | null {
  return content.match(
    /^【第\s*(\d+)\s*关面试】请(?:开始模拟面试。围绕「[^」]+」按真实面试官方式一次只问一个问题，先问第一题，等我回答后再追问。|继续刚才没有完成的模拟面试。先简短复述上一个问题和我的已答要点，再接着追问下一题，不要从头重新开始。)$/
  );
}

const BASICS_COMMAND =
  /^【基础准入自测】请给我做基础准入自测。围绕大模型\/幻觉、上下文窗口、Prompt四要素、结构化输出、Embedding与向量检索、RAG链路、Agent与工具调用、MCP、Evals 这 9 个基础概念,一次问一题,等我答完再问下一题,共问 8-10 题。我答完会点"结算基础自测"。$/;

function hasBasicsAssessment(messages: CoachMessage[]): boolean {
  return messages.some(({ role, content }) => role === "user" && BASICS_COMMAND.test(content));
}

function previousUserMessage(messages: CoachMessage[]): string {
  const users = messages.filter((message) => message.role === "user");
  return users.length >= 2 ? users[users.length - 2].content.trim() : "";
}

function isClearlyTrainingRelated(content: string, gate?: number): boolean {
  const targets = gateTargets(content);
  return targets.includes(gate ?? -1) || SCOPE_SHARED_PATTERN.test(content) || CURRENT_SCENE_COMMAND.test(content);
}

function hasUnscopedRequestClause(content: string): boolean {
  const clauses = content
    .split(/[，,；;。\n：:]|顺便|另外|同时还|并且还|除此之外|还有一个/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  if (clauses.length < 2) return false;

  return clauses.some((clause) => {
    if (
      gateTargets(clause).length > 0 ||
      SCOPE_SHARED_PATTERN.test(clause) ||
      CURRENT_SCENE_COMMAND.test(clause) ||
      CODE_PATTERN.test(clause)
    ) {
      return false;
    }
    // “怎么改”“它为什么失败”通常承接前一条本关子句，不算新话题。
    if (/^(?:怎么|如何|为什么|哪(?:里|个|些)|它|这|那|上述|前面)/.test(clause)) return false;
    return NEW_REQUEST_PATTERN.test(clause) || QUESTION_PATTERN.test(clause);
  });
}

function hasKeywordPadding(content: string): boolean {
  const intent = content.match(/(?:请)?(?:讲讲|讲一下|讲解|介绍(?:一下)?|推荐|告诉我|帮我|给我|写(?:一份)?|规划|解释|说说)/);
  if (!intent || intent.index == null) return false;

  const before = content.slice(0, intent.index).trim();
  const after = content.slice(intent.index + intent[0].length).trim();
  const beforeIsScope = gateTargets(before).length > 0 || SCOPE_SHARED_PATTERN.test(before);
  const afterIsScope = gateTargets(after).length > 0 || SCOPE_SHARED_PATTERN.test(after) || CODE_PATTERN.test(after);
  if (!beforeIsScope || afterIsScope || !after) return false;

  // “Agent，请解释一下/为什么会失败/怎么优化”仍然是在追问前面的技术主题。
  if (/^(?:一下|清楚|详细|具体|为什么(?:会)?(?:失败|出错)|怎么(?:设计|实现|改|优化)|如何(?:设计|实现|改|优化))[？?。.]?$/.test(after)) {
    return false;
  }
  return true;
}

function hasQuestionKeywordPadding(content: string): boolean {
  const question = content.match(/为什么|怎么|如何|是什么/);
  if (!question || question.index == null) return false;

  const before = content.slice(0, question.index).trim();
  const after = content.slice(question.index + question[0].length).trim().replace(/[？?。.]$/, "");
  const beforeIsScope = gateTargets(before).length > 0 || SCOPE_SHARED_PATTERN.test(before);
  const afterIsScope = gateTargets(after).length > 0 || SCOPE_SHARED_PATTERN.test(after) || CODE_PATTERN.test(after);
  if (!beforeIsScope || afterIsScope || !after) return false;

  // 仅放行明确承接前方技术主语的短问法；出现新的未知主语时失败关闭。
  return !/^(?:会失败|会出错|需要什么|有什么用|工作|运行|设计|实现|优化|做|调用|协作|规划|执行|记忆|评测|检索|管理|写|部署|测试|报错|控制|构建|准备|处理|排查|解决|改进|提升|编写|配置|搭建|选择|判断|验证|衡量|调试|定位|复现|发布|上线|连接数据库|接入数据库)$/.test(after);
}

export function enforceCoachScope({
  gate,
  userRole,
  messages,
  scene: _scene,
}: {
  gate?: number;
  userRole?: string;
  messages: CoachMessage[];
  scene?: CoachScene;
}): ScopeDecision {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
  const isTeacher = userRole === "teacher";
  const validGate = GATE_DEFINITIONS.some((item) => item.gate === gate);

  if (!latest) return refusal(gate, false, "empty_user_message");
  if (INJECTION_PATTERN.test(latest)) return refusal(gate, false, "prompt_injection");

  const targets = gateTargets(latest);
  const hasTrainingContent = targets.length > 0 || SCOPE_SHARED_PATTERN.test(latest) || CURRENT_SCENE_COMMAND.test(latest);
  if (KNOWN_OUT_OF_SCOPE_PATTERN.test(latest)) {
    return refusal(gate, hasTrainingContent, "known_out_of_scope");
  }
  if (!isTeacher && !validGate) {
    return {
      action: "clarify",
      reason: "missing_gate",
      message: "当前关卡尚未确定。请先进入对应关卡，再提出与该关任务相关的问题。",
    };
  }

  const interviewCommand = trustedInterviewCommand(latest);
  if (interviewCommand) {
    const targetGate = Number(interviewCommand[1]);
    if (targetGate !== gate && validGate) return redirectDecision(gate!, targetGate);
    return { action: "allow", reason: "current_gate_interview_start", message: "" };
  }
  if (BASICS_COMMAND.test(latest)) {
    return { action: "allow", reason: "basics_assessment_start", message: "" };
  }

  if (hasTrainingContent && hasUnscopedRequestClause(latest)) {
    return refusal(gate, true, "mixed_unscoped_clause");
  }
  if (hasTrainingContent && hasKeywordPadding(latest)) {
    return refusal(gate, true, "scope_keyword_padding");
  }
  if (hasTrainingContent && hasQuestionKeywordPadding(latest)) {
    return refusal(gate, true, "scope_question_padding");
  }

  if (GREETING_PATTERN.test(latest)) {
    return {
      action: "clarify",
      reason: "social_message",
      message: `你好，我是 AI 上岗实战总教练。请问你在${currentGateLabel(gate)}遇到了什么训练问题？`,
    };
  }

  if (isTeacher) {
    if (hasTrainingContent || /课程|教学|评分|教案|课堂|实训|学生.{0,10}(?:训练|项目|学习|辅导)|AI\s*应用|大模型|LLM/i.test(latest)) {
      return { action: "allow", reason: "teacher_training_scope", message: "" };
    }
    return refusal(gate);
  }

  if (/^面试我[。.]?$/i.test(latest)) {
    return { action: "allow", reason: "current_gate_interview_start", message: "" };
  }

  const ongoingBasics = hasBasicsAssessment(messages) && !BASICS_COMMAND.test(latest);
  if (ongoingBasics && targets.length === 0 && !SCOPE_SHARED_PATTERN.test(latest)) {
    if (NEW_REQUEST_PATTERN.test(latest) || QUESTION_PATTERN.test(latest)) return refusal(gate);
    return { action: "allow", reason: "basics_assessment_answer", message: "" };
  }

  // scene 来自客户端，不能作为放行依据；只信任由本应用生成的完整面试命令。
  const ongoingInterview = hasExplicitInterviewMarker(messages, gate);
  if (ongoingInterview && targets.length === 0 && !SCOPE_SHARED_PATTERN.test(latest)) {
    if (NEW_REQUEST_PATTERN.test(latest) || QUESTION_PATTERN.test(latest)) return refusal(gate);
    return { action: "allow", reason: "current_gate_interview_answer", message: "" };
  }

  if (targets.length > 0) {
    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.includes(gate!)) {
      if (uniqueTargets.some((target) => target !== gate)) {
        return {
          action: "clarify",
          reason: "mixed_gate_request",
          message: `这条请求同时涉及多个关卡。你当前在${currentGateLabel(gate)}，请只保留本关问题；其他内容切换到对应关卡后再问。`,
        };
      }
      return { action: "allow", reason: "current_gate_topic", message: "" };
    }
    return redirectDecision(gate!, uniqueTargets[0]);
  }

  if (CURRENT_SCENE_COMMAND.test(latest) || SCOPE_SHARED_PATTERN.test(latest)) {
    return { action: "allow", reason: "shared_training_scope", message: "" };
  }

  if (CODE_PATTERN.test(latest) && isClearlyTrainingRelated(previousUserMessage(messages), gate)) {
    return { action: "allow", reason: "requested_training_code", message: "" };
  }

  if (FOLLOW_UP_PATTERN.test(latest) && isClearlyTrainingRelated(previousUserMessage(messages), gate)) {
    return { action: "allow", reason: "training_follow_up", message: "" };
  }

  // 严格失败关闭：无法证明属于当前关，就不把内容交给通用模型。
  return refusal(gate, false, "unrecognized_scope");
}

function redirectDecision(currentGate: number, targetGate: number): ScopeDecision {
  const target = GATE_DEFINITIONS.find((item) => item.gate === targetGate);
  return {
    action: "redirect",
    targetGate,
    reason: "different_gate",
    message: `这个问题属于第 ${targetGate} 关 · ${target?.name ?? "对应关卡"}。你当前在${currentGateLabel(currentGate)}，请切换到第 ${targetGate} 关的对应场景后再问。`,
  };
}

export function staticChatStream(message: string): Response {
  const payload = JSON.stringify({
    choices: [{ index: 0, delta: { role: "assistant", content: message }, finish_reason: null }],
  });
  return new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-coach-scope": "blocked",
    },
  });
}
