#!/usr/bin/env bash
# 每周仓库雷达 —— 周一跑一次,输出周报到本目录,直接可上传 NotebookLM 生成播客
# 依赖: gh CLI 已登录 (gh auth status), jq
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")" && pwd)"
TODAY=$(date +%F)
LAST_WEEK=$(date -v-7d +%F 2>/dev/null || date -d '7 days ago' +%F)
OUT="$OUT_DIR/雷达周报_${TODAY}.md"

# 锚点仓库(与《GitHub资源引擎.md》清单保持一致)
ANCHORS=(
  Shubhamsaboo/awesome-llm-apps
  punkpeye/awesome-mcp-servers
  modelcontextprotocol/servers
  anthropics/anthropic-cookbook
  promptfoo/promptfoo
  langfuse/langfuse
  langgenius/dify
  infiniflow/ragflow
  microsoft/ai-agents-for-beginners
  0voice/2026-Computer-Spring-Recruitment-Job-Compilation
)

{
  echo "# AI 仓库雷达周报 · ${TODAY}"
  echo
  echo "> 用法:全文上传 NotebookLM → 生成 Audio Overview(简报模式)= 本周 10 分钟情报播客;"
  echo "> 或直接问教练智能体:\"从周报里帮我选本周解剖仓库\"。"
  echo

  echo "## 一、本周新星(近 7 天创建,按星数)"
  echo
  gh search repos --created ">${LAST_WEEK}" --sort stars --order desc --limit 10 \
    --json fullName,stargazersCount,description,url \
    -- "llm OR agent OR mcp OR rag in:name,description,topics" |
  jq -r '.[] | "- [\(.fullName)](\(.url)) ⭐\(.stargazersCount) — \(.description // "无描述" | .[0:80])"'
  echo

  echo "## 二、锚点仓库动态(最近一次提交)"
  echo
  for repo in "${ANCHORS[@]}"; do
    info=$(gh api "repos/${repo}/commits?per_page=1" --jq \
      '.[0] | "\(.commit.committer.date[0:10]) · \(.commit.message | split("\n")[0] | .[0:70])"' 2>/dev/null) || info="(拉取失败)"
    echo "- **${repo}** — ${info}"
  done
  echo

  echo "## 三、本周热议(近 7 天高活跃老仓库)"
  echo
  gh search repos --sort updated --limit 8 \
    --json fullName,stargazersCount,description,url \
    -- "ai agent stars:>5000 pushed:>${LAST_WEEK}" |
  jq -r '.[] | "- [\(.fullName)](\(.url)) ⭐\(.stargazersCount) — \(.description // "" | .[0:80])"'
  echo
  echo "---"
  echo "_生成时间:$(date '+%F %T') · 脚本:09_GitHub资源引擎/weekly_radar.sh_"
} > "$OUT"

echo "✅ 周报已生成: $OUT"
