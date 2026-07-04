# 第 5 关 · 工具与 MCP 关(W9–10)【v2 重构】

## 目标
从"会 function calling"升级到"**会造 MCP server**"——让任意 AI 客户端能操作你的真实系统。MCP 已是 2026 年 JD 标配词。

## JD 原文对标
> "实现 MCP servers/clients,跨数据库、SaaS 平台与内部服务编排 API 调用"——2026 年 Agent 工程师 JD;"没有扎实的工具集成,Agent 只是聊天机器人"

## 技术栈
MCP 官方 SDK(Python/TS)、function calling 基础、你的 Obsidian 库(推荐标的)。

## 任务
**推荐路线(创新点):把你的 Obsidian 求职作战室做成 MCP server**
1. 热身:用 function calling 让模型调用 2 个本地函数(查天气/算数),看懂"模型只输出意图,执行在你手里"
2. 用 MCP SDK 实现 server,暴露 3 个工具:`search_notes`(搜作战室笔记)、`add_interview_question`(往错题库写入)、`get_progress`(读关卡进度)
3. 接入 Claude Desktop / Claude Code 实测:对话中让 AI 直接读写你的库
4. **安全加固**:路径穿越防护(禁止访问库外文件)、写操作白名单、危险操作需确认
5. 备选标的:接学校教务数据(自爬)、接小组项目数据库——必须是**真实系统**

## 验收 rubric
- [ ] MCP server 可被至少 1 个真实客户端(Claude Desktop/Code)连接使用
- [ ] 3 个工具各有清晰 description(考:工具描述质量决定模型会不会用)
- [ ] 现场演示一次提示注入攻击被你的白名单/确认机制拦下
- [ ] README 含架构图 + 安装步骤,同学能 10 分钟跑起来

## 简历句模板
> 设计并实现 MCP server(X 个工具,接入真实 XX 系统),含路径防护与操作白名单,已被 Claude Desktop/Code 实际调用

## 面试追问预演
- MCP 和直接 function calling 比,解决了什么问题?(考:M×N→M+N,生态复用)
- AI 通过你的工具删库怎么办?(考:最小权限、确认机制、审计日志)

## 双工具用法
- **Obsidian**:你的库既是开发标的又是文档仓库——**这关做完,你的作战室就是一个能被 AI 操作的活系统,Demo 本身就是面试爆点**
- **NotebookLM**:上传 MCP 规范文档 → Debate 模式生成"MCP 是不是过度设计"正反辩论,听完你才真的懂它
