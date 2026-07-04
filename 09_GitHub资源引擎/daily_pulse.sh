#!/usr/bin/env bash
# 每日脉搏 —— 每 1~3 天跑一次,抓 A 类机器信号(HN共识 + HF趋势 + GitHub新星)
# 全部使用免登录公开 API;中文自媒体热点走智能体口令"每日脉搏"(B类,见《活水来源设计.md》)
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")" && pwd)"
TODAY=$(date +%F)
OUT="$OUT_DIR/脉搏_${TODAY}.md"
D3=$(date -v-3d +%s 2>/dev/null || date -d '3 days ago' +%s)

{
  echo "# AI 每日脉搏 · ${TODAY}"
  echo
  echo "> A类机器信号(本文件)+ B类中文热点(问教练智能体:\"每日脉搏\")= 完整早报。"
  echo "> 课前 5 分钟行业早报直接用;连续命中双源的条目标 ⭐ 进入周雷达候选。"
  echo

  echo "## Hacker News 社区共识(近 3 天 AI 相关,≥100 分)"
  echo
  curl -sfG "https://hn.algolia.com/api/v1/search" \
      --data-urlencode "query=AI" --data-urlencode "tags=story" \
      --data-urlencode "numericFilters=created_at_i>${D3}" --data-urlencode "hitsPerPage=50" |
    jq -r '[.hits[] | select(.points >= 100)] | sort_by(-.points) | .[0:8][] |
      "- [\(.title)](\(.url // ("https://news.ycombinator.com/item?id=" + .objectID))) — \(.points)分/\(.num_comments)评"' \
    || echo "- (HN 拉取失败,跳过)"
  echo

  echo "## HuggingFace 趋势模型(社区真实热度)"
  echo
  curl -sf "https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=8" |
    jq -r '.[] | "- [\(.id)](https://huggingface.co/\(.id)) — ↓\(.downloads // 0) ♥\(.likes // 0)"' \
    || echo "- (HF 拉取失败,跳过)"
  echo

  echo "## GitHub 三日新星(llm/agent/mcp/rag)"
  echo
  D3_DATE=$(date -v-3d +%F 2>/dev/null || date -d '3 days ago' +%F)
  gh search repos --created ">${D3_DATE}" --sort stars --order desc --limit 6 \
    --json fullName,stargazersCount,description,url \
    -- "llm OR agent OR mcp OR rag in:name,description,topics" |
    jq -r '.[] | "- [\(.fullName)](\(.url)) ⭐\(.stargazersCount) — \(.description // "" | .[0:70])"' \
    || echo "- (GitHub 拉取失败,跳过)"
  echo
  echo "---"
  echo "_双源交叉核对规则见《活水来源设计.md》· 生成:$(date '+%F %T')_"
} > "$OUT"

echo "✅ 脉搏已生成: $OUT"
