"use client";

import { getFlatModelList } from "@/lib/models";

type Props = {
  providerId: string;
  modelId: string;
  onChange: (providerId: string, modelId: string) => void;
};

export default function ModelSelector({ providerId, modelId, onChange }: Props) {
  const models = getFlatModelList();
  const currentKey = `${providerId}:${modelId}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        模型选择
      </div>
      <select
        value={currentKey}
        onChange={(e) => {
          const [pid, mid] = e.target.value.split(":");
          if (pid && mid) onChange(pid, mid);
        }}
        className="w-full rounded-lg border border-border/50 bg-panel2/40 px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-accent2/60"
      >
        {/* 国内 */}
        <optgroup label="── 国内 ──">
          {models
            .filter((m) => !m.intl)
            .map((m) => (
              <option key={`${m.providerId}:${m.modelId}`} value={`${m.providerId}:${m.modelId}`}>
                {m.providerName} · {m.modelName}
              </option>
            ))}
        </optgroup>
        {/* 国际 */}
        <optgroup label="── 国际 ──">
          {models
            .filter((m) => m.intl)
            .map((m) => (
              <option key={`${m.providerId}:${m.modelId}`} value={`${m.providerId}:${m.modelId}`}>
                {m.providerName} · {m.modelName}
              </option>
            ))}
        </optgroup>
      </select>
    </div>
  );
}
