import { NextRequest } from "next/server";
import { getBaseSystemPrompt, getKnowledgeBaseText } from "@/lib/knowledgeBase";
import { getProviderById, getModelById } from "@/lib/models";
import { buildStudentContext, recordSession } from "@/lib/studentStore";
import { buildCoachScopePrompt, type CoachScene } from "@/lib/chatScope";
import { enforceCoachScope, staticChatStream } from "@/lib/scopeGuard";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let body: {
    messages?: ChatMessage[];
    apiKey?: string;
    gate?: number;
    providerId?: string;
    modelId?: string;
    studentId?: string;
    userRole?: string;
    userName?: string;
    scene?: CoachScene;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const { messages, gate } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("消息为空", 400);
  }

  // ---- 服务端范围闸门：失败关闭，不把无关/跨关内容交给通用模型 ----
  const scopeDecision = enforceCoachScope({
    gate,
    userRole: body.userRole === "teacher" ? "teacher" : "student",
    messages,
    scene: body.scene,
  });
  if (scopeDecision.action !== "allow") {
    console.log(
      `[chat-scope] action=${scopeDecision.action} reason=${scopeDecision.reason} gate=${gate ?? "missing"}`
    );
    return staticChatStream(scopeDecision.message);
  }

  // ---- 解析模型 ----
  const providerId = body.providerId || "deepseek";
  const modelId = body.modelId || "deepseek-chat";
  const provider = getProviderById(providerId);
  if (!provider) return jsonError(`未知的模型厂商: ${providerId}`, 400);
  const model = getModelById(providerId, modelId);
  if (!model) return jsonError(`未知的模型: ${providerId}/${modelId}`, 400);

  // ---- API Key ----
  let envKey = "";
  if (providerId === "deepseek") envKey = process.env.DEEPSEEK_API_KEY || "";
  else if (providerId === "glm") envKey = process.env.GLM_API_KEY || "";
  else envKey = process.env.LLM_API_KEY || "";
  const apiKey = (body.apiKey || envKey || "").trim();
  if (!apiKey || apiKey.length < 10) {
    return jsonError(
      "缺少有效的 API Key。请在 webapp/.env.local 中配置，或在界面「设置」里填入。",
      401
    );
  }

  // ---- 学生画像（动态注入）----
  let studentContext = "";
  if (body.studentId) {
    await recordSession(body.studentId);
    studentContext = await buildStudentContext(body.studentId);
  }

  // ---- 用户身份注入 ----
  const userRole = body.userRole || "";
  const userName = body.userName || "";
  const scopeBlock = buildCoachScopePrompt({
    gate,
    userRole: userRole || (studentContext ? "student" : ""),
    userName,
    messages,
    scene: body.scene,
  });

  // ---- 拼装 System Prompt ----
  const validGate = gate && gate >= 1 && gate <= 8 ? gate : undefined;
  const knowledgeBase = userRole === "teacher"
    ? getKnowledgeBaseText()
    : validGate
      ? getKnowledgeBaseText(validGate)
      : "（当前关卡未确定，暂不注入跨关知识；确认关卡后再提供对应资料。）";
  const systemPrompt =
    getBaseSystemPrompt() +
    scopeBlock +
    "\n\n以下是你可以引用的训练营知识库（高阶知识讲解、任务卡、评测手册、企业场景等），回答时按需引用，不要整段照抄:\n" +
    knowledgeBase +
    studentContext;

  console.log(
    `[chat] provider=${providerId} model=${modelId} gate=${gate ?? "full"} role=${userRole || "?"} student=${body.studentId?.slice(0, 8) ?? "anon"}`
  );

  // ---- 调用模型 ----
  const llmRes = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      stream: true,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!llmRes.ok || !llmRes.body) {
    const text = await llmRes.text().catch(() => "");
    return jsonError(
      `调用 ${provider.name} 失败（HTTP ${llmRes.status}）。请检查 API Key 是否正确、是否有余额。原始返回: ${text.slice(0, 300)}`,
      llmRes.status || 500
    );
  }

  return new Response(llmRes.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
