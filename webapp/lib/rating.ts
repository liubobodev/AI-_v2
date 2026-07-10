// 关卡评级引擎（纯函数，客户端安全）：把每关三模块换算成 未完成/及格/良好/优秀 四档。
import type { GateProgress, InterviewResult } from "./studentTypes";

export type Tier = 0 | 1 | 2 | 3; // 0 未完成, 1 及格, 2 良好, 3 优秀
export const TIER_LABEL = ["未完成", "及格", "良好", "优秀"] as const;

export type ModuleKind = "self" | "review" | "interview";

export type ModuleRating = {
  kind: ModuleKind;
  tier: Tier;
  score: number | null; // 有分数时展示；仅门点亮无分数时为 null
  done: boolean;        // 是否已提交完成（决定是否点亮）
  detail: string;       // tooltip 用的一句话说明
};

export type GateRating = {
  self: ModuleRating;
  review: ModuleRating;
  interview: ModuleRating;
  overall: Tier;
  overallDone: boolean; // 三模块是否都至少「及格」
  avgScore: number | null;
};

/** 分数→档位。默认 90+ 优秀 / 80+ 良好 / 60(or pass)+ 及格 */
function scoreToTier(score: number, passLine = 60): Tier {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= passLine) return 1;
  return 1; // 已提交但分数偏低，仍算「及格」下限，不退回未完成
}

/** 自检模块：优先看自检提交的 overallScore；否则看门是否点亮 */
function rateSelf(g?: GateProgress): ModuleRating {
  const sc = g?.selfCheckData;
  if (sc && (sc.status === "submitted" || sc.status === "reviewed") && typeof sc.overallScore === "number") {
    const tier = scoreToTier(sc.overallScore);
    return { kind: "self", tier, score: sc.overallScore, done: true, detail: `自检提交得分 ${sc.overallScore} 分` };
  }
  if (g?.doors?.selfCheck) {
    return { kind: "self", tier: 1, score: null, done: true, detail: "自检已完成（未提交评分）" };
  }
  return { kind: "self", tier: 0, score: null, done: false, detail: "尚未完成自检" };
}

/** 评审模块：取已通过的最高分提交 */
function rateReview(g?: GateProgress): ModuleRating {
  const subs = (g?.submissions ?? []).filter((s) => s.status === "approved" && typeof s.overallScore === "number");
  if (subs.length) {
    const best = Math.max(...subs.map((s) => s.overallScore as number));
    const tier = scoreToTier(best, 70);
    return { kind: "review", tier, score: best, done: true, detail: `项目评审最高 ${best} 分` };
  }
  if (g?.doors?.submissionApproved) {
    return { kind: "review", tier: 1, score: null, done: true, detail: "评审已通过" };
  }
  return { kind: "review", tier: 0, score: null, done: false, detail: "尚未通过项目评审" };
}

/** 面试模块：取该关最高面试分 */
function rateInterview(g: GateProgress | undefined, interviews: InterviewResult[]): ModuleRating {
  const gate = g?.gate;
  const rs = interviews.filter((r) => r.gate === gate && r.passed);
  if (rs.length) {
    const best = Math.max(...rs.map((r) => r.score));
    const tier = scoreToTier(best, 70);
    return { kind: "interview", tier, score: best, done: true, detail: `模拟面试最高 ${best} 分` };
  }
  if (g?.doors?.interviewPassed) {
    return { kind: "interview", tier: 1, score: null, done: true, detail: "面试已通过" };
  }
  return { kind: "interview", tier: 0, score: null, done: false, detail: "尚未通过模拟面试" };
}

export function computeGateRating(g: GateProgress | undefined, interviews: InterviewResult[]): GateRating {
  const self = rateSelf(g);
  const review = rateReview(g);
  const interview = rateInterview(g, interviews);
  const overallDone = self.done && review.done && interview.done;

  let overall: Tier = 0;
  let avgScore: number | null = null;
  if (overallDone) {
    const avgTier = (self.tier + review.tier + interview.tier) / 3;
    overall = (avgTier >= 2.5 ? 3 : avgTier >= 1.75 ? 2 : 1) as Tier;
    const scored = [self.score, review.score, interview.score].filter((s): s is number => typeof s === "number");
    avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  }
  return { self, review, interview, overall, overallDone, avgScore };
}
