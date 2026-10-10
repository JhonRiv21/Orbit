import { getPipelineHealth } from "@/lib/services/satellites";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getPipelineHealth();
    return Response.json(health, {
      status: health.level === "error" ? 503 : 200,
    });
  } catch (err) {
    console.error("[api/health] failed to read pipeline state", err);
    return Response.json({ level: "error" }, { status: 503 });
  }
}
