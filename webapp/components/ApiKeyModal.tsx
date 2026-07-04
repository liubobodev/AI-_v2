"use client";

import { useState } from "react";

export default function ApiKeyModal({
  open,
  initialKey,
  providerName,
  onClose,
  onSave,
}: {
  open: boolean;
  initialKey: string;
  providerName: string;
  onClose: () => void;
  onSave: (key: string) => void;
}) {
  const [value, setValue] = useState(initialKey);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-6 shadow-glow">
        <h2 className="mb-1 text-lg font-bold text-white">
          设置 {providerName} API Key（可选）
        </h2>
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          服务端可配置默认 Key（webapp/.env.local 的 DEEPSEEK_API_KEY 或 LLM_API_KEY），
          <b className="text-accent2">留空即可使用服务端默认值</b>。
          此处填写仅用于覆盖（比如学生用自己的 Key），只保存在浏览器 localStorage。
        </p>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx（留空 = 用服务端默认）"
          className="mb-4 w-full rounded-lg border border-border bg-base px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent2"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSave(value.trim());
              onClose();
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-base hover:brightness-110"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
