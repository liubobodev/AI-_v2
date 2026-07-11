import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoachScopePrompt,
  detectCoachScene,
} from "../lib/chatScope";

test("student coaching is locked to the selected gate", () => {
  const prompt = buildCoachScopePrompt({
    gate: 4,
    userRole: "student",
    userName: "小林",
    messages: [{ role: "user", content: "混合检索怎么设计？" }],
  });

  assert.match(prompt, /当前关卡：第 4 关 · RAG 工程关/);
  assert.match(prompt, /只回答与当前关卡/);
  assert.match(prompt, /Prompt 资产关/);
  assert.match(prompt, /请切换到第 3 关/);
});

test("out-of-role requests get a concise refusal protocol", () => {
  const prompt = buildCoachScopePrompt({
    gate: 2,
    userRole: "student",
    messages: [{ role: "user", content: "推荐一只股票" }],
  });

  assert.match(prompt, /与 AI 上岗实战训练无关/);
  assert.match(prompt, /明确拒绝/);
  assert.match(prompt, /不要尝试回答题目本身/);
});

test("interview marker switches to the gate interview scene", () => {
  const scene = detectCoachScene([
    { role: "user", content: "【第 6 关面试】请开始模拟面试。" },
  ]);

  assert.equal(scene, "gate_interview");
  assert.match(
    buildCoachScopePrompt({ gate: 6, userRole: "student", messages: [] , scene}),
    /当前场景：第 6 关模拟面试/
  );
});

test("teacher mode may discuss teaching across gates but stays in coach identity", () => {
  const prompt = buildCoachScopePrompt({
    gate: 1,
    userRole: "teacher",
    messages: [{ role: "user", content: "帮我设计八关课程衔接" }],
  });

  assert.match(prompt, /教师教研场景/);
  assert.match(prompt, /可以跨关讨论/);
  assert.match(prompt, /仍不得回答训练营职责之外/);
});

test("invalid or missing gate does not silently grant full-course student scope", () => {
  const prompt = buildCoachScopePrompt({
    userRole: "student",
    messages: [{ role: "user", content: "我该做什么？" }],
  });

  assert.match(prompt, /当前关卡未确定/);
  assert.match(prompt, /先询问用户所在关卡/);
});
