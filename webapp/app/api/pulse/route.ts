import { NextRequest } from "next/server";
import { buildDailyPulse, renderPulseMarkdown } from "@/lib/pulse";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const override = req.nextUrl.searchParams.get("apiKey") || "";
  const format = req.nextUrl.searchParams.get("format") || "json";
  const apiKey = (override || process.env.GLM_API_KEY || "").trim();
  try {
    const result = await buildDailyPulse(apiKey);
    if (format === "md" || format === "markdown") {
      return new Response(renderPulseMarkdown(result), {
        status: 200,
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }
    return Response.json({ ok: true, ...result });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message ?? "未知错误" }, { status: 500 });
  }
}
