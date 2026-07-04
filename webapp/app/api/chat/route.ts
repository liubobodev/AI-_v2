import { NextRequest } from "next/server";
import { getBaseSystemPrompt, getKnowledgeBaseText } from "@/lib/knowledgeBase";
import { getProviderById, getModelById } from "@/lib/models";
import { buildStudentContext, recordSession } from "@/lib/studentStore";

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
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const { messages, gate } = body;

  // ---- 解析模型 ----
  const providerId = body.providerId || "deepseek";
  const modelId = body.modelId || "deepseek-chat";
  const provider = getProviderById(providerId);
  if (!provider) return jsonError(`未知的模型厂商: ${providerId}`, 400);
  const model = getModelById(providerId, modelId);
  if (!model) return jsonError(`未知的模型: ${providerId}/${modelId}`, 400);

  // ---- API Key ----
  const envKey =
    providerId === "deepseek" ? process.env.DEEPSEEK_API_KEY : process.env.LLM_API_KEY;
  const apiKey = (body.apiKey || envKey || "").trim();
  if (!apiKey || apiKey.length < 10) {
    return jsonError(
      "缺少有效的 API Key。请在 webapp/.env.local 中配置，或在界面「设置」里填入。",
      401
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("消息为空", 400);
  }

  // ---- 学生画像（动态注入）----
  let studentContext = "";
  if (body.studentId) {
    recordSession(body.studentId);
    studentContext = buildStudentContext(body.studentId);
  }

  // ---- 用户身份注入 ----
  const userRole = body.userRole || "";
  const userName = body.userName || "";
  let identityBlock = "";
  if (userRole === "teacher") {
    identityBlock = `\n## 当前对话对象\n你正在和 **${userName || "一位教师"}**（教师身份）对话。对方是训练营的教师，负责管理学生和课程。请以专业教练的口吻交流，可讨论教学策略、课程设计、学生辅导等话题。`;
  } else if (userRole === "student") {
    identityBlock = `\n## 当前对话对象\n你正在和 **${userName || "一位学生"}**（学生身份）对话。对方是训练营的学员，正在完成闯关任务。请以鼓励、引导为主，结合关卡内容给出具体可操作的训练建议。`;
  } else if (studentContext) {
    // 有学生画像但无明确角色（兼容旧数据），从画像中提取
    identityBlock = `\n## 当前对话对象\n你正在和一位训练营学员对话。`;
  }

  // ---- 拼装 System Prompt ----
  const knowledgeBase = getKnowledgeBaseText(
    gate && gate >= 1 && gate <= 8 ? gate : undefined
  );
  const systemPrompt =
    getBaseSystemPrompt() +
    identityBlock +
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
