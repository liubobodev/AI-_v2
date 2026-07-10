// 每日脉搏 · 真实联网数据抓取（服务端专用，含 fs/网络调用）
// A类信号：HN Algolia + HuggingFace Trending —— 免费公开 API，无需任何 key
// B类信号：智谱 Web Search API —— 真实联网搜索，用现有 GLM_API_KEY，不需要额外申请

export type PulseItem = {
  title: string;
  url: string;
  meta: string;      // 一句话元信息：分数/评论数、下载/点赞、发布时间等
  date?: string;      // YYYY-MM-DD，有则展示
};

export type PulseGroup = {
  key: string;
  label: string;
  desc: string;
  items: PulseItem[];
  error?: string;
  qualityNote?: string;
};

const AI_KEYWORDS = [
  "ai", "agent", "agents", "llm", "model", "models", "rag", "mcp", "eval",
  "openai", "anthropic", "claude", "gemini", "deepseek", "qwen", "kimi",
  "人工智能", "智能体", "大模型", "检索增强", "评测", "多模态",
];

function isLikelyAiRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function normalizeUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : "";
  } catch {
    return "";
  }
}

function dedupeItems(items: PulseItem[]): PulseItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A类 · Hacker News 近 3 天 AI 相关高分帖（社区共识，刷不动） */
async function fetchHackerNews(): Promise<PulseGroup> {
  const key = "hn";
  const label = "Hacker News 社区共识";
  const desc = "近 3 天 AI 相关，≥100 分，全球工程师投票";
  try {
    const since = Math.floor((Date.now() - 3 * 86400000) / 1000);
    const url = `https://hn.algolia.com/api/v1/search?query=AI&tags=story&numericFilters=created_at_i%3E${since}&hitsPerPage=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const hits = (data.hits ?? [])
      .filter((h: any) => (h.points ?? 0) >= 100)
      .filter((h: any) => isLikelyAiRelated([h.title, h.story_text, h.comment_text].filter(Boolean).join(" ")))
      .sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 6);
    const items: PulseItem[] = hits.map((h: any) => ({
      title: h.title,
      url: normalizeUrl(h.url) || `https://news.ycombinator.com/item?id=${h.objectID}`,
      meta: `${h.points}分 · ${h.num_comments ?? 0}评`,
      date: h.created_at ? h.created_at.slice(0, 10) : undefined,
    }));
    return {
      key,
      label,
      desc,
      items: dedupeItems(items),
      qualityNote: "已过滤非 AI 主题与低分帖；HN 适合观察全球工程师关注点。",
    };
  } catch (e: any) {
    return { key, label, desc, items: [], error: `拉取失败：${e.message ?? "网络错误"}` };
  }
}

/** A类 · HuggingFace 趋势模型（社区真实热度） */
async function fetchHuggingFace(): Promise<PulseGroup> {
  const key = "hf";
  const label = "HuggingFace 趋势模型";
  const desc = "社区真实下载/点赞热度";
  try {
    const url = "https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=6";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items: PulseItem[] = (Array.isArray(data) ? data : [])
      .filter((m: any) => typeof m.id === "string" && m.id.trim())
      .slice(0, 6).map((m: any) => ({
      title: m.id,
      url: `https://huggingface.co/${m.id}`,
      meta: `↓${(m.downloads ?? 0).toLocaleString()} · ♥${m.likes ?? 0}`,
    }));
    return {
      key,
      label,
      desc,
      items: dedupeItems(items),
      qualityNote: "趋势分只代表社区热度，进入课堂前仍需二次核验模型质量与许可证。",
    };
  } catch (e: any) {
    return { key, label, desc, items: [], error: `拉取失败：${e.message ?? "网络错误"}` };
  }
}

