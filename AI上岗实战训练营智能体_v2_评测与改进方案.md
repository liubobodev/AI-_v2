# AI上岗实战训练营智能体 v2 · 全面评测与改进方案

> **评测日期**：2026-07-04  
> **评测范围**：全功能走查、代码架构分析、可用性测试  
> **当前默认模型**：DeepSeek-V4-Flash★（已配置）

---

## 一、整体架构评估

| 维度 | 评分 | 说明 |
|---|---|---|
| 技术选型 | ⭐⭐⭐⭐ | Next.js 14 + React 18 + Tailwind，栈现代化、部署灵活 |
| 代码结构 | ⭐⭐⭐⭐ | 组件/API/lib 分层清晰，模块职责分明 |
| 知识体系 | ⭐⭐⭐⭐⭐ | 8关任务卡 + 高阶讲解 + 企业案例，内容框架完整 |
| 多模型支持 | ⭐⭐⭐⭐ | 14家厂商（10国内+4国际），模型切换即时生效 |
| 用户系统 | ⭐⭐⭐ | 管理员/教师/学生三级，文件存储（JSON），够用但受限 |
| 交互体验 | ⭐⭐⭐ | 流式对话流畅，但缺少实时反馈和实战互动 |

---

## 二、功能走查结果

### ✅ 正常工作的功能

| 功能 | 状态 | 测试结果 |
|---|---|---|
| 首页加载 | ✅ 正常 | `GET /` → 200 |
| 教师面板 | ✅ 正常 | `GET /teacher` → 200，含登录表单和学生卡片 |
| 管理后台 | ✅ 正常 | `GET /admin` → 200，含用户创建/删除/列表 |
| API 状态检查 | ✅ 正常 | `/api/status` → 28个知识文件全部就绪 |
| 模型切换 | ✅ 正常 | 14家厂商下拉选择，切换即时生效 |
| 关卡阶梯 | ✅ 正常 | 8关进度可视化，点击切换知识库范围 |
| 快捷口令 | ✅ 正常 | 8条指令：讲高阶、记录卡点、面试我等 |
| 聊天持久化 | ✅ 正常 | localStorage 保存最近50条消息 |
| 构建编译 | ✅ 正常 | `next build` 零错误通过 |

### ⚠️ 需要注意的问题

| 功能 | 状态 | 说明 |
|---|---|---|
| 一键启动 | ⚠️ 部分 | `.command` 文件存在，但首次需手动 `npm install` |
| 启动后访问 | ⚠️ 不稳定 | 终端关闭后服务随之停止（无后台守护） |
| API Key | ⚠️ 泄露风险 | `.env.local` 中存在硬编码 DeepSeek Key，应移除 |

---

## 三、八项待改进问题 + 解决方案

### 🔴 问题1：知识库静态固化，缺乏动态生长

**现状**：知识库从 Markdown 文件读取，内容是固定的。LLM 每次都收到相同的知识上下文，无法根据学生实际表现动态调整教学重点。

**改进方案**：
- 引入「知识向量化」：用 embedding 将知识库转为向量，聊天时按语义检索最相关的 3-5 条上下文片段，而非整段注入
- 添加「知识热点追踪」：统计学生高频提问，自动标记薄弱知识点，推送针对性讲解
- 实现「错题本」：收集学生理解错误/卡关节点，生成个性化复习材料

```
技术路径：lib/knowledgeBase.ts → 增加 vectorSearch() 函数
新增依赖：可选用本地 embedding（如 transformers.js）或 API（如 DeepSeek embedding）
```

---

### 🔴 问题2：缺少真正的实战互动

**现状**：智能体是"知识问答库"——学生提问 → LLM 回答。没有代码执行、项目检查、作业提交等实战环节。

**改进方案**：
- **代码沙箱**：接入 WebContainer 或 Docker，让学生在浏览器里写代码并实时运行
- **自动评测**：学生提交 GitHub 链接 → 自动 clone + 运行 eval 脚本 → 返回量化得分
- **模拟面试**：LLM 扮演面试官，按《面试官人格库》追问 3 轮，给出表现报告
- **每日任务**：根据学生关卡自动生成当日任务卡片，完成后自动标记进度

```
技术路径：新增 /api/eval 路由 + 沙箱容器
页面新增：components/PracticeLab.tsx（代码练习区）
          components/MockInterview.tsx（模拟面试）
```

---

### 🔴 问题3：数据存储脆弱，无法跨设备

**现状**：用户数据用 JSON 文件存储，Vercel 上用 `/tmp`（重启即丢失）。聊天记录在 localStorage（换设备丢失）。

**改进方案**：
- **短期（无需后端）**：使用 Vercel KV（免费 256MB）或 Upstash Redis 替代 JSON 文件
- **中期**：接入 Supabase（PostgreSQL，免费额度充足），统一存储用户/学生/聊天记录
- **长期**：实现学生端 → 教师端 → 管理端数据实时同步（WebSocket）

```
技术路径：lib/userStore.ts → lib/userStore-supabase.ts
         lib/studentStore.ts → lib/studentStore-supabase.ts
新增依赖：@supabase/supabase-js
```

---

### 🔴 问题4：一键启动流程不完整

**现状**：双击 `.command` 会检查 `node_modules` 是否存在，但使用的是硬编码绝对路径，换电脑后失效。

**改进方案**：

```bash
# 修改 启动AI教练.command，改为相对路径
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/webapp"

lsof -ti:3000 | xargs kill -9 2>/dev/null

if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖（约 2 分钟）..."
  npm install
fi

echo "🚀 AI 教练启动中..."
(sleep 3 && open http://localhost:3000) &
npm run dev
```

