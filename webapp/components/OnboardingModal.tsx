"use client";

import { useState } from "react";

const ROLES = [
  { id: "teacher", label: "教师", desc: "管理课程、设计教案、查看全班进度" },
  { id: "undergrad", label: "本科生", desc: "完成六关必过项目,拿到上岗证据" },
  { id: "master", label: "硕士生", desc: "八关全过,加架构对比与技术报告" },
  { id: "jobseeker", label: "求职冲刺者", desc: "直接进入面试模拟与作品包装" },
];

const GATES = [
  { n: 1, name: "侦察关", brief: "拆产品 + 拆 JD,定个人赛道" },
  { n: 2, name: "AI编程协作关", brief: "AI 编程工具规格驱动开发" },
  { n: 3, name: "Prompt资产关", brief: "结构化输出 + 模板版本管理" },
  { n: 4, name: "RAG工程关", brief: "带引用问答 + 召回率测试集" },
  { n: 5, name: "工具与MCP关", brief: "自建 MCP server 接真实系统" },
  { n: 6, name: "Agent系统关", brief: "规划/执行/恢复的智能体" },
  { n: 7, name: "Evals上线关", brief: "评测集 + 回归 + 成本 + 红队" },
  { n: 8, name: "发射关", brief: "GitHub 作品集 + 简历 + 终面" },
];

type Props = {
  onComplete: (role: string, gate: number) => void;
};

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [gate, setGate] = useState(1);

  if (step === 1) {
    return (
      <Overlay>
        <Card
          step={1}
          title="欢迎加入 AI 上岗实战训练营"
          subtitle="先告诉我你的身份,我会为你定制训练路径。"
        >
          <div className="grid grid-cols-1 gap-3">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRole(r.id);
                  setStep(2);
                }}
                className="flex flex-col items-start gap-1 rounded-xl border border-border/50 px-4 py-3.5 text-left transition hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="text-[14px] font-semibold text-text">{r.label}</span>
                <span className="text-[12px] text-muted">{r.desc}</span>
              </button>
            ))}
          </div>
        </Card>
      </Overlay>
    );
  }

  if (step === 2) {
    return (
      <Overlay>
        <Card
          step={2}
          title="你现在在哪一关?"
          subtitle="点击即可切换,随时可以回来调整。"
        >
          <div className="flex flex-col gap-2">
            {GATES.map((g) => (
              <button
                key={g.n}
                onClick={() => {
                  setGate(g.n);
                  setStep(3);
                }}
                className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[12px] font-bold text-accent">
                  {g.n}
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-text">{g.name}</div>
                  <div className="text-[12px] text-muted">{g.brief}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </Overlay>
    );
  }

  // step 3: 确认并开始
  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? role;
  const gateInfo = GATES.find((g) => g.n === gate);

  return (
    <Overlay>
      <Card
        step={3}
        title="一切就绪"
        subtitle="确认以下信息,教练会带你进入第一段训练对话。"
      >
        <div className="mb-4 space-y-2 rounded-xl border border-border/50 bg-panel/40 p-4">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">身份</span>
            <span className="font-semibold text-text">{roleLabel}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">当前关卡</span>
            <span className="font-semibold text-text">
              第 {gate} 关 · {gateInfo?.name}
            </span>
          </div>
        </div>
        <button
          onClick={() => onComplete(role, gate)}
          className="w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-base transition hover:brightness-110"
        >
          开始训练
        </button>
      </Card>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {children}
    </div>
  );
}

function Card({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border/60 bg-panel p-6 shadow-2xl">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
        第 {step} / 3 步
      </div>
      <h2 className="text-[18px] font-bold text-text">{title}</h2>
      <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
