> 最近校准日期:2026-07-04

# 高阶讲解 · 上下文工程(Context Engineering)——提示词工程的下一站

## 定位

自学阶段学的是"怎么写一个结构化 Prompt、怎么做模板"。这段要讲清楚:**2026 年业界已经不再单独谈"提示词工程",而是谈"上下文工程"**——因为 Agent 是循环运行的,每一步动作都在消耗和污染上下文窗口,窗口一满,模型就开始遗忘指令、犯错、原地打转。写好一条 Prompt 只是上下文工程里最小的一环。

## 一、核心定义与心智转变

Anthropic 官方给出的定义:上下文是"采样时喂给模型的全部 token 集合",上下文工程就是"在 LLM 推理的固有约束下,优化这些 token 的效用,以稳定达成目标结果的技术"。

**关键心智转变**:聊天机器人一轮问答塞得下就行;Agent 是在循环里跑,拿着前几十步操作留下的"残渣"做决策——上下文管理不是锦上添花,是 Agent 能不能跑完整个任务的生死线。

## 二、四大策略框架(Write / Select / Compress / Isolate)

业界广泛引用的框架把上下文工程拆成四类动作,每类应对不同的失效模式:

| 策略 | 做什么 | 对应技术 |
|---|---|---|
| **Write(写入)** | 把重要信息主动写下来,不指望模型"记住" | 结构化输出、文件化 scratchpad、`memory` 工具持久化到 `/memories` 目录 |
| **Select(挑选)** | 每一步只把真正需要的信息拉进上下文,而不是全塞进去 | RAG 检索、工具搜索(Tool Search,先搜后加载 schema)、按需读文件而非全量贴入 |
| **Compress(压缩)** | 上下文快满时主动精简,而不是硬撑到崩 | Compaction(服务端自动摘要旧对话)、Context Editing(清理过期的工具结果/思考块) |
| **Isolate(隔离)** | 把不同职责的上下文分开,互不污染 | 子代理(Subagent)各自独立上下文窗口、Programmatic Tool Calling(中间结果留在代码执行环境,不进主上下文) |

**教学落地**:让学生给自己第 3 关的产品画一张"这个应用每一步在往上下文里塞什么、什么时候该清空"的时序图——这张图比任何 Prompt 模板都更能体现"懂不懂上下文工程"。

## 三、Anthropic 2026 年的具体机制(可直接在 API 里用)

- **自适应思考(Adaptive Thinking)+ effort 参数**:不再靠人工设定"思考 token 预算",而是让模型自己判断要想多久,再用 `effort: low/medium/high/xhigh/max` 控制深度与成本的整体取舍——这是 2026 年"提示词工程"里最容易被学生忽略但招聘方一定会问的参数;
- **Prompt Caching(提示词缓存)**:缓存本质是"前缀匹配",系统提示词、工具定义要放在最前面且保持字节级不变,任何微小改动(时间戳、UUID)都会让缓存全部失效——这是一条常被面试问到的"隐形成本坑";
- **Context Editing / Compaction**:前者是"清理"(删掉过期工具结果和思考块),后者是"摘要"(服务端自动总结旧对话),两者概念不同、不能混用;
- **中途系统消息(Mid-conversation system message)**:不再需要为了插入一条运营指令就重写整个 system prompt(那样会让缓存全部作废),可以在对话中途追加一条 `role: system` 消息,既保留缓存又带有"运营权威"语义。

## 四、常见误区(学生最容易踩的坑)

1. **把"写更长的 Prompt"当成"上下文工程"**——恰恰相反,四大策略里三个(Select/Compress/Isolate)都是在做减法;
2. **指令细节和模型默认工具使用习惯冲突**——最常见的失败不是指令太短,而是详细指令和模型训练时形成的默认行为矛盾,导致每一轮都出现困惑行为;
3. **只会调 temperature 而不知道 2026 年新一代模型(Opus 4.7/4.8、Sonnet 5)已经移除了 temperature/top_p,改用自适应思考+effort 来控制生成质量。**

## 五、来源锚点

- [Effective context engineering for AI agents · Anthropic 官方工程博客](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Engineering: A Practical Guide for AI Agents · Sourcegraph](https://sourcegraph.com/blog/context-engineering)
- [Context Engineering AI: How To Build Smarter LLM Agents · Mem0](https://mem0.ai/blog/context-engineering-ai-agents-guide)

## 六、本关实战钩子(直接改验收 rubric)

- 学生的 Prompt 资产必须体现"Write/Select/Compress"至少两种策略的具体实现,而不是一份纯文本模板;
- 20 条土法评测里,至少 3 条要专门测试"上下文快满时模型是否还记得关键约束"(可以人为塞长上下文制造压力测试);
- 硕士生加做:实测同一任务在开/关 Prompt Caching 下的延迟和成本差异,写进复盘。

## 七、深挖资源(选修)

- Anthropic《Building Effective Agents》—— 六种执行拓扑(prompt chaining/routing/parallelization/orchestrator-workers/evaluator-optimizer/autonomous agents),第 6 关会再用到;
- Agentic Context Engineering(ACE)论文方向——上下文像"活的playbook"根据模型表现自我更新,硕士生可作为课程论文选题。