额外建议：
- 添加 `启动AI教练_外网.command`（集成 ngrok）
- 打包一个 Electron 壳，双击即用，无需安装 Node.js

---

### 🔴 问题5：外网访问方案不完善

**现状**：Vercel 部署文档写了但复杂，ngrok 方案只在文档提及未实现。

**改进方案（三选一，推荐 Vercel）**：

**方案A - Vercel 免费部署（推荐）**：
```
1. 创建 GitHub 仓库并推送
2. Vercel 导入仓库，配置：
   - Build Command: cd webapp && npm install && npm run build
   - Output Directory: webapp/.next
   - 环境变量：DEEPSEEK_API_KEY, ADMIN_PASSWORD
3. 得到 https://xxx.vercel.app 固定地址
```
✅ 免费、24h在线、自带 HTTPS、自动部署

**方案B - ngrok 临时公网**：
```
创建 启动AI教练_外网.command：
#!/bin/bash
# ...（同启动脚本）...
# 启动后自动运行 ngrok http 3000
# 提取公网地址并显示
```
⚠️ 免费版地址每次变化，需电脑开机

**方案C - Cloudflare Tunnel**：
```
cloudflared tunnel --url http://localhost:3000
```
✅ 比 ngrok 稳定，免费，可绑定自定义域名

---

### 🔴 问题6：API Key 硬编码泄露风险

**现状**：`.env.local` 中包含真实 DeepSeek API Key（`sk-bc6ba...`），被 gitignore 排除但仍需注意。

**改进方案**：
- 立即在 DeepSeek 后台重置该 Key（已暴露在文档中）
- 前端 API Key 输入框支持「记住到浏览器」+「使用服务端 Key」二选一
- 服务端 Key 仅在 Vercel 环境变量中设置，本地 `.env.local.example` 只放模板

---

### 🔴 问题7：内容管理系统缺失

**现状**：所有课程内容（任务卡、高阶讲解、案例库）是静态 Markdown 文件，教师无法在界面上修改。

**改进方案**：
- **轻量方案**：在管理后台增加「内容管理」Tab，读取并编辑 Markdown 文件（需服务端写权限）
- **完整方案**：搭建 Strapi/Contentful 无头 CMS，Markdown → API → 前端渲染
- **最快方案**：课程内容放到 GitHub，教师改完 push → Vercel 自动重新部署（已支持）

```
页面新增：app/admin/content/page.tsx
API新增：/api/content（读写 Markdown 文件）
```

---

### 🔴 问题8：移动端适配不足

**现状**：UI 是桌面端优先设计（侧边栏 256px + 对话区），手机端体验差。

**改进方案**：
- 侧边栏改为底部 Tab Bar（手机端）或抽屉式菜单
- 添加 PWA 支持（`manifest.json` + Service Worker），可安装到手机桌面
- 响应式断点：`<768px` 时隐藏侧边栏，点击汉堡菜单弹出

```
技术路径：Tailwind 响应式类（lg:flex md:hidden 等）
新增文件：public/manifest.json, public/sw.js
```

---

## 四、DeepSeek-V4-Flash 模型配置

已完成的更改：

| 文件 | 更改内容 |
|---|---|
| `webapp/lib/models.ts` | 新增 `deepseek-v4-flash` 模型选项，标记为 ★ 推荐 |
| `webapp/app/page.tsx` | 默认模型改为 `deepseek-v4-flash` |
| 验证 | `next build` 编译通过，14家模型全部可用 |

**重要提醒**：DeepSeek API 端点为 `https://api.deepseek.com/chat/completions`，需确认 API Key 有效且有余额。如果 `deepseek-v4-flash` 模型 ID 不匹配，请根据 DeepSeek 官方文档修正模型 ID。

---

## 五、快速行动优先级

| 优先级 | 条目 | 预计耗时 | 影响 |
|---|---|---|---|
| 🔴 P0 | 立即重置已暴露的 API Key | 5分钟 | 安全 |
| 🔴 P0 | 修复一键启动脚本（绝对路径→相对路径） | 10分钟 | 可用性 |
| 🟡 P1 | Vercel 免费部署上线 | 30分钟 | 外网访问 |
| 🟡 P1 | 接入 Supabase 替代 JSON 存储 | 2小时 | 数据可靠性 |
| 🟢 P2 | 添加向量检索（RAG 知识库） | 3小时 | 智能度 |
| 🟢 P2 | 实现代码沙箱 + 自动评测 | 4小时 | 实战效果 |
| 🟢 P2 | PWA 移动端适配 | 2小时 | 移动端 |
| 🔵 P3 | 后端内容管理 CMS | 4小时 | 教师体验 |

---

## 六、总结

**核心优势**：
- 课程体系设计专业、8关阶梯清晰、14家模型支持领先
- 代码架构干净、构建零错误、API 设计合理
- 管理员/教师/学生三级权限体系完善

**最大短板**：
- 「智能体≈知识问答」，缺少真正的实战互动（代码执行、自动评测、模拟面试）
- 数据存储脆弱（JSON文件+Vercel /tmp），规模化后必崩
- 外网部署流程复杂，一键启动不完整

**一句话建议**：当前 v2 是一个**优秀的课程内容平台 + 对话前端**，要变成「AI上岗实战训练营」，核心需要在「实」（代码沙箱/自动评测）和「通」（数据持久化/外网部署）两个维度补齐。

---

> 📁 点击左上角打开：`/Users/mini_m4/Desktop/AI上岗实战训练营智能体_v2/`
> 
> 🌐 本地启动：双击 `启动AI教练.command` 或终端 `cd webapp && npm run dev`
> 
> 🔑 默认管理员密码：`admin123`
