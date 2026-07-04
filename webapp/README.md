# AI 上岗实战总教练 · Web 界面

这是训练营智能体的可用界面版本——不是静态 Prompt，是一个真的能对话、支持 **14 家模型自由切换** 的 Web App。

## 支持的模型

| 分类 | 厂商 | 模型 |
|---|---|---|
| 国内 | DeepSeek | V3、R1 |
| | 智谱 GLM | GLM-4-Flash（免费）、Plus、Air |
| | Kimi（月之暗面）| v1-8K、v1-32K、v1-128K |
| | 通义千问 | Turbo、Plus、Max |
| | MiniMax | abab6.5s、M1 |
| | 豆包（火山引擎）| Pro 32K、Lite 32K |
| | 文心一言 | ERNIE 4.0 Turbo、3.5、Speed（免费）|
| | MiMo | MiMo-Chat |
| | 腾讯混元 | Lite（免费）、Pro、Turbo |
| | LongCat | LongCat-Chat |
| 国际 | OpenAI | GPT-4.1、GPT-4.1 Mini、GPT-4o、GPT-4o Mini |
| | Anthropic Claude | Sonnet 4、3.5 Sonnet、3 Opus（通过 OpenRouter）|
| | Google Gemini | 2.5 Flash、2.5 Pro、2.0 Flash |
| | Meta Llama | Llama 4 Maverick / Scout（通过 Groq）|

## 它做了什么

- 服务端按关卡懒加载知识库（token 消耗降低 60-70%）；
- 前端聊天界面：左侧「八关进度」点哪一关就自动带出该关重点，「快捷口令」一键触发固定动作；
- 首次访问弹出 3 步引导：选身份 → 选关卡 → 开始训练；
- 聊天记录与关卡进度自动保存到 localStorage，刷新不丢失；
- 模型选择器在侧边栏，切换即时生效，偏好自动保存；
- API Key 只存浏览器 localStorage，不落盘、不上传第三方。

## 本地运行

```bash
cd webapp
npm install
npm run dev
```

打开 http://localhost:3000，在侧边栏选模型，点「API Key」填入对应厂商的 key，即可开始对话。

也可在 `webapp/.env.local` 配置默认 key：
```
DEEPSEEK_API_KEY=sk-xxx
# 或用通用环境变量（非 DeepSeek 厂商时回退至此）
LLM_API_KEY=sk-xxx
```

## 知识库更新怎么生效

`12_高阶知识讲解`、任务卡等文件每次改动后，**重启一次 `npm run dev`** 即可。
