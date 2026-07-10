export type LearnerTrack = "undergrad" | "master" | "jobseeker";

export type CourseWeek = {
  week: number;
  gate: number;
  title: string;
  enterpriseCapability: string;
  studentDeliverable: string;
  teacherIntervention: string;
  acceptance: string;
};

export type ProjectCategory = {
  id: string;
  name: string;
  enterpriseVersion: string;
  examples: string[];
  dataSources: string[];
  stack: string[];
  evalMetrics: string[];
  interviewAngle: string;
  tracks: LearnerTrack[];
};

export type ProjectScoreCriterion = {
  key: string;
  label: string;
  question: string;
};

export type EvidenceRequirement = {
  key: string;
  label: string;
  gate: number;
  requiredFor: LearnerTrack[];
  description: string;
};

export type TeacherPrompt = {
  id: string;
  title: string;
  audience: string;
  output: string;
  prompt: string;
};

export const FRONTIER_ANCHORS = [
  "OpenAI Agents/Evals: traces, graders, datasets, regression runs",
  "MCP 官方规范: server/client、工具权限、敏感动作确认",
  "OWASP LLM Top 10: prompt injection、敏感信息、过度代理、向量库风险",
  "LangGraph: durable execution、human-in-the-loop、stateful agents",
  "Vercel AI SDK: type-safe streaming、structured output、agent/tool integration",
  "Claude Code/Codex/Cursor: 规格驱动开发、代码审查、测试和回滚",
];

