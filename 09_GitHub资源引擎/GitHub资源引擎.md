# GitHub 资源引擎 · 五重角色

> 为什么这是 v2 的心脏:2026 校招信号——美团"GitHub 高星项目直接进二面";字节"场景化编程题";
> 海外调研结论:"一个带 eval 记录、成本看板和复盘报告的干净 repo,胜过一切花哨 side project"。
> GitHub 不是"资料网站",它同时是教材、训练场、考场和简历。

## 角色一:资源雷达(不断更新的活水)

**机制**:每周一跑 `weekly_radar.sh`(本目录),自动抓取:
- 本周 AI 方向 trending 仓库(按 star 增速);
- 锚点仓库的新增内容(watch releases / commits);
- 输出 `雷达周报_YYYY-MM-DD.md` 存入 Obsidian → 上传 NotebookLM 生成 10 分钟"本周 AI 情报播客"。

**锚点仓库清单**(2026-07 核验,全部活跃):

| 层 | 仓库 | 用途 |
|---|---|---|
| 学习 | microsoft/generative-ai-for-beginners · microsoft/ai-agents-for-beginners | 系统课,课前自学指定材料 |
| 学习(中文) | datawhalechina/self-llm · datawhalechina/llm-universe | 中文开源课,降低门槛 |
| 案例库 | **Shubhamsaboo/awesome-llm-apps**(11.6万★,周更) | 数百个可跑的 Agent/RAG 应用,**八关解剖材料主库** |
| 案例库 | e2b-dev/awesome-ai-agents | Agent 产品与开源项目全景 |
| MCP | modelcontextprotocol/servers · punkpeye/awesome-mcp-servers(9万★) · github/github-mcp-server | 第 5 关主战场 |
| 官方实战 | anthropics/anthropic-cookbook · openai/openai-cookbook · anthropics/courses | 一手 API 范式,防过时 |
| 评测/观测 | promptfoo/promptfoo · confident-ai/deepeval · langfuse/langfuse | 第 7 关 Evals 工具链 |
| 可部署平台(国内) | langgenius/dify · infiniflow/ragflow · labring/FastGPT | 企业真实在用,面试常问 |
| 多智能体 | FoundationAgents/MetaGPT · microsoft/autogen | 第 6 关参考架构 |
| 求职 | 0voice/2026-Computer-Spring-Recruitment-Job-Compilation | 岗位+面经日更合集 |

> 教师不用记这张表——教练智能体接了 gh 之后,说"给我本周雷达"即可。

## 角色二:训练场(先解剖,再创造)

每关固定动作 **"仓库解剖"**(替代"听老师讲"):
1. fork + clone 本关对标仓库(各关卡任务卡里已指定);
2. 30 分钟内跑通 demo(跑不通 = 第一个真实工程问题,恰好是教学内容);
3. 用 AI 编程工具(Claude Code / Cursor)向仓库提问:"这个项目的核心链路是哪三个文件?";
4. 改造:换成中文场景 / 换模型 / 加一个功能——**改造差异就是学生的第一个 commit**;
5. 在作战室写《解剖报告》:架构图 + 我改了什么 + 为什么。

## 角色三:作品集(简历的本体)

- **一关一仓**:8 关 = 8 个 repo,期末精选 4 个 pin 到 profile;
- 每个 repo 硬性四件套:`README(带架构图+demo动图)` / `evals/(测试集+跑分记录)` / `COST.md(token成本核算)` / `POSTMORTEM.md(踩坑复盘)`——这四件正是招聘方说"能看出真做过"的证据;
- Profile README 用第 2 关的 AI 编程工作流生成,绿墙靠每周 commit 自然形成。

## 角色四:开源履历(差异化加分)

阶梯参与,量力而行:
1. 给用过的仓库提高质量 issue(复现步骤完整);
2. 中文文档翻译 / 纠错 PR(低门槛高可见);
3. 给 awesome-mcp-servers 提交自己第 5 关写的 MCP server(**收录 = 简历高光**);
4. 硕士:复现论文并给官方仓库补充实验结果。

## 角色五:智能体的活水接口

教练智能体通过 **gh CLI 或 GitHub MCP server** 获得实时能力:

| 教师/学生说 | 智能体执行 |
|---|---|
| "本周雷达" | `gh search repos --sort stars --created ">上周"` + 锚点仓库 release 摘要 |
| "帮我选解剖仓库" | 按关卡主题搜索→按 star/活跃度/代码量筛选→给出 3 选 1 理由 |
| "检查我的仓库" | 拉学生 repo 的 README/结构/commit 史,对照四件套 rubric 打分 |
| "我和标杆差在哪" | diff 学生项目与对标仓库的架构差异,列改进清单 |
| "找 3 个 good first issue" | 按学生技术栈搜索可上手的开源任务 |

> 配置方法:Claude Code 内置 gh;其他平台接 github/github-mcp-server(官方,3.1万★)。
