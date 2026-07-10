import { NextRequest } from "next/server";
import { getAllGates, getGateData } from "@/lib/gateData";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gateParam = req.nextUrl.searchParams.get("gate");
  if (gateParam) {
    const n = parseInt(gateParam, 10);
    const data = getGateData(n);
    if (!data) return Response.json({ error: "invalid gate" }, { status: 400 });
    return Response.json({ gate: data });
  }
  return Response.json({ gates: getAllGates() });
}
