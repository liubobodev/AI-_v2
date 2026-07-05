/**
 * 多模型支持配置（14 家：10 国内 + 4 国际）。
 * 统一使用 OpenAI 兼容的 /chat/completions + SSE 流式。
 * API Key 由用户在前端填入，每个 provider 独立保存。
 */

export type ModelProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  /** 是否国际厂商 */
  intl?: boolean;
};

export type ModelOption = {
  id: string;
  name: string;
  reasoning?: boolean;
};

/* ==================== 国内 10 家 ==================== */

export const PROVIDERS: ModelProvider[] = [
  // 1. DeepSeek
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/chat/completions",
    models: [
      { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash ★" },
      { id: "deepseek-chat", name: "DeepSeek-V3" },
      { id: "deepseek-reasoner", name: "DeepSeek-R1", reasoning: true },
    ],
  },

  // 2. GLM（智谱）
  {
    id: "glm",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: [
      { id: "glm-4.7-flash", name: "GLM-4.7-Flash ★" },
      { id: "glm-4-flash", name: "GLM-4-Flash（免费）" },
      { id: "glm-4-plus", name: "GLM-4-Plus" },
      { id: "glm-4-air", name: "GLM-4-Air" },
    ],
  },

  // 3. KIMI（月之暗面）
  {
    id: "kimi",
    name: "Kimi（月之暗面）",
    baseUrl: "https://api.moonshot.cn/v1/chat/completions",
    models: [
      { id: "moonshot-v1-8k", name: "Moonshot v1-8K" },
      { id: "moonshot-v1-32k", name: "Moonshot v1-32K" },
      { id: "moonshot-v1-128k", name: "Moonshot v1-128K" },
    ],
  },

  // 4. Qwen（通义千问 / 阿里百炼）
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: [
      { id: "qwen-turbo", name: "Qwen-Turbo" },
      { id: "qwen-plus", name: "Qwen-Plus" },
      { id: "qwen-max", name: "Qwen-Max" },
    ],
  },

  // 5. MiniMax（海螺 AI）
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1/text/chatcompletion_v2",
    models: [
      { id: "abab6.5s-chat", name: "abab6.5s-chat" },
      { id: "MiniMax-M1", name: "MiniMax-M1", reasoning: true },
    ],
  },

  // 6. 豆包（字节火山引擎）
  {
    id: "doubao",
    name: "豆包（火山引擎）",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    models: [
      { id: "doubao-pro-32k", name: "豆包 Pro 32K" },
      { id: "doubao-lite-32k", name: "豆包 Lite 32K" },
    ],
  },

  // 7. 百度文心（千帆）
  {
    id: "ernie",
    name: "文心一言",
    baseUrl: "https://qianfan.baidubce.com/v2/chat/completions",
    models: [
      { id: "ernie-4.0-turbo-8k", name: "ERNIE 4.0 Turbo" },
      { id: "ernie-3.5-8k", name: "ERNIE 3.5" },
      { id: "ernie-speed-8k", name: "ERNIE Speed（免费）" },
    ],
  },

  // 8. MiMo
  {
    id: "mimo",
    name: "MiMo",
    baseUrl: "https://api.mimo.xiaomi.com/v1/chat/completions",
    models: [
      { id: "mimo-chat", name: "MiMo-Chat" },
    ],
  },

  // 9. 腾讯混元
  {
    id: "hunyuan",
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    models: [
      { id: "hunyuan-lite", name: "混元 Lite（免费）" },
      { id: "hunyuan-pro", name: "混元 Pro" },
      { id: "hunyuan-turbo", name: "混元 Turbo" },
    ],
  },

  // 10. LongCat
  {
    id: "longcat",
    name: "LongCat",
    baseUrl: "https://api.longcat.chat/v1/chat/completions",
    models: [
      { id: "longcat-chat", name: "LongCat-Chat" },
    ],
  },

  /* ==================== 国际 4 家 ==================== */

  // 11. OpenAI
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    intl: true,
    models: [
      { id: "gpt-4.1", name: "GPT-4.1" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },

  // 12. Anthropic Claude（通过兼容网关，如 openrouter 或自建代理）
  // 注：Anthropic 原生 API 不是 OpenAI 兼容格式。
  // 有两条路径：① 用 OpenRouter 中转 baseUrl = "https://openrouter.ai/api/v1/chat/completions"
  //           ② 自建代理转 Messages API → chat/completions
  // 此处默认用 OpenRouter 路径（用户也可填自己的代理地址）
  {
    id: "claude",
    name: "Anthropic Claude",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    intl: true,
    models: [
      { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
    ],
  },

  // 13. Google Gemini
  // Gemini 通过 AI Studio 或 Vertex AI 的 OpenAI 兼容端点
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    intl: true,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
  },

  // 14. Meta Llama（通过 Groq / Together / SambaNova 等快速推理平台）
  // 默认用 Groq（免费额度高、延迟低）
  {
    id: "llama",
    name: "Meta Llama",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    intl: true,
    models: [
      { id: "llama-4-maverick-17b-128e", name: "Llama 4 Maverick (Groq)" },
      { id: "llama-4-scout-17b-16e", name: "Llama 4 Scout (Groq)" },
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick (OpenRouter)" },
    ],
  },
];

// ---------- 工具函数 ----------

export function getProviderById(id: string): ModelProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModelById(providerId: string, modelId: string): ModelOption | undefined {
  const provider = getProviderById(providerId);
  return provider?.models.find((m) => m.id === modelId);
}

/** 展开为前端下拉用的扁平列表 */
export function getFlatModelList() {
  return PROVIDERS.flatMap((p) =>
    p.models.map((m) => ({
      providerId: p.id,
      providerName: p.name,
      modelId: m.id,
      modelName: m.name,
      reasoning: m.reasoning ?? false,
      intl: p.intl ?? false,
    }))
  );
}
