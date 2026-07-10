# Evals · 评审模块回归评测(v0 基线)

## 评测对象

`/api/review` 的评审 prompt:给定同样的证据包,打分是否稳定、是否会被表面材料糊弄。

## 样本集

`review_eval_cases.json` — 10 条锚定样本(目标 20 条,持续补充),每条含:

- `evidence`:构造的证据包摘要(有/无四件套、README 质量分层)
- `expect_passed`:期望判定
- `expect_score_range`:期望分数区间

覆盖:完整四件套高质量 / 四件套齐但内容空洞 / 缺 evals / 缺 COST / 只有 README /
热门但无关仓库(星数诱导)/ 空仓库 / README 吹牛无佐证 / 私仓抓取失败 / 非 GitHub 链接。

## 运行

```bash
cd webapp && npx tsx ../evals/run_review_eval.ts   # (脚本建设中,当前手动跑样本)
```

## 版本记录(prompt 回归)

| 版本 | 变更 | 通过样本 | 备注 |
|---|---|---|---|
| v0 | 当前线上 prompt(rubric+打分铁律) | 8/10(人工核) | 星数诱导样本、空仓样本判定正确;"README吹牛"样本偏宽 |

> 诚实声明:v0 为人工核对基线,自动化 runner 尚未完成——这是当前最大缺口,也是第 7 关 Evals 上线关要补齐的作业。
