import { NextRequest } from "next/server";
import { getProviderById, getModelById } from "@/lib/models";
import { getGateData } from "@/lib/gateData";
import { fetchGateEvidence, renderEvidenceForLLM } from "@/lib/github";
import { addSubmission, updateSubmissionResult } from "@/lib/studentStore";

export const runtime = "nodejs";

type ReviewResult = {
  overallScore: number;
  passed: boolean;
  criteria: { criterion: string; passed: boolean; evidence: string }[];
  topStrength: string;
  topGap: string;
  nextStep: string;
};

function extractJson(text: string): ReviewResult | null {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: {
    studentId?: string;
    gate?: number;
    link?: string;
    providerId?: string;
    modelId?: string;
    apiKey?: string;
  };
  try { body = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }

  const { studentId, gate, link } = body;
  if (!studentId || !gate || !link) return jsonError("缺少 studentId/gate/link", 400);

  const gateData = getGateData(gate);
  if (!gateData) return jsonError(`无效的关卡编号: ${gate}`, 400);

  // ---- 1. 真实抓取 GitHub 证据（不是让 LLM 假装能读链接）----
  const evidence = await fetchGateEvidence(link);
  const { submissionId } = await addSubmission(studentId, gate, link);

  if (!evidence.ok) {
    await updateSubmissionResult(studentId, gate, submissionId, {
      status: "rejected",
      rawError: evidence.error,
    });
    return Response.json({ submissionId, ok: false, error: evidence.error });
  }

  // ---- 2. 解析模型 ----
  const providerId = body.providerId || "deepseek";
  const modelId = body.modelId || "deepseek-chat";
  const provider = getProviderById(providerId);
  const model = getModelById(providerId, modelId);
  if (!provider || !model) return jsonError("未知的模型厂商/模型", 400);

  let envKey = "";
  if (providerId === "deepseek") envKey = process.env.DEEPSEEK_API_KEY || "";
  else if (providerId === "glm") envKey = process.env.GLM_API_KEY || "";
  else envKey = process.env.LLM_API_KEY || "";
  const apiKey = (body.apiKey || envKey || "").trim();
  if (!apiKey || apiKey.length < 10) return jsonError("缺少有效的 API Key", 401);

  // ---- 3. 组装评审 Prompt：验收标准 + 证据包，强制要求纯 JSON 输出 ----
  const rubric = gateData.acceptanceCriteria.length > 0
    ? gateData.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "（本关暂无量化验收标准，请按四件套完整度评审）";

  const systemPrompt = `你是「AI 上岗实战总教练」的自动化评审模块，正在给学生第 ${gate} 关「${gateData.name}」的提交打分。

## 本关验收标准（rubric）
${rubric}

## 打分铁律
1. 只能依据下方证据包里**实际出现的内容**打分，不能凭空假设或脑补仓库里有什么。
2. 证据包里没提到的信息，一律视为"未证实"，不能算通过。
3. 四件套（README/evals目录/COST.md/POSTMORTEM.md）缺失是硬伤，直接影响 overallScore。
4. **必须只输出一个 JSON 对象，不要有任何 JSON 之外的文字、不要用 Markdown 代码块包裹。**

## evidence 字段铁律（重点，违反则本次评审无效）
- 每条 criteria 的 evidence **必须先在证据包里检索**：文件树里的具体路径、README/COST/POSTMORTEM 摘录里的具体句子，都是可引用的证据。
- **passed=true 时**，evidence 必须引用一个**具体路径或原文片段**作为佐证（例："文件树含 evals/test_cases.json，共20条测试样本" 或 "README 第2段写明召回率 62%→88%"）。**不准写"证据包未提及"却判通过**——这是自相矛盾。
- **passed=false 时**，evidence 要写清"检索了文件树与 README，未见 X"，指明缺的是什么，而不是空泛一句"未提及"。
- 证据包明明有文件树/README 内容，却把每条都写成"证据包未提及"，属于没有认真检索，输出无效。

JSON schema：
{
  "overallScore": 0-100 的整数,
  "passed": overallScore >= 70 时为 true,
  "criteria": [ { "criterion": "验收标准原文", "passed": true/false, "evidence": "引用证据包中的具体路径或原文片段；passed=true 必须有具体佐证，passed=false 要说明检索了哪里、缺了什么" } ],
  "topStrength": "最值得肯定的一点，一句话，需引用具体文件或内容",
  "topGap": "最大的差距，一句话，要具体不要空话",
  "nextStep": "最小可行的下一步改进动作，一句话"
}`;

  const llmRes = await fetch(provider.baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      stream: false,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: renderEvidenceForLLM(evidence) },
      ],
    }),
  });

  if (!llmRes.ok) {
    const text = await llmRes.text().catch(() => "");
    await updateSubmissionResult(studentId, gate, submissionId, {
      status: "rejected",
      rawError: `模型调用失败(HTTP ${llmRes.status}): ${text.slice(0, 200)}`,
    });
    return jsonError(`调用 ${provider.name} 失败（HTTP ${llmRes.status}）`, llmRes.status || 500);
  }

  const data = await llmRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);

  if (!parsed) {
    await updateSubmissionResult(studentId, gate, submissionId, {
      status: "rejected",
      rawError: "模型未返回合法 JSON，原始输出：" + content.slice(0, 300),
    });
    return Response.json({ submissionId, ok: false, error: "评审结果解析失败，请重新提交或换个模型再试" });
  }

  const status = parsed.passed && parsed.overallScore >= 70 ? "approved" : "rejected";
  const { profile, reward } = await updateSubmissionResult(studentId, gate, submissionId, {
    status,
    overallScore: parsed.overallScore,
    criteria: parsed.criteria,
    topStrength: parsed.topStrength,
    topGap: parsed.topGap,
    nextStep: parsed.nextStep,
  });

  return Response.json({ submissionId, ok: true, result: parsed, profile, reward });
}
