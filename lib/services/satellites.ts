import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { satellites, ingestRuns } from "@/lib/db/schema";
import { fetchActiveElements } from "@/lib/services/celestrak";
import { categoryOf, orbitClassOf } from "@/lib/utils/classify";
import { memoTtl } from "@/lib/utils/cache";
import { CATEGORIES } from "@/lib/assets/categories";
import type {
  Category,
  SatelliteFeed,
  SatelliteInsert,
  SatelliteTuple,
} from "@/lib/types/satellite";

const HOUR_MS = 60 * 60 * 1000;
// CelesTrak publishes new elements every 2 hours and blocks repeat downloads
// of unchanged data: a run inside this window is skipped, not executed.
const MIN_INTERVAL_MS = 2 * HOUR_MS;
// Safety brake: a download much smaller than what is stored is a source
// problem, not half the satellites decaying overnight. Keep the old snapshot.
const MIN_KEEP_RATIO = 0.5;
const BATCH = 500;
const READ_TTL_MS = 5 * 60 * 1000;

async function lastSuccessfulRun() {
  const [run] = await db
    .select({ finishedAt: ingestRuns.finishedAt })
    .from(ingestRuns)
    .where(eq(ingestRuns.status, "ok"))
    .orderBy(desc(ingestRuns.finishedAt))
    .limit(1);
  return run?.finishedAt ?? null;
}

async function storedCount() {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(satellites);
  return row?.n ?? 0;
}

export async function runSatelliteIngest() {
  const last = await lastSuccessfulRun();
  if (last && Date.now() - last.getTime() < MIN_INTERVAL_MS) {
    return { ok: true, skipped: "fresh", lastRun: last.toISOString() };
  }

  const [run] = await db
    .insert(ingestRuns)
    .values({})
    .returning({ id: ingestRuns.id });

  try {
    const result = await ingest();
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), status: "ok", ...result })
      .where(eq(ingestRuns.id, run.id));
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), status: "error", error: message })
      .where(eq(ingestRuns.id, run.id));
    return { ok: false, error: message };
  }
}

async function ingest() {
  const elements = await fetchActiveElements();
  const current = await storedCount();
  if (elements.length < current * MIN_KEEP_RATIO) {
    throw new Error(
      `Download has ${elements.length} objects, stored ${current}: snapshot kept`,
    );
  }

  const rows: SatelliteInsert[] = elements.map((e) => ({
    ...e,
    category: categoryOf(e.name, e.meanMotion),
    orbitClass: orbitClassOf(e.meanMotion, e.eccentricity),
  }));

  // One transaction: readers see the old snapshot or the new one, never a mix.
  const removed = await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH) {
      await tx
        .insert(satellites)
        .values(rows.slice(i, i + BATCH))
        .onConflictDoUpdate({
          target: satellites.noradId,
          set: {
            name: sql`excluded.name`,
            intlDesignator: sql`excluded.intl_designator`,
            category: sql`excluded.category`,
            orbitClass: sql`excluded.orbit_class`,
            epoch: sql`excluded.epoch`,
            meanMotion: sql`excluded.mean_motion`,
            eccentricity: sql`excluded.eccentricity`,
            inclination: sql`excluded.inclination`,
            raan: sql`excluded.raan`,
            argPericenter: sql`excluded.arg_pericenter`,
            meanAnomaly: sql`excluded.mean_anomaly`,
            bstar: sql`excluded.bstar`,
            meanMotionDot: sql`excluded.mean_motion_dot`,
            meanMotionDdot: sql`excluded.mean_motion_ddot`,
            elementSetNo: sql`excluded.element_set_no`,
            revAtEpoch: sql`excluded.rev_at_epoch`,
            updatedAt: sql`now()`,
          },
        });
    }
    // Objects no longer in the active list have decayed or been retired: the
    // upsert stamped every current row with now(), the transaction start, so
    // anything older was not in this download.
    const gone = await tx
      .delete(satellites)
      .where(lt(satellites.updatedAt, sql`now()`))
      .returning({ id: satellites.noradId });
    return gone.length;
  });

  return { fetched: elements.length, upserted: rows.length, removed };
}

// Precision of the TLE format itself: anything beyond is noise that only
// inflates the payload (~16k objects × 15 numbers).
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const sig = (value: number) => Number(value.toPrecision(5));

// Every reader within the TTL shares one query; concurrent cold requests share
// the same in-flight promise instead of opening a connection each.
export const getSatelliteFeed = memoTtl(async (): Promise<SatelliteFeed> => {
  const [rows, updated] = await Promise.all([
    db.select().from(satellites).orderBy(satellites.noradId),
    lastSuccessfulRun(),
  ]);
  const epochBase = Math.min(...rows.map((r) => r.epoch.getTime()));
  return {
    updatedAt: updated?.toISOString() ?? null,
    epochBase,
    satellites: rows.map((r): SatelliteTuple => [
      r.noradId,
      r.name,
      CATEGORIES.indexOf(r.category as Category),
      Number(r.intlDesignator?.slice(0, 4)) || 0,
      round((r.epoch.getTime() - epochBase) / 1000, 1),
      round(r.meanMotion, 8),
      round(r.eccentricity, 7),
      round(r.inclination, 4),
      round(r.raan, 4),
      round(r.argPericenter, 4),
      round(r.meanAnomaly, 4),
      sig(r.bstar),
      sig(r.meanMotionDot),
      sig(r.meanMotionDdot),
    ]),
  };
}, READ_TTL_MS);

export async function getPipelineHealth() {
  const [last, total, recentErrors] = await Promise.all([
    lastSuccessfulRun(),
    storedCount(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(ingestRuns)
      .where(
        and(
          eq(ingestRuns.status, "error"),
          gte(ingestRuns.startedAt, new Date(Date.now() - 24 * HOUR_MS)),
        ),
      ),
  ]);
  const ageHours = last ? (Date.now() - last.getTime()) / HOUR_MS : null;
  const level =
    total === 0 || ageHours === null || ageHours > 48
      ? "error"
      : ageHours > 12
        ? "stale"
        : "ok";
  return {
    level,
    satellites: total,
    lastIngest: last?.toISOString() ?? null,
    errorsLast24h: recentErrors[0]?.n ?? 0,
  };
}
