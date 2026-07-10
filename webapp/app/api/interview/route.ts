import { NextRequest } from "next/server";
import { getProviderById, getModelById } from "@/lib/models";
import { getGateData } from "@/lib/gateData";
import { scoreInterview, addArchiveEntry } from "@/lib/studentStore";
import type { InterviewVerdict } from "@/lib/studentTypes";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Verdict = {
  score: number;
  verdict: InterviewVerdict;
  passed: boolean;
  strengths: string[];
  gaps: string[];
  comment: string;
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { "content-type": "application/json" },
  });
}

function extractJson(text: string): Verdict | null {
  const tryParse = (s: string): Verdict | null => {
    try { return JSON.parse(s); } catch { return null; }
  };
  return tryParse(text) ?? (text.match(/\{[\s\S]*\}/) ? tryParse(text.match(/\{[\s\S]*\}/)![0]) : null);
}

function clampScore(n: unknown): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

export async function POST(req: NextRequest) {
  let body: {
    studentId?: string;
    gate?: number;
    transcript?: ChatMessage[];
    providerId?: string;
    modelId?: string;
    apiKey?: string;
  };
  try { body = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }

  const { studentId, gate, transcript } = body;
  if (!studentId || !gate) return jsonError("缺少 studentId/gate", 400);
  if (!Array.isArray(transcript) || transcript.length < 2) {
    return jsonError("面试对话太短,至少答过一轮再结算", 400);
  }

  const gateData = getGateData(gate);
  if (!gateData) return jsonError(`无效的关卡编号: ${gate}`, 400);

  // ---- 模型与 key(复用 review 路由同一套解析)----
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

  // ---- 只取本次面试的问答(用户消息 + 助手消息),裁掉过长历史 ----
  const dialogue = transcript
    .slice(-24)
    .map((m) => `${m.role === "assistant" ? "面试官" : "考生"}: ${m.content}`)
    .join("\n\n");

  const focus = gateData.interviewQuestions?.length
    ? gateData.interviewQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "（本关无预置追问,按岗位通用标准评判）";

  const systemPrompt = `你是「AI 上岗实战总教练」的面试评分模块,正在给学生第 ${gate} 关「${gateData.name}」的模拟面试打分。

## 本关面试重点
${focus}

## 打分铁律
1. 只依据下方面试对话里**考生实际说出的内容**评分,不脑补、不给同情分。
2. 空泛、回避、"应该""大概""没测过"这类回答要扣分并写进 gaps。
3. 有数据、有取舍、有证据的回答给高分并写进 strengths。
4. passed 的判定线:score >= 70。
5. **只输出一个 JSON 对象,不要任何解释文字,不要用代码块包裹。**

JSON schema:
{
  "score": 0-100 整数,
  "verdict": "pass"(80+) | "edge"(60-79) | "fail"(<60),
  "passed": score>=70 的布尔值,
  "strengths": ["答得好的具体点,1-3条,引用考生原话要点"],
  "gaps": ["最伤的漏洞,1-3条,具体可改进"],
  "comment": "一句话总评,给考生下一步方向"
}`;

  let llmRes: Response;
  try {
    llmRes = await fetch(provider.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelId, stream: false, max_tokens: 1200, temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `面试对话如下,请评分:\n\n${dialogue}` },
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
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) {
    return jsonError("面试评分解析失败,请重试或换个模型。原始输出:" + content.slice(0, 200), 502);
  }

  // ---- 归一化 + 入库 ----
  const score = clampScore(parsed.score);
  const passed = typeof parsed.passed === "boolean" ? parsed.passed : score >= 70;
  const verdict: InterviewVerdict = parsed.verdict === "pass" || parsed.verdict === "edge" || parsed.verdict === "fail"
    ? parsed.verdict
    : (score >= 80 ? "pass" : score >= 60 ? "edge" : "fail");
  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3).map(String) : [];
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3).map(String) : [];
  const comment = String(parsed.comment ?? "").slice(0, 300);

  const { reward, result } = await scoreInterview(studentId, gate, {
    score, verdict, passed, strengths, gaps, comment,
  });

  // ---- 写入闯关档案(面试记录留痕);用档案写入后的最新 profile 回传,让前端档案立即刷新 ----
  const { profile } = await addArchiveEntry(studentId, gate, {
    type: "interview",
    title: `模拟面试 · ${score}分 · ${passed ? "通过" : "未过"}`,
    detail: comment,
    aiFeedback: [
      strengths.length ? "亮点:" + strengths.join(";") : "",
      gaps.length ? "待补:" + gaps.join(";") : "",
    ].filter(Boolean).join("\n"),
    score,
    passed,
  });
  void result;

  return Response.json({ ok: true, result: { score, verdict, passed, strengths, gaps, comment }, reward, profile });
}
