import { getKnowledgeStats } from "@/lib/knowledgeBase";

export const runtime = "nodejs";

export async function GET() {
  const stats = getKnowledgeStats();
  return Response.json({
    ok: stats.missing.length === 0,
    foundCount: stats.found.length,
    missingCount: stats.missing.length,
    missing: stats.missing,
    vaultRoot: stats.vaultRoot,
  });
}
