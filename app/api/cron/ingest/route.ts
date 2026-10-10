import { timingSafeEqual } from "node:crypto";
import { runSatelliteIngest } from "@/lib/services/satellites";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || !auth || !matches(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runSatelliteIngest();
  if (!result.ok) {
    console.error("[cron/ingest] failed", result.error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json(result);
}
