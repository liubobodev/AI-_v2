import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST } from "../app/api/chat/route";

function request(content: string, gate = 6) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey: "test-key-long-enough",
      providerId: "deepseek",
      modelId: "deepseek-chat",
      userRole: "student",
      gate,
      messages: [{ role: "user", content }],
    }),
  });
}

test("irrelevant requests return a local SSE refusal without calling any model", async () => {
  const originalFetch = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async () => {
    modelCalls += 1;
    throw new Error("model must not be called");
  };

  try {
    const response = await POST(request("讲讲人性吧"));
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.match(body, /只回答 AI 上岗实战训练营/);
    assert.equal(modelCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cross-gate requests return a local redirect without calling any model", async () => {
  const originalFetch = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async () => {
    modelCalls += 1;
    throw new Error("model must not be called");
  };

  try {
    const response = await POST(request("混合检索和重排怎么设计？", 6));
    const body = await response.text();
    assert.match(body, /第 4 关/);
    assert.equal(modelCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a current-gate question still reaches the selected model", async () => {
  const originalFetch = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async () => {
    modelCalls += 1;
    return new Response(
      'data: {"choices":[{"delta":{"content":"本关回答"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } }
    );
  };

  try {
    const response = await POST(request("Agent 的失败重试怎么设计？", 6));
    assert.match(await response.text(), /本关回答/);
    assert.equal(modelCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
