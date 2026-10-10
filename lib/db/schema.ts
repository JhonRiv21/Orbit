import {
  pgSchema,
  integer,
  text,
  doublePrecision,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const orbit = pgSchema("orbit");

// One row per active object: the latest general perturbations (GP) element
// set from CelesTrak. It is a snapshot, replaced on every ingest; positions
// are never stored, the browser propagates them from these elements.
export const satellites = orbit.table(
  "satellites",
  {
    noradId: integer("norad_id").primaryKey(),
    name: text("name").notNull(),
    intlDesignator: text("intl_designator"),
    category: text("category").notNull(),
    orbitClass: text("orbit_class").notNull(),
    epoch: timestamp("epoch", { withTimezone: true }).notNull(),
    meanMotion: doublePrecision("mean_motion").notNull(),
    eccentricity: doublePrecision("eccentricity").notNull(),
    inclination: doublePrecision("inclination").notNull(),
    raan: doublePrecision("raan").notNull(),
    argPericenter: doublePrecision("arg_pericenter").notNull(),
    meanAnomaly: doublePrecision("mean_anomaly").notNull(),
    bstar: doublePrecision("bstar").notNull(),
    meanMotionDot: doublePrecision("mean_motion_dot").notNull(),
    meanMotionDdot: doublePrecision("mean_motion_ddot").notNull(),
    elementSetNo: integer("element_set_no").notNull(),
    revAtEpoch: integer("rev_at_epoch").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("satellites_category_idx").on(t.category)],
);

export const ingestRuns = orbit.table(
  "ingest_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("running"),
    fetched: integer("fetched").notNull().default(0),
    upserted: integer("upserted").notNull().default(0),
    removed: integer("removed").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("ingest_runs_started_at_idx").on(t.startedAt)],
);