export const COURSE_WEEKS: CourseWeek[] = [
  { week: 1, gate: 1, title: "岗位与赛道诊断", enterpriseCapability: "从 JD、产品和数据可得性反推项目方向", studentDeliverable: "目标岗位画像 + 项目候选 3 个", teacherIntervention: "压缩过大选题，要求学生说明真实用户和可接入资料", acceptance: "项目评分 >= 20，且能说清为什么适合自己" },
  { week: 2, gate: 1, title: "AI 产品拆解与项目立项", enterpriseCapability: "Jobs-to-be-Done + 技术能力地图", studentDeliverable: "3 份产品拆解 + 10 份 JD 词频表", teacherIntervention: "现场追问技术路线、商业假设和可复刻切片", acceptance: "赛道声明能对应岗位能力和企业痛点" },
  { week: 3, gate: 2, title: "AI 编程规格驱动", enterpriseCapability: "用 AI 编程工具完成 spec -> code -> test", studentDeliverable: "MVP spec、仓库、提交记录", teacherIntervention: "检查需求是否可验收，要求学生展示 AI 代码审查证据", acceptance: "主流程可运行，有测试/回滚记录" },
  { week: 4, gate: 2, title: "Web Demo 工程化", enterpriseCapability: "API、状态、错误处理、部署说明", studentDeliverable: "可演示 Web Demo + README", teacherIntervention: "聚焦最小可行功能，不允许堆功能掩盖主线", acceptance: "2 分钟演示核心价值，能解释关键技术选择" },
  { week: 5, gate: 3, title: "Prompt 资产化", enterpriseCapability: "模板、变量、schema、版本和评测样例", studentDeliverable: "Prompt 模板库 + 10 条样例", teacherIntervention: "要求输出可解析，不接受只靠肉眼判断", acceptance: "至少 3 次迭代，并有失败样例" },
  { week: 6, gate: 3, title: "结构化输出产品", enterpriseCapability: "context engineering、缓存、成本意识", studentDeliverable: "结构化输出小产品 + 版本记录", teacherIntervention: "检查模板边界、反例和成本变化", acceptance: "Prompt 变化能用评测数据解释" },
  { week: 7, gate: 4, title: "RAG 基础链路", enterpriseCapability: "文档解析、切片、embedding、引用展示", studentDeliverable: "带引用知识库问答 Demo", teacherIntervention: "重点查引用是否可靠，不只看回答是否顺口", acceptance: "回答有来源，资料外问题能拒答" },
  { week: 8, gate: 4, title: "RAG 评测与优化", enterpriseCapability: "混合检索、重排、召回测试集、失败归因", studentDeliverable: "20+ 问题测试集 + 召回报告", teacherIntervention: "按召回错/引用错/生成错拆失败", acceptance: "能证明一次优化前后指标变化" },
  { week: 9, gate: 5, title: "工具调用与 MCP", enterpriseCapability: "工具 schema、鉴权、权限边界、审计日志", studentDeliverable: "MCP server 或工具接口", teacherIntervention: "敏感动作必须有人确认或白名单", acceptance: "工具调用有真实状态变化和错误处理" },
  { week: 10, gate: 5, title: "企业流程自动化", enterpriseCapability: "搜索、文件、表格、数据库、API 的安全接入", studentDeliverable: "工具链业务流程演示", teacherIntervention: "检查越权、参数校验、日志追踪", acceptance: "能解释 MCP 安全风险和防护" },
  { week: 11, gate: 6, title: "Agent 单体系统", enterpriseCapability: "规划、执行、观察、修正、终止条件", studentDeliverable: "3 步以上 Agent 任务", teacherIntervention: "要求展示 agent trace 和失败恢复", acceptance: "有状态、日志、边界，不无限循环" },
  { week: 12, gate: 6, title: "多 Agent/人机协作", enterpriseCapability: "LangGraph 类状态机、HITL、持久执行", studentDeliverable: "Agent 流程图 + 人工确认节点", teacherIntervention: "区分需要 Agent 和不需要 Agent 的场景", acceptance: "能解释框架/手写循环取舍" },
  { week: 13, gate: 7, title: "Evals 与回归", enterpriseCapability: "dataset、grader、trace、自动化回归", studentDeliverable: "50+ 评测集 + 回归脚本", teacherIntervention: "要求每个失败样例可复现、可归因", acceptance: "模型/Prompt 升级前后可比较" },
  { week: 14, gate: 7, title: "LLMOps 与安全上线", enterpriseCapability: "成本、延迟、观测、红队、OWASP LLM 风险", studentDeliverable: "成本表 + 红队报告 + 回滚方案", teacherIntervention: "模拟 prompt injection、敏感信息、过度代理", acceptance: "没有评测和风险清单不得进发射关" },
  { week: 15, gate: 8, title: "作品集与简历包装", enterpriseCapability: "招聘官 10 秒动线、项目证据链、量化表达", studentDeliverable: "GitHub 首页、README、简历项目描述", teacherIntervention: "删掉空话，要求每句简历有仓库证据", acceptance: "作品集可被陌生面试官快速理解" },
  { week: 16, gate: 8, title: "企业招聘式终面", enterpriseCapability: "业务价值、技术决策、失败复盘、下一步路线", studentDeliverable: "终面答辩 + 上岗证据包", teacherIntervention: "按 CTO/面试官/HR/用户四角追问", acceptance: "能经受技术、工程、成本、安全四类追问" },
];

