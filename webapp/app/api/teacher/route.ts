import { NextRequest } from "next/server";
import { verifyTeacher } from "@/lib/userStore";
import { getOrCreateProfile } from "@/lib/studentStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const teacherId = req.nextUrl.searchParams.get("teacherId") || "";
  if (!verifyTeacher(teacherId)) return Response.json({ error: "需要教师权限" }, { status: 403 });

  // 列出所有学生档案（通过扫描 data/students/ 目录）
  const fs = await import("fs");
  const path = await import("path");
  const dir = process.env.VERCEL ? "/tmp/ai-coach-students" : path.join(process.cwd(), "data", "students");

  const students: any[] = [];
  try {
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, f), "utf-8");
        const p = JSON.parse(raw);
        // 只返回摘要
        const completed = (p.gateProgress || []).filter((g: any) => g.status === "completed").length;
        students.push({
          studentId: p.studentId,
          role: p.role || "未设置",
          major: p.major || "",
          targetRole: p.targetRole || "",
          currentGate: p.currentGate,
          gatesCompleted: completed,
          sessionCount: p.sessionCount || 0,
          lastSessionAt: p.lastSessionAt || "",
          skillsCount: (p.skills || []).length,
          blocked: (p.gateProgress || []).some((g: any) => g.status === "blocked"),
        });
      } catch {}
    }
  } catch {}

  return Response.json({ students });
}
