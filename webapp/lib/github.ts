// GitHub 证据抓取：LLM 不能真的访问链接，必须服务端先抓取文件树 + README + 四件套关键文件，
// 组装成证据包再喂给模型评分——这是修复"假装 AI 能读链接"这一技术性错误的核心。

export type GateEvidence = {
  ok: boolean;
  error?: string;
  owner?: string;
  repo?: string;
  description?: string;
  stargazers?: number;
  pushedAt?: string;
  fileTree?: string[];
  hasReadme?: boolean;
  hasEvalsDir?: boolean;
  hasCostFile?: boolean;
  hasPostmortem?: boolean;
  readmeExcerpt?: string;
  costExcerpt?: string;
  postmortemExcerpt?: string;
};

const GITHUB_API = "https://api.github.com";
const MAX_EXCERPT = 4000;

function parseRepoUrl(link: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(link.trim());
    if (!/github\.com$/.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`${GITHUB_API}${path}`, { headers });
}

async function fetchRawFile(owner: string, repo: string, branch: string, filePath: string): Promise<string | null> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
  );
  if (!res.ok) return null;
  const text = await res.text();
  return text.slice(0, MAX_EXCERPT);
}

/** 抓取一个 GitHub 仓库的证据包：文件树 + README + COST.md + POSTMORTEM.md（四件套判定） */
export async function fetchGateEvidence(link: string): Promise<GateEvidence> {
  const parsed = parseRepoUrl(link);
  if (!parsed) return { ok: false, error: "不是有效的 GitHub 仓库链接，请贴 https://github.com/用户名/仓库名 格式" };
  const { owner, repo } = parsed;

  const repoRes = await ghFetch(`/repos/${owner}/${repo}`);
  if (repoRes.status === 404) return { ok: false, error: `仓库 ${owner}/${repo} 不存在或未公开，请检查链接` };
  if (!repoRes.ok) return { ok: false, error: `GitHub API 请求失败（HTTP ${repoRes.status}），可能触发了限流，稍后再试` };
  const repoJson = await repoRes.json();
  const branch = repoJson.default_branch || "main";

  const treeRes = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  let fileTree: string[] = [];
  if (treeRes.ok) {
    const treeJson = await treeRes.json();
    fileTree = (treeJson.tree ?? [])
      .filter((n: { type: string }) => n.type === "blob")
      .map((n: { path: string }) => n.path);
  }

  const hasReadme = fileTree.some((f) => /^readme\.md$/i.test(f));
  const evalsFiles = fileTree.filter((f) => /^evals?\//i.test(f));
  const hasEvalsDir = evalsFiles.length > 0;
  const costFile = fileTree.find((f) => /^cost\.md$/i.test(f));
  const postmortemFile = fileTree.find((f) => /^postmortem\.md$/i.test(f));

  const [readmeExcerpt, costExcerpt, postmortemExcerpt] = await Promise.all([
    hasReadme ? fetchRawFile(owner, repo, branch, "README.md") : Promise.resolve(null),
    costFile ? fetchRawFile(owner, repo, branch, costFile) : Promise.resolve(null),
    postmortemFile ? fetchRawFile(owner, repo, branch, postmortemFile) : Promise.resolve(null),
  ]);

  return {
    ok: true,
    owner,
    repo,
    description: repoJson.description ?? "",
    stargazers: repoJson.stargazers_count ?? 0,
    pushedAt: repoJson.pushed_at ?? "",
    fileTree: fileTree.slice(0, 200),
    hasReadme,
    hasEvalsDir,
    hasCostFile: !!costFile,
    hasPostmortem: !!postmortemFile,
    readmeExcerpt: readmeExcerpt ?? undefined,
    costExcerpt: costExcerpt ?? undefined,
    postmortemExcerpt: postmortemExcerpt ?? undefined,
  };
}

/** 把证据包渲染成给 LLM 看的纯文本证据材料 */
export function renderEvidenceForLLM(ev: GateEvidence): string {
  if (!ev.ok) return `【证据抓取失败】${ev.error}`;
  const lines: string[] = [
    `## 仓库证据包：${ev.owner}/${ev.repo}`,
    `- 描述：${ev.description || "（无）"}`,
    `- Star 数：${ev.stargazers}`,
    `- 最近推送：${ev.pushedAt}`,
    `- 四件套检测：README ${ev.hasReadme ? "✅" : "❌缺失"} / evals目录 ${ev.hasEvalsDir ? "✅" : "❌缺失"} / COST.md ${ev.hasCostFile ? "✅" : "❌缺失"} / POSTMORTEM.md ${ev.hasPostmortem ? "✅" : "❌缺失"}`,
    `- 文件树（前 200 项）：\n${(ev.fileTree ?? []).map((f) => `  - ${f}`).join("\n")}`,
  ];
  if (ev.readmeExcerpt) lines.push(`\n### README.md 内容（截断）\n${ev.readmeExcerpt}`);
  if (ev.costExcerpt) lines.push(`\n### COST.md 内容（截断）\n${ev.costExcerpt}`);
  if (ev.postmortemExcerpt) lines.push(`\n### POSTMORTEM.md 内容（截断）\n${ev.postmortemExcerpt}`);
  return lines.join("\n");
}
