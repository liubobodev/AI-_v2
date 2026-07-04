> 最近校准日期:2026-07-04

# 高阶讲解 · 2026 年共识 Agent 架构:Orchestrator-Worker + 反思 + 分层记忆

## 定位

自学阶段学的是"Agent 能规划、执行、反馈"这个抽象概念。这段要讲清楚:2026 年业界已经沉淀出一套相对稳定的"共识架构组合",不是自己从零发明,而是知道该在什么条件下组合哪几块。

## 一、Orchestrator-Worker(编排者-工作者)——目前最主流的多 Agent 结构

一个中心"管理者"Agent 分解高层意图,把子任务路由给专职的"工作者"Agent,再汇总结果——这个模式高度可扩展,管理者可以根据实时数据决定调用哪个专家。

**两种实现复杂度,教学要求学生先掌握简单版**:
- **简单版(推荐先学)**:管理者通过标准工具调用来协调工作者——每个工作者就是一个有专属工具和提示词的独立 Agent 实例,管理者把子任务当"调用一个工具"来分派,结果通过普通的工具返回机制传回,**不需要特殊的 Agent 间协议**,调试时 stack trace 能看到完整调用链,这是最容易 debug 的形态;
- **复杂版**:用状态图框架(如 LangGraph)显式建模节点(Agent 动作)和边(路由逻辑),适合动态任务路由本身就有价值判断含量的场景。

**关键判断力(面试常考)**:多 Agent 不是越多越好——**只有当任务量超出单一角色、单一上下文窗口或单一服务边界时,才加 Multi-Agent;只有输出校验会失败时,才加反思;只有出现多步依赖时,才加规划**。额外的循环、交接、角色会先增加协调成本,再谈收益提升。

## 二、反思模式(Reflection)——现在是标配可靠性层,不是加分项

Agent 在交付最终结果前先自我评审、修正——生成、评审、迭代来弥补差距,而不是把第一次的答案当最终答案,常用于提升事实准确性、降低幻觉,尤其是面向用户的输出。

**具体实现**:一个 Agent 生成,另一个 Agent 按预定标准评估——比如"审查者"Agent 检查代码的安全漏洞,"事实核查"Agent 验证研究数据——生成者和评估者的角色要显式分离,不能自己既当运动员又当裁判。

## 三、分层记忆架构

2026 年的记忆设计普遍分层:短期记忆(当前对话)、长期记忆(跨会话持久化)、实体记忆(特定对象的历史)、外部记忆(检索式知识库)组合成"情境记忆",让 Agent 不需要显式消息传递也能保持连贯——这和第 3 关的 Anthropic `memory` 工具(读写 `/memories` 目录)是同一套思想的两种实现层级。

## 四、Anthropic 官方六种执行拓扑(和上面的框架互补,建议对照讲)

《Building Effective Agents》给出的分类:prompt chaining(提示链)、routing(路由)、parallelization(并行化)、orchestrator-workers(编排者-工作者)、evaluator-optimizer(评估者-优化者,即反思模式的另一种叫法)、autonomous agents(自主智能体)。**教学价值**:让学生先判断自己的场景该用哪种拓扑,而不是不假思索地直接上"自主智能体"这个最复杂的形态。

## 五、性能信号(可以讲给学生提振信心,也是面试可以引用的数据)

多 Agent 编排配合并行工作者,在内部评测中比单 Agent 的表现提升了 90.2%——但这类收益是有条件的(任务足够复杂、可并行),不是无脑上多 Agent 就能获得。

## 六、常见误区

1. **为了"看起来高级"而堆砌 Agent 数量**——违反第一条判断力原则,增加协调成本却没有匹配的收益;
2. **反思和生成用同一个上下文/同一次调用**——评估者应该是独立的评审,不能自己审自己;
3. **记忆设计只有一层**——短期记忆塞太满导致遗忘(参见第 3 关"上下文工程"),或者完全没有跨会话记忆导致每次从零开始。

## 七、来源锚点

- [Multi-Agent AI Orchestration Guide & 2026 Updates](https://www.codebridge.tech/articles/mastering-multi-agent-orchestration-coordination-is-the-new-scale-frontier)
- [What Are Agentic Design Patterns? 2026 Pattern Catalog · Augment Code](https://www.augmentcode.com/guides/agentic-design-patterns)
- [AI Agent Architecture Patterns: Single & Multi-Agent Systems · Redis](https://redis.io/blog/ai-agent-architecture-patterns/)

## 八、本关实战钩子(直接改验收 rubric)

- 学生的 Agent 系统必须在架构图里明确标出:用了六种执行拓扑里的哪一种(或哪几种组合),并说明为什么这个场景需要这个拓扑而不是更简单的方案;
- 如果用了反思模式,必须证明"生成者"和"评估者"是分离的(哪怕是同一个模型的两次独立调用,也要展示 prompt 差异);
- 硕士生加做(多 Agent 协作,课程要求硕士必做):量化"单 Agent vs 多 Agent"在自己场景下的实际收益/成本比,不能只讲故事不给数据。

## 九、深挖资源(选修)

- Anthropic《Building Effective Agents》原文;
- Google Agent Development Kit 的八种工作流模式;LangChain 多 Agent 指南的四种协调模式(supervisor/hierarchical/network/handoff)——可以让学生对照自己的系统属于哪一种,训练分类能力。
