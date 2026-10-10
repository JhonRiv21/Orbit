import type { GpElements } from "@/lib/types/satellite";

// One download of the "active" group per ingest. CelesTrak refreshes GP data
// every 2 hours and blocks clients that fetch more often or keep retrying
// after errors, so this never retries: a failure is reported and the next
// scheduled run tries again.
const SOURCE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv";
const TIMEOUT_MS = 60_000;
const USER_AGENT = "Orbit (portfolio project; github.com/JhonRiv21/Orbit)";

const REQUIRED = [
  "OBJECT_NAME",
  "OBJECT_ID",
  "EPOCH",
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "NORAD_CAT_ID",
  "ELEMENT_SET_NO",
  "REV_AT_EPOCH",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
] as const;

export async function fetchActiveElements(): Promise<GpElements[]> {
  // Development reads a saved download so working on the app never spends
  // CelesTrak's one-download-per-update allowance.
  const fixture = process.env.CELESTRAK_FIXTURE;
  if (process.env.NODE_ENV === "development" && fixture) {
    const { readFile } = await import("node:fs/promises");
    return parseGpCsv(await readFile(fixture, "utf8"));
  }

  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`CelesTrak responded ${response.status}`);
  }
  return parseGpCsv(await response.text());
}

// Rows that fail validation are dropped one by one; a malformed line must not
// take down the whole snapshot.
export function parseGpCsv(csv: string): GpElements[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = (lines.shift() ?? "").split(",");
  const col = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  const missing = REQUIRED.filter((name) => !(name in col));
  if (missing.length) {
    throw new Error(
      `Unexpected CelesTrak format, missing: ${missing.join(", ")}`,
    );
  }

  const rows: GpElements[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    if (cells.length !== header.length) continue;
    const num = (name: (typeof REQUIRED)[number]) => Number(cells[col[name]]);
    const epoch = new Date(`${cells[col.EPOCH]}Z`);
    const row: GpElements = {
      noradId: num("NORAD_CAT_ID"),
      name: (cells[col.OBJECT_NAME] ?? "").trim().slice(0, 64),
      intlDesignator: cells[col.OBJECT_ID]?.trim() || null,
      epoch,
      meanMotion: num("MEAN_MOTION"),
      eccentricity: num("ECCENTRICITY"),
      inclination: num("INCLINATION"),
      raan: num("RA_OF_ASC_NODE"),
      argPericenter: num("ARG_OF_PERICENTER"),
      meanAnomaly: num("MEAN_ANOMALY"),
      bstar: num("BSTAR"),
      meanMotionDot: num("MEAN_MOTION_DOT"),
      meanMotionDdot: num("MEAN_MOTION_DDOT"),
      elementSetNo: num("ELEMENT_SET_NO"),
      revAtEpoch: num("REV_AT_EPOCH"),
    };
    if (isValid(row)) rows.push(row);
  }
  return rows;
}

function isValid(row: GpElements): boolean {
  const numbers = [
    row.meanMotion,
    row.eccentricity,
    row.inclination,
    row.raan,
    row.argPericenter,
    row.meanAnomaly,
    row.bstar,
    row.meanMotionDot,
    row.meanMotionDdot,
    row.elementSetNo,
    row.revAtEpoch,
  ];
  return (
    Number.isInteger(row.noradId) &&
    row.noradId > 0 &&
    row.name.length > 0 &&
    !Number.isNaN(row.epoch.getTime()) &&
    numbers.every(Number.isFinite) &&
    row.meanMotion > 0 &&
    row.eccentricity >= 0 &&
    row.eccentricity < 1
  );
}
