// 服务端环境自检 —— 只回传布尔与影响说明,绝不回传任何密钥值。
// 针对 POSTMORTEM #2(密钥被 vercel env pull 冲掉、启动无校验,直到学生触发才炸)
// 与 #4(GitHub 匿名限流 403)。让运维/教师在上课前就看到缺什么,而不是学生撞墙。

export type EnvSeverity = "critical" | "warning";

export type EnvCheckItem = {
  key: string;
  present: boolean;
  severity: EnvSeverity;
  impact: string; // 缺失会怎样(用户能看懂的后果)
  hint: string;   // 怎么补
};

export type EnvHealth = {
  ok: boolean;          // 无 critical 缺失
  hasWarnings: boolean; // 有 warning 缺失
  missingCritical: number;
  missingWarning: number;
  items: EnvCheckItem[];
  checkedAt: string;
};

const MIN_KEY_LEN = 8;

function has(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length >= MIN_KEY_LEN;
}

/** 计算环境健康状态。纯函数,可在任意服务端路由复用。 */
export function checkEnv(): EnvHealth {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const hasLlmKey = has("GLM_API_KEY") || has("DEEPSEEK_API_KEY") || has("LLM_API_KEY");

  const items: EnvCheckItem[] = [
    {
      key: "GLM_API_KEY / DEEPSEEK_API_KEY / LLM_API_KEY",
      present: hasLlmKey,
      severity: "critical",
      impact: "教练对话、验收自检、仓库评审、模拟面试、基础自测全部会报「缺少 API Key」。",
      hint: "在 webapp/.env.local 至少配置一个模型厂商的 Key(推荐 GLM_API_KEY),保存后重启服务。",
    },
    {
      key: "BLOB_READ_WRITE_TOKEN",
      present: has("BLOB_READ_WRITE_TOKEN"),
      severity: isProd ? "critical" : "warning",
      impact: isProd
        ? "生产环境无持久化存储,学生账号与训练数据不会被保存(重启即丢)。"
        : "本地开发已回退到本地文件存储(可正常用);部署到 Vercel 前必须配置。",
      hint: "在 Vercel 项目里创建 Blob 存储,把 BLOB_READ_WRITE_TOKEN 注入环境变量。",
    },
    {
      key: "GITHUB_TOKEN",
      present: has("GITHUB_TOKEN"),
      severity: "warning",
      impact: "仓库评审匿名调用 GitHub API,限 60 次/小时/IP,教室同一出口 IP 一节课就撞限(HTTP 403)。",
      hint: "用 `gh auth token` 取一个只读 token 写入 .env.local,额度升到 5000 次/小时。",
    },
    {
      key: "ADMIN_PASSWORD",
      present: has("ADMIN_PASSWORD"),
      severity: "warning",
      impact: "管理员后台在用默认密码 admin123,正式上课有账号被接管风险。",
      hint: "在 .env.local 设置 ADMIN_PASSWORD 为强密码,重启后生效。",
    },
  ];

  const missingCritical = items.filter((i) => i.severity === "critical" && !i.present).length;
  const missingWarning = items.filter((i) => i.severity === "warning" && !i.present).length;

  return {
    ok: missingCritical === 0,
    hasWarnings: missingWarning > 0,
    missingCritical,
    missingWarning,
    items,
    checkedAt: new Date().toISOString(),
  };
}

// ---- 启动自检:模块首次被服务端加载时跑一次,把缺失打到服务器日志 ----
// Next 14 无稳定 startup 钩子;/api/status 与 EnvBanner 会在首屏加载时命中本模块,
// 等价于「开机第一时间」的自检。用 globalThis 标志确保只打一次,不刷屏。

const LOG_FLAG = "__aiCoachEnvChecked__";

function logEnvCheckOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[LOG_FLAG]) return;
  g[LOG_FLAG] = true;

  const health = checkEnv();
  if (health.ok && !health.hasWarnings) {
    console.log("[env-check] 环境自检通过:关键密钥齐备。");
    return;
  }
  for (const item of health.items) {
    if (item.present) continue;
    const tag = item.severity === "critical" ? "[env-check][缺失·致命]" : "[env-check][缺失·警告]";
    console.warn(`${tag} ${item.key} —— ${item.impact} 修复:${item.hint}`);
  }
}

logEnvCheckOnce();