/** B类 · 智谱 Web Search API 真实联网搜索（中文热点，需要 GLM key） */
async function fetchZhipuSearch(query: string, apiKey: string, count = 6): Promise<PulseItem[]> {
  const res = await fetch("https://open.bigmodel.cn/api/paas/v4/web_search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      search_query: query,
      search_engine: "search_std",
      count,
      search_recency_filter: "pastWeek",
      content_size: "medium",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  const results = data.search_result ?? [];
  const items = results.map((r: any): PulseItem => {
    const title = String(r.title ?? "").trim();
    // 智谱不同引擎返回的链接字段名不一致（link/url/href），逐个兜底
    const realUrl = normalizeUrl(r.link) || normalizeUrl(r.url) || normalizeUrl(r.href);
    // 链接缺失时合成一个可用的搜索链接，绝不静默丢弃有标题的结果
    const url = realUrl || (title ? `https://www.bing.com/search?q=${encodeURIComponent(title)}` : "");
    return {
      title,
      url,
      meta: realUrl ? (r.media || "网页") : `${r.media || "网页"} · 来源待核`,
      date: r.publish_date || undefined,
    };
  }).filter((item: PulseItem) => item.title && item.url);
  return dedupeItems(items);
}

async function fetchChineseHotspot(apiKey: string): Promise<PulseGroup> {
  const key = "cn";
  const label = "中文行业热点（真实联网搜索）";
  const desc = "智谱 Web Search 实时检索，近一周";
  if (!apiKey) {
    return { key, label, desc, items: [], error: "未配置 GLM_API_KEY，无法联网搜索中文热点" };
  }
  try {
    const items = await fetchZhipuSearch("人工智能 大模型 Agent MCP Evals 最新动态", apiKey, 6);
    return {
      key,
      label,
      desc,
      items,
      qualityNote: "仅展示带可访问来源链接的搜索结果；进入课堂需满足双源规则。",
    };
  } catch (e: any) {
    return { key, label, desc, items: [], error: `联网搜索失败：${e.message ?? "未知错误"}` };
  }
}

async function fetchEnterpriseScenarios(apiKey: string): Promise<PulseGroup> {
  const key = "scenario";
  const label = "企业落地案例（真实联网搜索）";
  const desc = "对应本训练营场景选题矩阵，近一周";
  if (!apiKey) return { key, label, desc, items: [], error: "未配置 GLM_API_KEY" };
  try {
    const items = await fetchZhipuSearch("企业 AI Agent RAG MCP 落地 案例", apiKey, 5);
    return {
      key,
      label,
      desc,
      items,
      qualityNote: "案例只作为线索，不直接等同于可复刻教学项目。",
    };
  } catch (e: any) {
    return { key, label, desc, items: [], error: `联网搜索失败：${e.message ?? "未知错误"}` };
  }
}

/** 汇总四路信号，全部并行抓取，互不阻塞 */
export async function buildDailyPulse(glmApiKey: string): Promise<{ generatedAt: string; groups: PulseGroup[] }> {
  const [hn, hf, cn, scenario] = await Promise.all([
    fetchHackerNews(),
    fetchHuggingFace(),
    fetchChineseHotspot(glmApiKey),
    fetchEnterpriseScenarios(glmApiKey),
  ]);
  return { generatedAt: new Date().toISOString(), groups: [hn, hf, cn, scenario] };
}

export function renderPulseMarkdown(pulse: { generatedAt: string; groups: PulseGroup[] }): string {
  const date = pulse.generatedAt.slice(0, 10);
  const lines: string[] = [
    `# 每日脉搏 ${date}`,
    "",
    "> 用途: 作为课堂前沿线索池。进入课堂或任务卡前，仍需满足《活水来源设计》的双源、可跑、冷静期、可教规则。",
    "",
    "## 快速判断",
    "",
    "- A 类信号用于观察全球工程师和开源社区正在关注什么。",
    "- B 类信号用于发现中文行业叙事和企业落地案例。",
    "- 单条热点不能直接当教学结论；至少两类独立来源命中后再进入课堂。",
    "",
  ];

  for (const group of pulse.groups) {
    lines.push(`## ${group.label}`);
    lines.push("");
    lines.push(group.desc);
    if (group.qualityNote) {
      lines.push("");
      lines.push(`> 质量说明: ${group.qualityNote}`);
    }
    if (group.error) {
      lines.push("");
      lines.push(`> 抓取异常: ${group.error}`);
    } else if (group.items.length === 0) {
      lines.push("");
      lines.push("- 暂无可溯源结果。");
    } else {
      lines.push("");
      for (const item of group.items) {
        const suffix = [item.meta, item.date].filter(Boolean).join(" · ");
        lines.push(`- [${item.title}](${item.url})${suffix ? ` — ${suffix}` : ""}`);
      }
    }
    lines.push("");
  }

  lines.push("## 教师复核");
  lines.push("");
  lines.push("- [ ] 是否有至少两类独立来源同时命中?");
  lines.push("- [ ] 是否有可运行代码、许可证可教学、30 天内维护?");
  lines.push("- [ ] 是否已过 7 天冷静期，或属于官方一手发布?");
  lines.push("- [ ] 是否能在 2 小时内被学生读懂核心链路?");
  lines.push("");
  return lines.join("\n");
}
