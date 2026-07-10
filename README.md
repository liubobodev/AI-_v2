# AI 上岗实战训练营智能体 v2

> 把学生从"会用 AI"训练成"能开发 AI 应用、能拿出 GitHub 证据、能通过 AI 岗位面试"的人。
> 本仓库同时是教研体系(Obsidian 库)与可运行的教练系统(webapp)。

## 架构

```
Obsidian 教研库(00-13 目录:八关任务卡/高阶知识讲解/能力体系/企业场景)
        │  构建脚本解析(webapp/scripts/build-kb.ts, build-gates.ts)
        ▼
webapp/ Next.js 教练系统
  ├─ 关卡作战室(任务简报/高阶知识/验收自检/证据包/档案)
  ├─ AI 自检质检(/api/selfcheck:学生逐条写完成证明→LLM 按 rubric 打分)
  ├─ GitHub 证据评审(/api/review:服务端抓取仓库文件树+四件套→LLM 逐条评分)
  ├─ 教练对话(/api/chat:关卡感知知识库注入,多模型可切换)
  └─ 游戏化(XP/段位/成就/评级灯/勋章庆祝)
```

## Prompt 资产(本项目的提示词工程实践)

- 教练系统提示词:`01_智能体设定/实战总教练_系统提示词.md`(git 版本化,历史 ≥4 个演进版本)
- 评审打分 prompt:`webapp/app/api/review/route.ts`(模板+变量插值,强制 JSON 输出)
- 自检质检 prompt:`webapp/app/api/selfcheck/route.ts`
- 结构化输出:服务端 extractJson 解析,解析失败拒绝(注:尚未接正式 JSON Schema 校验器,见 POSTMORTEM)

## 评测

见 [evals/](evals/) —— prompt 回归评测样本与运行说明(建设中,当前为 v0 基线)。

## 运行

```bash
cd webapp && npm install && npm run dev   # http://localhost:3000
```

密钥配置见 `webapp/.env.local`(不入库);成本核算见 [COST.md](COST.md);踩坑复盘见 [POSTMORTEM.md](POSTMORTEM.md)。
