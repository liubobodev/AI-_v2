> 最近校准日期:2026-07-04

# 高阶讲解 · RAG 不是一种技术,是一个光谱

## 定位

自学阶段学的是"切片→向量化→建库→检索→生成"这条最朴素的链路。这段要讲清楚:**2026 年生产级 RAG 系统的共识是"用自适应路由匹配查询复杂度和管线复杂度"**——简单问题用最简单的管线,复杂多跳问题才上重装备。教朴素 RAG 就让学生毕业,等于把他们直接送进"能跑不能用"的坑。

## 一、生产配方(先学会这个,再谈花活)

业界公认的起点配方:**混合检索(稠密向量 + BM25 稀疏检索)+ 重排(Reranker)**,用 RAGAS 一类框架量化检索质量,只有在指标证明"简单方案不够用"时,才加查询改写、agentic 循环、知识图谱这些复杂度。

**重排为什么必须做**:双编码器(bi-encoder)向量检索本质上是"有损压缩"——把一整段复杂文本压缩成高维空间里的一个点;交叉编码器(cross-encoder)重排能纠正这种损失。典型流程是"混合检索召回 top-50 → 重排收窄到 top-5 再喂给 LLM",这一步能让 RAGAS 指标提升 15%–30%。

## 二、进阶技术谱系(按复杂度排列,不是越复杂越好)

| 层级 | 技术 | 适用场景 | 代价 |
|---|---|---|---|
| 基础 | 混合检索 + 重排 | 90% 的企业场景够用 | 低 |
| 中级 | 查询改写/分解、语义分块(区别于固定长度切片)、Contextual Retrieval(检索前给每个 chunk 补充文档级上下文) | 检索质量不达标时再加 | 中 |
| 高级 | **GraphRAG**(抽取实体关系建知识图谱,用图遍历检索,支持多跳推理);变体 RAPTOR(层级摘要树)、LightRAG、HippoRAG | 需要多跳推理、关系密集的领域知识(法律/供应链) | 高(索引成本高,LazyGraphRAG 已把索引成本降到全量 GraphRAG 的 0.1%) |
| 最高级 | **Agentic RAG**:模型自主判断检索策略、多轮迭代检索、ReAct 式"行动→观察→推理"循环 | 只对真正需要多步推理的困难查询划算;简单事实性查询上 agentic RAG 纯属浪费 | 最高(token 消耗大) |

**关键判断力(面试常考)**:不是"哪个技术最强",是"这个场景该站在光谱的哪一档"——用简单查询上 agentic RAG 是反面教材,用复杂多跳查询硬套朴素 RAG 也是反面教材。

## 三、评测是硬通货(和第 7 关联动)

RAGAS 四个核心指标,学生必须能脱口而出并且知道怎么测:
- **Faithfulness(忠实度)**:答案是否忠于检索到的内容,有没有编造;
- **Answer Relevancy(答案相关性)**:答案是否切题;
- **Context Precision(检索精确率)**:召回的文档是否真的相关;
- **Context Recall(检索召回率)**:该召回的相关文档有没有漏掉。

## 四、常见误区

1. **只做切片建库就上线**——没有重排环节,召回质量天花板很低;
2. **不分场景滥用 agentic RAG**——多跳循环会显著拉高延迟和 token 成本,简单问题会被"过度工程化";
3. **知识冲突处理靠运气**(参见 `10_企业场景案例库/企业落地十大难题` 难题②)——生产系统必须给文档打版本/时效标签,检索时按权重过滤,冲突时显式提示用户"存在两个版本"。

## 五、来源锚点

- [RAG Techniques Compared: A Practical Guide to RAG in 2026](https://blog.starmorph.com/blog/rag-techniques-compared-best-practices-guide)
- [Next-Generation Agentic RAG with LangGraph (2026 Edition)](https://medium.com/@vinodkrane/next-generation-agentic-rag-with-langgraph-2026-edition-d1c4c068d2b8)
- [All you need to know about RAG (in 2026) · AI with Aish](https://aishwaryasrinivasan.substack.com/p/all-you-need-to-know-about-rag-in)

## 六、本关实战钩子(直接改验收 rubric)

- 硬性要求:检索管线必须包含重排环节,不能只有向量相似度排序;
- 测试集(≥50 条)必须覆盖"简单事实题"和"多跳推理题"两类,并在报告里说明当前管线在两类题上的表现差异——这就是在教学生自己判断"我在光谱的哪一档";
- 硕士生加做:实现一个最小 GraphRAG 或 Agentic RAG 分支,和基础管线做 A/B 对比,量化多花的 token/延迟换来多少准确率提升。

## 七、深挖资源(选修)

- Microsoft GraphRAG 原始论文与 LazyGraphRAG 优化;RAPTOR / LightRAG / HippoRAG 三个变体仓库;
- infiniflow/ragflow、langgenius/dify(见 `09_GitHub资源引擎`)——直接读它们的检索管线源码,对照本文档的技术谱系定位每个平台在哪一档。
