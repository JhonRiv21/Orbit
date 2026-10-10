import { getSatelliteFeed } from "@/lib/services/satellites";

export const dynamic = "force-dynamic";

// The elements change at most every 2 hours: the CDN serves this for 30 minutes
// and keeps serving the stale copy while it refreshes, so visitors almost
// never reach the database.
const CACHE =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";

export async function GET() {
  try {
    const feed = await getSatelliteFeed();
    return Response.json(feed, { headers: { "Cache-Control": CACHE } });
  } catch (err) {
    console.error("[api/satellites] failed to read the snapshot", err);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
