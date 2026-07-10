"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GateData } from "@/lib/gateTypes";
import type { GateProgress, SelfCheckItem, ArchiveEntry, StudentProfile, RewardDelta } from "@/lib/studentTypes";
import ScoreCard from "@/components/ScoreCard";
import { burstConfetti } from "@/lib/confetti";
import { GATE_SCAFFOLD } from "@/lib/gateScaffold";
import { EVIDENCE_REQUIREMENTS, PROJECT_CATEGORIES, PROJECT_SCORE_CRITERIA, scoreProject } from "@/lib/enterpriseTraining";

type Tab = "brief" | "advanced" | "checklist" | "evidence" | "archive";

function MD({ children }: { children: string }) {
  return (
    <div className="prose-coach text-[13.5px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || "（暂无内容）"}</ReactMarkdown>
    </div>
  );
}

export default function GateWarRoom({
  gateData,
  gateProgress,
  profile,
  studentId,
  providerId,
  modelId,
  apiKey,
  onAskCoach,
  onStartInterview,
  hasInterviewDraft = false,
  onChecklistToggle,
  onSubmissionDone,
}: {
  gateData: GateData;
  gateProgress: GateProgress | undefined;
  profile?: StudentProfile | null;
  studentId: string;
  providerId: string;
  modelId: string;
  apiKey: string;
  onAskCoach: (message: string) => void;
  onStartInterview?: () => void;
  hasInterviewDraft?: boolean;
  onChecklistToggle: (itemKey: string, checked: boolean, total: number) => void;
  onSubmissionDone: (profile?: StudentProfile, reward?: RewardDelta) => void;
}) {
  const [tab, setTab] = useState<Tab>("brief");
  const [link, setLink] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [helpTitle, setHelpTitle] = useState("");
  const [helpDetail, setHelpDetail] = useState("");
  const [helpSaving, setHelpSaving] = useState(false);
  const existingProject = profile?.projectSelection;
  const [projectCategory, setProjectCategory] = useState(existingProject?.categoryId ?? PROJECT_CATEGORIES[0]?.id ?? "");
  const [projectName, setProjectName] = useState(existingProject?.projectName ?? "");
  const [targetUser, setTargetUser] = useState(existingProject?.targetUser ?? "");
  const [dataSource, setDataSource] = useState(existingProject?.dataSource ?? "");
  const [projectScores, setProjectScores] = useState<Record<string, number>>(existingProject?.scores ?? {});
  const [savingProject, setSavingProject] = useState(false);
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, { status?: string; link?: string; note?: string }>>({});
  const [savingEvidence, setSavingEvidence] = useState<Record<string, boolean>>({});

  // 自检状态
  const [selfCheckItems, setSelfCheckItems] = useState<SelfCheckItem[]>(
    () => gateProgress?.selfCheckData?.items ?? []
  );
  const [selfCheckStatus, setSelfCheckStatus] = useState<string>(
    () => gateProgress?.selfCheckData?.status ?? "writing"
  );
  const [selfCheckSaving, setSelfCheckSaving] = useState<Record<string, boolean>>({});
  const [selfCheckSubmitting, setSelfCheckSubmitting] = useState(false);
  const [selfCheckErr, setSelfCheckErr] = useState<string | null>(null);

  // 展开/折叠每个输入项
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  // 输入内容缓存（不与 selfCheckItems 同步渲染，避免刷新闪烁）
  const [inputCache, setInputCache] = useState<Record<string, string>>(() => {
    const cache: Record<string, string> = {};
    for (const item of (gateProgress?.selfCheckData?.items ?? [])) {
      cache[item.key] = item.content;
    }
    return cache;
  });

  const checklist = gateProgress?.checklist ?? {};
  const submissions = gateProgress?.submissions ?? [];
  const doors = gateProgress?.doors ?? { selfCheck: false, submissionApproved: false, interviewPassed: false };
  const archive = gateProgress?.archive ?? [];
  const teacherNotes = archive.filter((entry) => entry.type === "ai_feedback" && entry.title.includes("教师"));
  const learnerTrack = profile?.role === "master" ? "master" : profile?.role === "jobseeker" ? "jobseeker" : "undergrad";
  const evidenceItems = EVIDENCE_REQUIREMENTS.filter((item) => (item.gate === 0 || item.gate === gateData.gate) && item.requiredFor.includes(learnerTrack));
  const existingEvidence = gateProgress?.evidencePackage ?? [];
  const scaffold = GATE_SCAFFOLD[gateData.gate];
  const reviewedSubmissions = submissions.filter((s) => s.status === "approved" || s.status === "rejected");
  const hasAnyArchiveRecord = archive.length > 0 || reviewedSubmissions.length > 0;

  // 获取验收标准作为自检项
  const acceptanceItems = gateData.acceptanceCriteria.map((c, i) => ({
    key: "c" + i,
    criterion: c,
  }));

  // ====== 自检：暂存单项 ======
  async function handleSaveItem(itemKey: string) {
    const content = (inputCache[itemKey] ?? "").trim();
    if (!content) return;
    setSelfCheckSaving((prev) => ({ ...prev, [itemKey]: true }));
    try {
      const res = await fetch("/api/student", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          action: "save_selfcheck_item",
          gate: gateData.gate,
          itemKey,
          content,
        }),
      });
      const data = await res.json();
      if (data.profile) {
        // 更新本地 items
        setSelfCheckItems((prev) => {
          const existing = prev.find((i) => i.key === itemKey);
          if (existing) {
            return prev.map((i) => i.key === itemKey ? { ...i, content, savedAt: new Date().toISOString() } : i);
          }
          return [...prev, { key: itemKey, criterion: "", content, savedAt: new Date().toISOString() }];
        });
        setSelfCheckStatus("saved");
        // 折叠该输入区
        setExpandedItems((prev) => ({ ...prev, [itemKey]: false }));
        // 小礼花
        burstConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, 8);
      }
    } catch {
      setSelfCheckErr("暂存失败，请重试");
    }
    setSelfCheckSaving((prev) => ({ ...prev, [itemKey]: false }));
  }

  // ====== 自检：提交全部到 AI 质检 ======
  async function handleSubmitSelfCheck() {
    setSelfCheckSubmitting(true);
    setSelfCheckErr(null);
    try {
      const res = await fetch("/api/selfcheck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          gate: gateData.gate,
          providerId,
          modelId,
          apiKey,
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setSelfCheckStatus("reviewed");
        setSelfCheckItems(data.result.items.map((r: any) => ({
          ...selfCheckItems.find((i) => i.key === r.key),
          score: r.score,
          feedback: r.feedback,
          passed: r.passed,
        })));
        burstConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, 28);
        onSubmissionDone(data.profile, data.reward);
      } else {
        setSelfCheckErr(data.error || "质检失败");
      }
    } catch {
      setSelfCheckErr("网络错误，请确认服务已启动");
    }
    setSelfCheckSubmitting(false);
  }

  // ====== 历史提交评审 ======
  async function submitLink() {
    if (!link.trim() || reviewing) return;
    setReviewing(true);
    setReviewErr(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, gate: gateData.gate, link: link.trim(), providerId, modelId, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setReviewErr(data.error || "提交失败");
      } else if (!data.ok) {
        setReviewErr(data.error || "评审未通过解析");
      } else {
        setLink("");
        onSubmissionDone(data.profile, data.reward);
        if (data.result?.passed) {
          burstConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, 28);
        }
      }
    } catch {
      setReviewErr("网络错误，请确认服务已启动");
    }
    setReviewing(false);
  }

  async function requestTeacherHelp() {
    const title = helpTitle.trim();
    const detail = helpDetail.trim();
    if (!title || !detail || helpSaving) return;
    setHelpSaving(true);
    setReviewErr(null);
    try {
      const res = await fetch("/api/student", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          action: "request_teacher_help",
          gate: gateData.gate,
          requestTitle: title,
          requestDetail: detail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setReviewErr(data.error || "求助请求发送失败");
      } else {
        setHelpTitle("");
        setHelpDetail("");
        onSubmissionDone(data.profile);
      }
    } catch {
      setReviewErr("网络错误，求助请求发送失败");
    }
    setHelpSaving(false);
  }

  // 判读是否所有项都已暂存
  const allItemsSaved = acceptanceItems.length > 0 &&
    acceptanceItems.every((item) => {
      const content = (inputCache[item.key] ?? "").trim();
      return content.length >= 3;
    });

  const reviewedItems = selfCheckItems.filter((i) => i.score !== undefined);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-3 py-4 md:px-6 md:py-6">
      {/* 头部 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            第 {gateData.gate} 关 {gateData.weekRange && "· " + gateData.weekRange}
          </div>
          <h1 className="text-lg font-extrabold text-white md:text-xl">{gateData.name}</h1>
        </div>
        <div className="flex gap-1.5 text-[11px]">
          <DoorPill on={doors.selfCheck} label="自检" />
          <DoorPill on={doors.submissionApproved} label="评审" />
          <DoorPill on={doors.interviewPassed} label="面试" />
        </div>
      </div>

      {/* 标签页 */}
      <div className="mb-4 flex gap-1 border-b border-border/50 overflow-x-auto">
        {([
          ["brief", "📋 任务简报"],
          ["advanced", "🎓 高阶知识"],
          ["checklist", "✅ 验收自检"],
          ["evidence", "🧾 上岗证据包"],
          ["archive", "📁 闯关档案"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "btn-spring border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap",
              tab === t ? "border-accent text-accent" : "border-transparent text-muted hover:text-text",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {tab === "brief" && (
          <div className="flex flex-col gap-4">
            {scaffold && (
              <Block title="承前启后">
                <div className="grid gap-2 md:grid-cols-3">
                  <FlowNote label="上一环" text={scaffold.previous} />
                  <FlowNote label="本关" text={scaffold.current} accent />
                  <FlowNote label="下一环" text={scaffold.next} />
                </div>
              </Block>
            )}
            <Block title="目标"><MD>{gateData.objective}</MD></Block>
            {gateData.jdRef && (
              <Block title="JD 原文对标">
                <div className="rounded-lg border-l-2 border-accent/50 bg-panel2/40 px-3 py-2 text-[13px] italic text-muted">
                  <MD>{gateData.jdRef}</MD>
                </div>
              </Block>
            )}
            {gateData.techStack && <Block title="技术栈"><MD>{gateData.techStack}</MD></Block>}
            {gateData.tasks.length > 0 && (
              <Block title="课堂任务">
                <ol className="flex flex-col gap-1.5">
                  {gateData.tasks.map((t, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] text-text/90">
                      <span className="font-mono text-accent2">{i + 1}.</span> {t}
                    </li>
                  ))}
                </ol>
              </Block>
            )}
            {scaffold && (
              <Block title="本关交付物">
                <ul className="flex flex-col gap-1.5">
                  {scaffold.deliverables.map((item, i) => (
                    <li key={i} className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-[13px] text-text/90">
                      {item}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {scaffold && (
              <Block title="考核细则">
                <div className="grid gap-2 md:grid-cols-3">
                  {scaffold.scoring.map((item, i) => (
                    <div key={i} className="rounded-lg border border-accent2/20 bg-accent2/5 px-3 py-2 text-[12.5px] text-text/90">
                      {item}
                    </div>
                  ))}
                </div>
              </Block>
            )}
            {gateData.resumeSentence && (
              <Block title="简历句模板">
                <div className="rounded-lg border border-accent2/30 bg-accent2/5 px-3 py-2.5 text-[13px] text-text">
                  <MD>{gateData.resumeSentence}</MD>
                </div>
              </Block>
            )}
            {gateData.toolUsage && <Block title="双工具用法"><MD>{gateData.toolUsage}</MD></Block>}
            {gateData.gate === 1 && (
              <ProjectDiagnostic
                categoryId={projectCategory}
                projectName={projectName}
                targetUser={targetUser}
                dataSource={dataSource}
                scores={projectScores}
                saving={savingProject}
                savedScore={existingProject?.totalScore}
                savedVerdict={existingProject?.verdict}
                onCategory={setProjectCategory}
                onProjectName={setProjectName}
                onTargetUser={setTargetUser}
                onDataSource={setDataSource}
                onScore={(key, value) => setProjectScores((prev) => ({ ...prev, [key]: value }))}
                onSave={async () => {
                  setSavingProject(true);
                  try {
                    const res = await fetch("/api/student", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        studentId,
                        action: "save_project_selection",
                        projectSelection: { categoryId: projectCategory, projectName, targetUser, dataSource, scores: projectScores },
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.profile) onSubmissionDone(data.profile);
                  } finally {
                    setSavingProject(false);
                  }
                }}
              />
            )}
          </div>
        )}

        {tab === "advanced" && (
          <div className="flex flex-col gap-4">
            {gateData.positioning && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent">教师高阶讲解 · 定位</div>
                <MD>{gateData.positioning}</MD>
              </div>
            )}
            {gateData.knowledgePoints.map((kp, i) => (
              <KnowledgeCard key={i} title={kp.title} body={kp.body} onAsk={() => onAskCoach("帮我理解这一关高阶知识点「" + kp.title + "」，结合我当前的项目举个例子。")} />
            ))}
            {gateData.extraCompetency.map((group, gi) => (
              <div key={gi} className="glass rounded-xl !border-accent2/30 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent2">
                  能力体系补充 · {group.fileTitle}
                </div>
                <div className="flex flex-col gap-3">
                  {group.points.map((kp, i) => (
                    <KnowledgeCard key={i} title={kp.title} body={kp.body} compact onAsk={() => onAskCoach("帮我理解「" + kp.title + "」，结合我当前第 " + gateData.gate + " 关的项目说明怎么用。")} />
                  ))}
                </div>
              </div>
            ))}
            {gateData.commonMistakes.length > 0 && (
              <Block title="⚠️ 常见误区">
                <ul className="flex flex-col gap-1.5">
                  {gateData.commonMistakes.map((m, i) => (
                    <li key={i} className="rounded-md bg-warn/10 px-2.5 py-1.5 text-[13px] text-warn">{m}</li>
                  ))}
                </ul>
              </Block>
            )}
            {gateData.realHook && (
              <Block title="🎯 本关实战钩子（直接改验收标准）">
                <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-[13px]">
                  <MD>{gateData.realHook}</MD>
                </div>
              </Block>
            )}
            {gateData.sources.length > 0 && (
              <Block title="来源锚点">
                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {gateData.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-accent2 underline hover:text-accent">
                        {s.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
          </div>
        )}

        {tab === "evidence" && (
          <div className="flex flex-col gap-4">
            <Block title={gateData.gate === 8 ? "发射关完整证据包" : "本关企业上岗证据"}>
              <div className="mb-3 rounded-lg border border-accent2/25 bg-accent2/5 px-3 py-2 text-[12.5px] text-text/85">
                每项证据都要能被面试官追问：看得到、跑得通、评得出、讲得清。硕士路径会额外要求技术报告和研究问题。
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {evidenceItems.map((req) => {
                  const saved = existingEvidence.find((item) => item.key === req.key);
                  const draft = evidenceDrafts[req.key] ?? {};
                  const status = (draft.status || saved?.status || "missing") as "missing" | "draft" | "submitted" | "approved";
                  const linkValue = draft.link ?? saved?.link ?? "";
                  const noteValue = draft.note ?? saved?.note ?? "";
                  return (
                    <div key={req.key} className="rounded-xl border border-border/50 bg-panel/35 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-text">{req.label}</div>
                        <span className={"rounded-full px-2 py-0.5 text-[11px] " + evidenceStatusClass(status)}>{evidenceStatusLabel(status)}</span>
                      </div>
                      <div className="mb-2 text-[12px] text-muted">{req.description}</div>
                      <select
                        value={status}
                        onChange={(e) => setEvidenceDrafts((prev) => ({ ...prev, [req.key]: { ...prev[req.key], status: e.target.value } }))}
                        className="mb-2 w-full rounded-lg border border-border bg-base px-2 py-1.5 text-[12px] text-text"
                      >
                        <option value="missing">未准备</option>
                        <option value="draft">草稿</option>
                        <option value="submitted">已提交</option>
                        <option value="approved">已确认</option>
                      </select>
                      <input
                        value={linkValue}
                        onChange={(e) => setEvidenceDrafts((prev) => ({ ...prev, [req.key]: { ...prev[req.key], link: e.target.value } }))}
                        placeholder="证据链接，如 GitHub、文档、视频、报告"
                        className="mb-2 w-full rounded-lg border border-border bg-base px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent2"
                      />
                      <textarea
                        value={noteValue}
                        onChange={(e) => setEvidenceDrafts((prev) => ({ ...prev, [req.key]: { ...prev[req.key], note: e.target.value } }))}
                        placeholder="说明这份证据证明了什么能力"
                        rows={2}
                        className="w-full resize-y rounded-lg border border-border bg-base px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent2"
                      />
                      <button
                        disabled={savingEvidence[req.key]}
                        onClick={async () => {
                          setSavingEvidence((prev) => ({ ...prev, [req.key]: true }));
                          try {
                            const res = await fetch("/api/student", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                studentId,
                                action: "save_evidence_item",
                                gate: gateData.gate,
                                evidenceItem: { key: req.key, label: req.label, status, link: linkValue, note: noteValue },
                              }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (data.profile) onSubmissionDone(data.profile);
                          } finally {
                            setSavingEvidence((prev) => ({ ...prev, [req.key]: false }));
                          }
                        }}
                        className="mt-2 rounded-md border border-accent2/40 px-2.5 py-1.5 text-[12px] font-medium text-accent2 hover:bg-accent2/10 disabled:opacity-50"
                      >
                        {savingEvidence[req.key] ? "保存中..." : "保存证据"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Block>
          </div>
        )}

        {/* ====== ✅ 验收自检（全新设计）====== */}
        {tab === "checklist" && (
          <div className="flex flex-col gap-5">
            {teacherNotes.length > 0 && (
              <Block title="老师跟进">
                <div className="flex flex-col gap-2">
                  {teacherNotes.slice().reverse().slice(0, 2).map((note) => (
                    <div key={note.id} className="rounded-lg border border-accent2/30 bg-accent2/5 px-3 py-2 text-[12.5px] text-text/90">
                      <div className="mb-1 font-semibold text-accent2">{note.title}{typeof note.score === "number" ? ` · ${note.score}分` : ""}</div>
                      <div className="whitespace-pre-wrap">{note.detail}</div>
                    </div>
                  ))}
                </div>
              </Block>
            )}
            {scaffold && (
              <Block title="验收证据要求">
                <div className="grid gap-2 md:grid-cols-3">
                  {scaffold.evidence.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-[12.5px] text-text/90">
                      {item}
                    </div>
                  ))}
                </div>
              </Block>
            )}
            {/* ---- 第一部分：带输入的自检清单 ---- */}
            <Block title="① 自检清单 — 填写完成证明并提交 AI 质检">
              <div className="mb-3 text-[12px] text-muted bg-panel2/30 rounded-lg px-3 py-2">
                📝 每项验收标准都需要你填写对应的完成证明（粘贴链接、代码片段、分析思路等），
                填完后点击「暂存本条」保存，全部填完后再点「提交自检」触发 AI 质检。
              </div>

              <div className="flex flex-col gap-3">
                {acceptanceItems.map((item, i) => {
                  const saved = selfCheckItems.find((si) => si.key === item.key);
                  const isSaved = !!saved?.savedAt;
                  const isExpanded = expandedItems[item.key] !== false; // default expanded if never collapsed
                  const currentContent = inputCache[item.key] ?? "";

                  return (
                    <div key={item.key} className="glass rounded-xl border border-border/50 overflow-hidden">
                      {/* 标题行 */}
                      <div className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
                        onClick={() => setExpandedItems((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      >
                        {/* 状态灯 */}
                        <span className={
                          "mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border transition-colors duration-300 " +
                          (saved?.passed === true ? "bg-green-500 border-green-600 shadow-glow-sm" :
                           saved?.passed === false ? "bg-red-500 border-red-600" :
                           isSaved ? "bg-yellow-400 border-yellow-500 shadow-glow-sm" :
                           "bg-gray-700 border-gray-600")
                        } />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text">{item.criterion}</div>
                          {isSaved && (
                            <div className="mt-0.5 text-[11px] text-yellow-400">
                              ✅ 已暂存 · {saved?.score !== undefined ? "评分: " + saved.score + "分 · " + (saved.passed ? "通过" : "待改进") : "等待质检"}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-muted">{isExpanded ? "收起 ▲" : "展开 ▼"}</span>
                      </div>

                      {/* 输入区 */}
                      {isExpanded && (
                        <div className="border-t border-border/40 px-3 py-3">
                          <textarea
                            className="w-full rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none focus:border-accent2 placeholder:text-muted/50 resize-y min-h-[80px]"
                            placeholder={buildSelfCheckPlaceholder(gateData.gate, i, item.criterion)}
                            value={currentContent}
                            onChange={(e) => setInputCache((prev) => ({ ...prev, [item.key]: e.target.value }))}
                            rows={4}
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-muted">{currentContent.length} 字</span>
                            <button
                              onClick={() => handleSaveItem(item.key)}
                              disabled={selfCheckSaving[item.key] || currentContent.trim().length < 3}
                              className={
                                "btn-spring rounded-lg px-3 py-1.5 text-[12px] font-semibold transition " +
                                (isSaved
                                  ? "border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                                  : "border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20")
                              }
                            >
                              {selfCheckSaving[item.key] ? "保存中…" : isSaved ? "✅ 已暂存 · 更新" : "💾 暂存本条"}
                            </button>
                          </div>

                          {/* AI 反馈（审核后显示） */}
                          {saved?.feedback && (
                            <div className={"mt-2 rounded-lg border px-3 py-2 text-[12.5px] " + (saved.passed ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-orange-500/30 bg-orange-500/10 text-orange-300")}>
                              <span className="font-semibold">AI 质检：{saved.score}分</span>
                              <div className="mt-1">{saved.feedback}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 自检状态指示器 */}
              <div className="mt-3 flex items-center gap-2 text-[12px]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-700 border border-gray-600" /> 未填
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 border border-yellow-500" /> 已暂存
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 border border-green-600" /> 质检通过
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 border border-red-600" /> 需改进
              </div>

              {/* 提交自检 */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSubmitSelfCheck}
                  disabled={selfCheckSubmitting || !allItemsSaved || selfCheckStatus === "reviewed"}
                  className={
                    "btn-spring rounded-xl px-5 py-2.5 text-[13px] font-semibold transition " +
                    (selfCheckStatus === "reviewed"
                      ? "bg-green-600/30 text-green-300 border border-green-500/40 cursor-default"
                      : "bg-accent text-base shadow-glow-teal hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed")
                  }
                >
                  {selfCheckSubmitting ? "AI 质检中…" :
                   selfCheckStatus === "reviewed" ? "✅ 自检已通过" :
                   !allItemsSaved ? "请先填写并暂存所有项" :
                   "🚀 提交自检 → AI 逐项质检"}
                </button>
                {selfCheckStatus === "reviewed" && selfCheckItems.some((i) => i.score !== undefined) && (
                  <span className="text-[13px] text-green-400">
                    综合评分：{Math.round(selfCheckItems.reduce((s, i) => s + (i.score || 0), 0) / selfCheckItems.filter(i => i.score !== undefined).length)}分
                    {" · "}{selfCheckItems.filter(i => i.passed).length}/{selfCheckItems.filter(i => i.score !== undefined).length} 项通过
                  </span>
                )}
              </div>
              {selfCheckErr && (
                <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
                  {selfCheckErr}
                </div>
              )}
            </Block>

            {/* ---- 第二部分：提交 GitHub 评审 ---- */}
            <Block title="② 提交 GitHub 仓库 → AI 按本关 rubric 逐条评审">
              <div className="flex gap-2">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitLink()}
                  placeholder="https://github.com/你的用户名/仓库名"
                  className="flex-1 rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none focus:border-accent2 placeholder:text-muted/50"
                />
                <button
                  onClick={submitLink}
                  disabled={reviewing || !link.trim()}
                  className="btn-spring shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-base shadow-glow-teal hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reviewing ? "评审中…" : "提交评审"}
                </button>
              </div>
              {reviewErr && (
                <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
                  {reviewErr}
                </div>
              )}
              {submissions.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {submissions.slice().reverse().map((s) => (
                    <ScoreCard key={s.id} submission={s} />
                  ))}
                </div>
              )}
            </Block>

            {/* ---- 第三部分：面试质询 ---- */}
            <Block title="③ 面试质询（对答面试追问预演）">
              <ul className="mb-3 flex flex-col gap-1.5">
                {gateData.interviewQuestions.map((q, i) => (
                  <li key={i} className="text-[13px] text-text/90">· {q}</li>
                ))}
              </ul>
              <button
                onClick={() => onStartInterview ? onStartInterview() : onAskCoach("面试我。")}
                className="btn-spring glow-hover rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] font-medium text-accent hover:bg-accent/20"
              >
                🎤 {hasInterviewDraft ? "继续模拟面试（接上次问题）" : "开始模拟面试（切到聊天面板）"}
              </button>
            </Block>

            <Block title="④ 向老师请求指导">
              <div className="rounded-lg border border-border/40 bg-base/25 p-3">
                <input
                  value={helpTitle}
                  onChange={(e) => setHelpTitle(e.target.value)}
                  placeholder="请求标题，如：第4关召回率评测卡住了"
                  className="mb-2 w-full rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none placeholder:text-muted/50 focus:border-accent2"
                />
                <textarea
                  value={helpDetail}
                  onChange={(e) => setHelpDetail(e.target.value)}
                  placeholder="说明你已经做了什么、卡在哪里、希望老师看什么证据。"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none placeholder:text-muted/50 focus:border-accent2"
                />
                <button
                  onClick={requestTeacherHelp}
                  disabled={helpSaving || !helpTitle.trim() || !helpDetail.trim()}
                  className="mt-2 rounded-lg border border-accent2/40 px-3 py-2 text-[12px] font-medium text-accent2 hover:bg-accent2/10 disabled:opacity-40"
                >
                  {helpSaving ? "发送中..." : "发送给绑定老师"}
                </button>
              </div>
            </Block>
          </div>
        )}

        {/* ====== 📁 闯关档案 ====== */}
        {tab === "archive" && (
          <div className="flex flex-col gap-4">
            <div className="mb-2 text-[12px] text-muted bg-panel2/30 rounded-lg px-3 py-2">
              📂 本关所有实战记录在这里归档，包括自检反馈、项目评审、面试记录、AI 追问等，可追溯每次成长实锤。
            </div>

            {!hasAnyArchiveRecord && (
              <div className="flex flex-col items-center justify-center py-12 text-muted">
                <span className="text-4xl mb-3">📭</span>
                <div className="text-[14px] font-medium">暂无闯关档案</div>
                <div className="text-[12px] mt-1">完成本关的自检、提交评审、模拟面试后，记录会自动归档到这里</div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {archive.slice().reverse().map((entry, i) => (
                <ArchiveCard key={entry.id || i} entry={entry} />
              ))}
            </div>

            {/* 如有旧版提交记录也作为档案展示 */}
            {reviewedSubmissions.map((s) => (
              <div key={s.id} className="glass rounded-xl border border-border/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12px] font-semibold text-accent2">📎 GitHub 仓库评审</div>
                  <span className={"text-[11px] px-2 py-0.5 rounded-full " + (s.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400")}>
                    {s.status === "approved" ? "通过" : "未过"}
                  </span>
                </div>
                <div className="text-[11px] text-muted mb-1">{s.submittedAt.slice(0, 16).replace("T", " ")}</div>
                <a href={s.link} target="_blank" rel="noreferrer" className="text-[12px] text-accent2 underline break-all">{s.link}</a>
                {s.overallScore !== undefined && (
                  <div className="mt-1 text-[13px]">
                    <span className="font-semibold text-text">评分：{s.overallScore}分</span>
                    {s.topStrength && <div className="text-[12px] text-green-400 mt-0.5">💪 {s.topStrength}</div>}
                    {s.topGap && <div className="text-[12px] text-orange-400">⚠️ {s.topGap}</div>}
                    {s.nextStep && <div className="text-[12px] text-accent2">👉 {s.nextStep}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== 子组件 ======

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function FlowNote({ label, text, accent = false }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={"rounded-lg border px-3 py-2 " + (accent ? "border-accent/40 bg-accent/10" : "border-border/50 bg-panel2/30")}>
      <div className={"mb-1 text-[11px] font-semibold " + (accent ? "text-accent" : "text-muted")}>{label}</div>
      <div className="text-[12.5px] leading-relaxed text-text/90">{text}</div>
    </div>
  );
}

function buildSelfCheckPlaceholder(gate: number, index: number, criterion: string) {
  const scaffold = GATE_SCAFFOLD[gate];
  const evidence = scaffold?.evidence[index % Math.max(1, scaffold.evidence.length)];
  return [
    "请针对这条验收标准写完成证明：",
    criterion,
    evidence ? "\n建议包含：" + evidence : "",
    "\n可粘贴：链接、截图说明、关键表格、代码片段、评测结果、失败复盘。",
  ].join("\n");
}

function evidenceStatusLabel(status: string) {
  if (status === "approved") return "已确认";
  if (status === "submitted") return "已提交";
  if (status === "draft") return "草稿";
  return "未准备";
}

function evidenceStatusClass(status: string) {
  if (status === "approved") return "bg-green-500/20 text-green-300";
  if (status === "submitted") return "bg-accent2/15 text-accent2";
  if (status === "draft") return "bg-yellow-500/15 text-yellow-200";
  return "bg-border/40 text-muted";
}

function ProjectDiagnostic({
  categoryId,
  projectName,
  targetUser,
  dataSource,
  scores,
  saving,
  savedScore,
  savedVerdict,
  onCategory,
  onProjectName,
  onTargetUser,
  onDataSource,
  onScore,
  onSave,
}: {
  categoryId: string;
  projectName: string;
  targetUser: string;
  dataSource: string;
  scores: Record<string, number>;
  saving: boolean;
  savedScore?: number;
  savedVerdict?: string;
  onCategory: (value: string) => void;
  onProjectName: (value: string) => void;
  onTargetUser: (value: string) => void;
  onDataSource: (value: string) => void;
  onScore: (key: string, value: number) => void;
  onSave: () => void;
}) {
  const category = PROJECT_CATEGORIES.find((item) => item.id === categoryId) ?? PROJECT_CATEGORIES[0];
  const scored = scoreProject(scores);
  return (
    <Block title="选题诊断器（企业上岗级）">
      <div className="rounded-xl border border-accent2/25 bg-accent2/5 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select value={categoryId} onChange={(e) => onCategory(e.target.value)} className="rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text">
            {PROJECT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input value={projectName} onChange={(e) => onProjectName(e.target.value)} placeholder="项目名称" className="rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none focus:border-accent2" />
          <input value={targetUser} onChange={(e) => onTargetUser(e.target.value)} placeholder="真实用户是谁" className="rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none focus:border-accent2" />
          <input value={dataSource} onChange={(e) => onDataSource(e.target.value)} placeholder="可接入资料/数据/API" className="rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-text outline-none focus:border-accent2" />
        </div>
        {category && (
          <div className="mt-3 rounded-lg border border-border/40 bg-base/30 px-3 py-2 text-[12px] text-muted">
            企业版：{category.enterpriseVersion}。技术栈：{category.stack.join(" / ")}。评测：{category.evalMetrics.join(" / ")}。
          </div>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {PROJECT_SCORE_CRITERIA.map((item) => (
            <label key={item.key} className="rounded-lg border border-border/40 bg-base/25 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-text">{item.label}</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={scores[item.key] ?? ""}
                  onChange={(e) => onScore(item.key, Math.max(0, Math.min(5, Number(e.target.value))))}
                  className="w-14 rounded-md border border-border bg-base px-2 py-1 text-[12px] text-text"
                />
              </div>
              <div className="text-[11px] text-muted">{item.question}</div>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] text-text">
            当前评分：<span className="font-bold text-accent2">{scored.total}/{scored.max}</span>
            <span className="ml-2 text-muted">{scored.verdict}</span>
            {savedScore !== undefined && <span className="ml-2 text-green-300">已保存：{savedScore}分 · {savedVerdict}</span>}
          </div>
          <button onClick={onSave} disabled={saving || !projectName.trim()} className="rounded-lg border border-accent2/40 px-3 py-2 text-[12px] font-medium text-accent2 hover:bg-accent2/10 disabled:opacity-40">
            {saving ? "保存中..." : "保存选题诊断"}
          </button>
        </div>
      </div>
    </Block>
  );
}

function DoorPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={["rounded-full border px-2 py-0.5", on ? "border-accent2/50 bg-accent2/10 text-accent2" : "border-border/50 text-muted"].join(" ")}>
      {on ? "●" : "○"} {label}
    </span>
  );
}

function KnowledgeCard({ title, body, compact, onAsk }: { title: string; body: string; compact?: boolean; onAsk: () => void }) {
  return (
    <div className={["glass card-lift rounded-xl", compact ? "p-2.5" : "p-3.5"].join(" ")}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[13.5px] font-bold text-white">{title}</div>
        <button onClick={onAsk} className="btn-spring shrink-0 rounded-md border border-border/50 px-2 py-0.5 text-[11px] text-muted hover:border-accent2/40 hover:text-accent2">
          问教练 →
        </button>
      </div>
      <MD>{body}</MD>
    </div>
  );
}

/** 闯关档案卡片：展示单条记录 */
function ArchiveCard({ entry }: { entry: ArchiveEntry }) {
  const typeIcons: Record<string, string> = {
    self_check: "✅",
    submission_review: "📎",
    interview: "🎤",
    ai_feedback: "🤖",
  };
  const typeLabels: Record<string, string> = {
    self_check: "自检评估",
    submission_review: "仓库评审",
    interview: "模拟面试",
    ai_feedback: "AI 反馈",
  };

  const isPassed = entry.passed === true;
  const isFailed = entry.passed === false;
  const hasScore = entry.score !== undefined;

  return (
    <div className={"glass rounded-xl border p-3 " + (isPassed ? "border-green-500/30" : isFailed ? "border-orange-500/30" : "border-border/50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{typeIcons[entry.type] || "📄"}</span>
          <div>
            <div className="text-[13px] font-semibold text-text">{entry.title}</div>
            <div className="text-[11px] text-muted">
              {typeLabels[entry.type] || entry.type} · {entry.date.slice(0, 16).replace("T", " ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasScore && (
            <span className={"text-[13px] font-bold " + (isPassed ? "text-green-400" : isFailed ? "text-orange-400" : "text-muted")}>
              {entry.score}分
            </span>
          )}
          {isPassed && <span className="text-[11px] text-green-400">通过</span>}
          {isFailed && <span className="text-[11px] text-orange-400">待改进</span>}
        </div>
      </div>
      {entry.detail && (
        <div className="mt-1.5 text-[12.5px] text-text/80">{entry.detail}</div>
      )}
      {entry.aiFeedback && (
        <div className="mt-1.5 rounded-lg bg-accent/5 border border-accent/20 px-2.5 py-1.5 text-[12px] text-accent2/90">
          🤖 {entry.aiFeedback}
        </div>
      )}
      {(entry as any).content && (
        <details className="mt-1.5">
          <summary className="text-[11px] text-muted cursor-pointer hover:text-text">查看提交内容</summary>
          <pre className="mt-1 rounded-lg bg-base/80 px-2.5 py-2 text-[12px] text-text/70 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
            {(entry as any).content}
          </pre>
        </details>
      )}
    </div>
  );
}
