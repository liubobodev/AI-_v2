import { getKnowledgeStats } from "@/lib/knowledgeBase";
import { checkEnv } from "@/lib/envCheck";

export const runtime = "nodejs";

export async function GET() {
  const stats = getKnowledgeStats();
  const env = checkEnv();
  return Response.json({
    ok: stats.missing.length === 0 && env.ok,
    foundCount: stats.found.length,
    missingCount: stats.missing.length,
    missing: stats.missing,
    vaultRoot: stats.vaultRoot,
    env,
  });
}
