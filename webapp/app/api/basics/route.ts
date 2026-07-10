import { NextRequest } from "next/server";
import { getProviderById, getModelById } from "@/lib/models";
import { scoreBasics } from "@/lib/studentStore";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Verdict = {
  score: number;
  passed: boolean;
  weakConcepts: string[];
  comment: string;
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { "content-type": "application/json" },
  });
}

function extractJson(text: string): Verdict | null {
  const tryParse = (s: string): Verdict | null => { try { return JSON.parse(s); } catch { return null; } };
  return tryParse(text) ?? (text.match(/\{[\s\S]*\}/) ? tryParse(text.match(/\{[\s\S]*\}/)![0]) : null);
}

const CONCEPTS = [
  "大模型与幻觉", "上下文窗口", "Prompt 四要素", "结构化输出/schema",
  "Embedding 与向量检索", "RAG 链路", "Agent 与工具调用", "MCP", "Evals 评测",
];

export async function POST(req: NextRequest) {
  let body: { studentId?: string; transcript?: ChatMessage[]; providerId?: string; modelId?: string; apiKey?: string };
  try { body = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }

  const { studentId, transcript } = body;
  if (!studentId) return jsonError("缺少 studentId", 400);
  if (!Array.isArray(transcript) || transcript.length < 2) return jsonError("基础自测对话太短,先答几题再结算", 400);

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

  const dialogue = transcript.slice(-30)
    .map((m) => `${m.role === "assistant" ? "考官" : "考生"}: ${m.content}`).join("\n\n");

  const systemPrompt = `你是「AI 上岗实战总教练」的基础准入评分模块,判定学生是否具备进入八关实战的 AI 基础。

## 需要考察的 9 个基础概念
${CONCEPTS.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## 判定铁律
1. 只依据考生实际说清的内容,背名词不算懂(答"就是那个向量的东西"不给分)。
2. passed 判定线:score >= 70(约等于 9 个概念里能讲清 ≥7 个)。
3. weakConcepts 列出考生明显没讲清的概念(从上面 9 个里选,最多 4 个),供其回 OpenMAIC 补学。
4. **只输出一个 JSON 对象,无任何多余文字、不要代码块包裹。**

JSON schema:
{ "score": 0-100 整数, "passed": score>=70 布尔, "weakConcepts": ["薄弱概念名"], "comment": "一句话总评+补学建议" }`;

  let llmRes: Response;
  try {
    llmRes = await fetch(provider.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelId, stream: false, max_tokens: 800, temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `基础自测对话如下,请评分:\n\n${dialogue}` },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (e: any) {
    return jsonError(`调用 ${provider.name} 超时或失败:${e?.message ?? "未知"}`, 502);
  }
  if (!llmRes.ok) {
    const text = await llmRes.text().catch(() => "");
    return jsonError(`调用 ${provider.name} 失败(HTTP ${llmRes.status}):${text.slice(0, 160)}`, llmRes.status || 500);
  }

  const data = await llmRes.json();
  const parsed = extractJson(data.choices?.[0]?.message?.content ?? "");
  if (!parsed) return jsonError("基础评分解析失败,请重试或换个模型。", 502);

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const passed = typeof parsed.passed === "boolean" ? parsed.passed : score >= 70;
  const weakConcepts = Array.isArray(parsed.weakConcepts) ? parsed.weakConcepts.slice(0, 4).map(String) : [];
  const comment = String(parsed.comment ?? "").slice(0, 300);

  const { profile, reward } = await scoreBasics(studentId, { score, passed, weakConcepts, comment });
  return Response.json({ ok: true, result: { score, passed, weakConcepts, comment }, reward, profile });
}