export const PROJECT_SCORE_CRITERIA: ProjectScoreCriterion[] = [
  { key: "realUser", label: "真实用户", question: "谁会真的用它，使用频率和痛点强度如何？" },
  { key: "realData", label: "真实资料", question: "是否有可接入的文档、表格、API 或高仿真数据？" },
  { key: "demo", label: "可演示性", question: "2 分钟内能否展示核心效果和前后对比？" },
  { key: "technicalDepth", label: "技术深度", question: "是否体现 Prompt、RAG、MCP、Agent、Evals 中至少两类能力？" },
  { key: "evalFeasibility", label: "评测可行", question: "能否设计可复现测试集、指标和失败归因？" },
  { key: "jobStory", label: "就业表达", question: "能否写进简历并经得住面试追问？" },
  { key: "riskBoundary", label: "风险边界", question: "是否能说明隐私、权限、成本和误用风险？" },
];

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    id: "education",
    name: "教育学习",
    enterpriseVersion: "课程助教 Agent / 个性化学习诊断系统",
    examples: ["AI 课程资料问答", "错题分析助手", "论文阅读助手"],
    dataSources: ["课程讲义", "题库", "学习记录", "学生提问"],
    stack: ["RAG", "结构化输出", "学习画像", "Evals"],
    evalMetrics: ["引用准确率", "解释可理解度", "错题归因准确率", "拒答率"],
    interviewAngle: "如何避免误导学生，如何评测教学建议质量。",
    tracks: ["undergrad", "master"],
  },
  {
    id: "office",
    name: "办公自动化",
    enterpriseVersion: "企业文档/会议/邮件流程自动化 Agent",
    examples: ["会议纪要助手", "周报生成助手", "合同摘要助手"],
    dataSources: ["会议转写", "企业模板", "历史文档", "审批规则"],
    stack: ["Prompt 资产", "工具调用", "权限控制", "成本追踪"],
    evalMetrics: ["摘要事实一致性", "格式合规率", "人工节省时长", "敏感信息泄露率"],
    interviewAngle: "如何处理隐私、审批和人工确认节点。",
    tracks: ["undergrad", "jobseeker"],
  },
  {
    id: "knowledge-base",
    name: "企业知识库",
    enterpriseVersion: "带权限、引用、可观测的企业 RAG 系统",
    examples: ["制度问答", "客服知识库", "产品手册问答"],
    dataSources: ["制度文档", "FAQ", "客服工单", "产品手册"],
    stack: ["混合检索", "重排", "引用", "红队测试"],
    evalMetrics: ["召回率", "引用准确率", "幻觉率", "权限命中率"],
    interviewAngle: "如何证明 RAG 的答案可信，如何处理资料没有的问题。",
    tracks: ["undergrad", "master", "jobseeker"],
  },
  {
    id: "analytics",
    name: "数据分析",
    enterpriseVersion: "可解释的数据分析 Agent / 报告生成系统",
    examples: ["Excel 数据分析 Agent", "销售数据分析助手", "问卷总结助手"],
    dataSources: ["CSV/Excel", "BI 报表", "CRM 数据", "问卷结果"],
    stack: ["工具调用", "代码执行", "图表生成", "人工复核"],
    evalMetrics: ["计算正确率", "图表可读性", "洞察可执行性", "SQL/代码安全"],
    interviewAngle: "如何防止错误计算被包装成正确结论。",
    tracks: ["undergrad", "master", "jobseeker"],
  },
  {
    id: "research",
    name: "科研辅助",
    enterpriseVersion: "文献综述与研究问题生成工作流",
    examples: ["论文摘要与综述", "文献分类", "实验记录整理"],
    dataSources: ["论文 PDF", "实验日志", "开源数据集", "引用网络"],
    stack: ["多文档 RAG", "引用追踪", "评测实验", "研究报告"],
    evalMetrics: ["引用覆盖率", "综述结构质量", "研究问题新颖度", "人工一致性"],
    interviewAngle: "如何区分工具生成和研究贡献，如何做实验验证。",
    tracks: ["master"],
  },
  {
    id: "career",
    name: "求职训练",
    enterpriseVersion: "岗位匹配与模拟面试 Agent",
    examples: ["JD 分析助手", "模拟面试 Agent", "作品集优化助手"],
    dataSources: ["JD", "简历", "GitHub README", "面试题库"],
    stack: ["Agent", "评分 rubric", "多轮追问", "证据包生成"],
    evalMetrics: ["岗位匹配度", "回答完整度", "证据引用率", "追问通过率"],
    interviewAngle: "如何用项目证据证明岗位能力，而不是背答案。",
    tracks: ["jobseeker", "undergrad", "master"],
  },
];

