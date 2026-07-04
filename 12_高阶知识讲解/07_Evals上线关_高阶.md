> 最近校准日期:2026-07-04

# 高阶讲解 · LLM Judge 怎么校准才可信(Hamel Husain/Shreya Shankar 方法论)

## 定位

自学阶段学的是"写个评测集、跑个 LLM judge"。这段要讲清楚 2026 年 evals 领域最有影响力的实践者(Hamel Husain、Shreya Shankar、Eugene Yan)反复强调的一件事:**"过程比工具重要"**——评测这件事的本质是科学方法(提出假设、设计实验、验证),不是"装个评测框架就完事"。这也是为什么本训练营把 Evals 定为"第一硬通货"——它是区分"真做过项目"和"只是跑通了 demo"的最强单一信号。

## 一、先用便宜的检查,别一上来就上 LLM Judge

**优先级顺序**:先用便宜的基于代码的检查——正则匹配、结构校验、执行测试——只有真正无法用简单规则捕捉的主观质量,才留给复杂的 LLM 评估。这是最容易被学生跳过的一步:很多能用规则判断对错的地方(格式对不对、字段全不全、SQL 能不能跑通),完全不需要动用 LLM Judge。

## 二、不要用 1–5 分的 Likert 量表

**这是 Hamel Husain 反复强调的常见错误**:用未经校准的 1–5 分量表打分,分数之间的差异含义不清楚,不同评估者的理解也不一样。**推荐做法:用二元的通过/不通过判断代替李克特量表**——部分原因是"通过/不通过"比连续量表更难被啰嗦的输出"刷分"(verbosity bias,模型倾向给更长的回答打高分)。

## 三、"批评影子"(Critique Shadowing)技术

先找到组织里 1–2 个"判断力至关重要"的关键人——具备深厚领域专业知识、或代表目标用户的人("首席领域专家"),让他们尽早介入评测标准的制定。**教学落地**:每个场景小组要在《场景选题矩阵》里找到一个"真实用户"角色(哪怕是同学扮演),让这个角色的判断作为评测标准的锚点,而不是自己觉得"看起来还行"。

## 四、错误分析驱动,而不是随机抽查

把模糊的失败转化为具体的、可复现的案例并找到根因;建好日志/可观测性让你能看到 Agent 实际做了什么,然后用一套可重复的方法读取 trace、把失败模式分组排优先级——**取代随意的随机抽查**。这是评测工程和"临时看看输出对不对"的本质区别。

## 五、LLM Judge 和人工评分的对齐校准

要明确把 LLM judge 和人类评分做对齐验证——通过对比模型输出并计算自动评分者和人工评分者之间的一致率——不能假设 LLM judge 天然可信。要注意的已知偏差:
- **位置偏差、知识偏差、格式偏差**:judge 会因为答案的呈现顺序、格式而偏袒;
- **自恋偏差(agreeableness bias)**:模型倾向于给自己或同系模型的输出打更高分——如果用 GPT 系模型当 judge 评测 GPT 系生成的答案,这个偏差要显式警惕;
- **啰嗦偏差**:更长的回答容易被判定"更好"——缓解方法是在评分标准里显式加入"简洁性"维度,并对长度做归一化。

## 六、常见误区

1. **评测集只测"能不能跑",不测"跑得对不对"**——这是把"通过 smoke test"误当成"通过评测";
2. **LLM Judge 从来没和人工标注对比过一致率**——意味着这个 judge 可能完全不可信,却被当作真理来用;
3. **评测集没有覆盖"应该拒答"的案例**——参见《企业落地十大难题》难题⑥,拒答率本身就是要测的指标。

## 七、来源锚点

- [Using LLM-as-a-Judge For Evaluation: A Complete Guide · Hamel Husain](https://hamel.dev/blog/posts/llm-judge/index.html)
- [LLM Evals: Everything You Need to Know · Hamel's Blog](https://hamel.dev/blog/posts/evals-faq/)
- [LLM-as-a-Judge in 2026: Top evaluation techniques · DeepEval](https://deepeval.com/blog/llm-as-a-judge)
- [awesome-evals(benchflow-ai)—— evals 领域精选资源合集](https://github.com/benchflow-ai/awesome-evals)

## 八、本关实战钩子(直接改验收 rubric)

- 评测集(≥50条)必须先标注"哪些用代码规则判断、哪些必须用 LLM judge",不能全部丢给 LLM judge;
- 用了 LLM judge 的部分,必须抽样做人工复核并报告一致率(哪怕只有20条抽样),没有一致率数据的 LLM judge 结果不算合格评测;
- 打分标准必须是二元通过/不通过或有明确锚点示例的量表,不能是裸的"1-5分,你觉得打几分";
- 硕士生加做:专门设计一组"啰嗦偏差"探针(同一质量内容,一个精简一个啰嗦),验证自己的 judge 是否存在长度偏见。

## 九、深挖资源(选修)

- Hamel Husain & Shreya Shankar 的 Maven 课程 FAQ 全文;
- promptfoo/promptfoo、confident-ai/deepeval(见 `09_GitHub资源引擎`)——直接读这两个工具怎么实现"人工校准集"和"一致率计算"。
