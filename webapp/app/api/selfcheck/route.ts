import { NextRequest } from "next/server";
import { getProviderById, getModelById } from "@/lib/models";
import { getGateData } from "@/lib/gateData";
import { getOrCreateProfile, submitSelfCheckResult } from "@/lib/studentStore";

export const runtime = "nodejs";

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
}

function extractJson(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export async function POST(req: NextRequest) {
  let body: {
    studentId?: string;
    gate?: number;
    providerId?: string;
    modelId?: string;
    apiKey?: string;
  };
  try { body = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }

  const { studentId, gate } = body;
  if (!studentId || !gate) return jsonError("缺少 studentId/gate", 400);

  const gateData = getGateData(gate);
  if (!gateData) return jsonError("无效的关卡编号: " + gate, 400);

  // 读取学生已保存的自检内容
  const profile = await getOrCreateProfile(studentId);
  const g = profile.gateProgress.find((p) => p.gate === gate);
  if (!g?.selfCheckData || g.selfCheckData.items.length === 0) {
    return jsonError("该关卡暂无已保存的自检内容，请先填写并暂存", 400);
  }
  if (g.selfCheckData.items.some((i) => !i.content || i.content.trim().length < 3)) {
    return jsonError("部分自检项内容为空，请填写完整后再提交", 400);
  }

  // 标记为 submitted
  g.selfCheckData.status = "submitted";
  g.selfCheckData.submittedAt = new Date().toISOString();

  // 用 criterion 填充 item 的描述
  for (const item of g.selfCheckData.items) {
    const idx = parseInt(item.key.replace("c", ""), 10);
    if (!isNaN(idx) && gateData.acceptanceCriteria[idx]) {
      item.criterion = gateData.acceptanceCriteria[idx];
    }
  }

  // 解析模型
  const providerId = body.providerId || "glm";
  const modelId = body.modelId || "glm-4.7-flash";
  const provider = getProviderById(providerId);
  const model = getModelById(providerId, modelId);
  if (!provider || !model) return jsonError("未知的模型厂商/模型", 400);

  let envKey = "";
  if (providerId === "deepseek") envKey = process.env.DEEPSEEK_API_KEY || "";
  else if (providerId === "glm") envKey = process.env.GLM_API_KEY || "";
  else envKey = process.env.LLM_API_KEY || "";
  const apiKey = (body.apiKey || envKey || "").trim();
  if (!apiKey || apiKey.length < 10) return jsonError("缺少有效的 API Key", 401);

  // 组装 Prompt
  const itemsText = g.selfCheckData.items.map((item, i) => {
    return [
      "---",
      "项目 " + (i + 1),
      "验收标准：" + (item.criterion || "(未设置)"),
      "学生提交内容：",
      item.content,
      "---",
    ].join("\n");
  }).join("\n\n");

  const criterionList = gateData.acceptanceCriteria.map((c, i) => (i + 1) + ". " + c).join("\n");

  const systemPrompt = [
    "你是「AI 上岗实战总教练」的自动质检模块，正在审核学生在第 " + gate + " 关「" + gateData.name + "」的自检提交。",
    "",
    "## 关卡验收标准",
    criterionList || "(无量化标准)",
    "",
    "## 你的任务",
    "逐项评估学生提交的内容是否符合验收标准。请注意：",
    "1. 根据学生实际提交的内容做判断，不要脑补学生没写的东西",
    "2. 分数反映完成质量和深度：0-59 = 需重做, 60-79 = 基本达标, 80-100 = 优秀",
    "3. 对每项给出具体、可操作的反馈",
    "",
    "## 输出格式",
    "你必须只输出一个纯 JSON 对象（不要 markdown 代码块、不要额外文字）：",
    JSON.stringify({
      items: [
        { key: "c0", score: 85, feedback: "具体反馈，包括肯定和建议", passed: true },
        { key: "c1", score: 70, feedback: "具体反馈", passed: true },
      ],
      overallScore: 78,
      overallPassed: true,
      summary: "总体评价（50字以内）",
    }, null, 2),
  ].join("\n");

  const userPrompt = "以下是学生在第 " + gate + " 关「" + gateData.name + "」提交的自检内容，请逐项评估：\n\n" + itemsText;

  // 调用大模型
  const llmRes = await fetch(provider.baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model: modelId,
      stream: false,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!llmRes.ok) {
    const text = await llmRes.text().catch(() => "");
    return jsonError("模型调用失败(HTTP " + llmRes.status + "): " + text.slice(0, 200), llmRes.status || 500);
  }

  const data = await llmRes.json();
  const rawContent: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(rawContent);

  if (!parsed || !Array.isArray(parsed.items)) {
    return jsonError("AI 返回结果解析失败，请重试或切换模型（原始返回: " + rawContent.slice(0, 300) + "）", 500);
  }

  // 存入数据库
  const { profile: updatedProfile, reward } = await submitSelfCheckResult(studentId, gate, parsed);

  return Response.json({
    ok: true,
    result: parsed,
    reward,
    profile: updatedProfile,
  });
}