export const EVIDENCE_REQUIREMENTS: EvidenceRequirement[] = [
  { key: "readme", label: "README", gate: 0, requiredFor: ["undergrad", "master", "jobseeker"], description: "包含业务问题、架构图、启动方式、演示路径、关键取舍。" },
  { key: "demo", label: "Demo", gate: 0, requiredFor: ["undergrad", "master", "jobseeker"], description: "截图、视频或线上地址，能在 2 分钟内展示核心价值。" },
  { key: "evals", label: "evals/", gate: 0, requiredFor: ["undergrad", "master", "jobseeker"], description: "测试集、评分脚本、失败样例和改进记录。" },
  { key: "cost", label: "COST.md", gate: 0, requiredFor: ["undergrad", "master", "jobseeker"], description: "记录模型、token、延迟、单次成本和降本策略。" },
  { key: "postmortem", label: "POSTMORTEM.md", gate: 0, requiredFor: ["undergrad", "master", "jobseeker"], description: "记录失败原因、修复过程、未解决风险和下一步。" },
  { key: "resume", label: "简历句", gate: 8, requiredFor: ["undergrad", "master", "jobseeker"], description: "每句简历都能对应仓库证据和量化指标。" },
  { key: "interview", label: "面试讲解稿", gate: 8, requiredFor: ["undergrad", "master", "jobseeker"], description: "覆盖业务价值、技术路线、评测、安全、失败复盘。" },
  { key: "tech-report", label: "硕士技术报告", gate: 0, requiredFor: ["master"], description: "技术路线对比、系统架构、实验设计、指标、结果和研究价值。" },
  { key: "research-question", label: "研究问题", gate: 8, requiredFor: ["master"], description: "从项目失败或评测差距中提炼可继续研究的问题。" },
];

export const TEACHER_PROMPTS: TeacherPrompt[] = [
  { id: "lesson", title: "生成本周教案", audience: "教师", output: "120 分钟课堂流程", prompt: "我是教师。请基于第【周次】周主题，为本科/硕士混合班设计一节 120 分钟企业上岗实战课，基础概念不超过 10 分钟，其余时间用于案例演示、学生实操、项目诊断和就业表达训练。输出：目标、流程、教师演示、学生任务、验收标准、追问题。" },
  { id: "diagnose", title: "诊断学生项目", audience: "教师", output: "项目诊断报告", prompt: "我是教师。以下是学生项目说明，请按企业上岗标准评估：场景价值、技术路线、Demo 可行性、评测安全、成本控制、简历表达，并给出最小可行修改建议。" },
  { id: "interview", title: "生成面试追问", audience: "教师/求职", output: "四类面试题", prompt: "请基于学生项目生成 AI 应用开发岗位面试训练题，覆盖项目介绍、技术追问、工程上线、安全治理，并给出优秀回答要点。" },
  { id: "rubric", title: "生成评分 rubric", audience: "教师", output: "量化评分表", prompt: "请把当前关卡任务转成 100 分评分 rubric，要求包含业务价值、工程实现、评测证据、安全风险、表达质量五个维度。" },
  { id: "master", title: "生成硕士研究任务", audience: "硕士", output: "研究型任务书", prompt: "请把当前项目升级为硕士研究型任务，输出研究问题、技术路线、基线对比、评测指标、实验设计、失败案例分析和技术报告结构。" },
];

export function scoreProject(values: Record<string, number>) {
  const total = PROJECT_SCORE_CRITERIA.reduce((sum, item) => sum + Math.max(0, Math.min(5, Number(values[item.key] || 0))), 0);
  const max = PROJECT_SCORE_CRITERIA.length * 5;
  const verdict = total >= 28 ? "适合作为企业上岗级主项目" : total >= 22 ? "可做，但需要缩小范围或增强评测" : "不建议作为主项目，建议重选或重构场景";
  return { total, max, verdict };
}
