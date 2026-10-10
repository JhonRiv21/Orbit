import { json2satrec, type SatRec } from "satellite.js";
import { CATEGORIES } from "@/lib/assets/categories";
import type {
  Category,
  OrbitClass,
  SatelliteFeed,
  SatelliteTuple,
} from "@/lib/types/satellite";

export const EARTH_RADIUS_KM = 6371;
const MU = 398600.4418; // km³/s², Earth's gravitational parameter

export type SatelliteMeta = {
  noradId: number;
  name: string;
  category: Category;
  orbitClass: OrbitClass;
  launchYear: number;
  epochMs: number;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
};

export function metaOf(
  tuple: SatelliteTuple,
  epochBase: number,
): SatelliteMeta {
  const [
    noradId,
    name,
    categoryIndex,
    launchYear,
    epochOffsetS,
    meanMotion,
    eccentricity,
    inclination,
  ] = tuple;
  return {
    noradId,
    name,
    category: CATEGORIES[categoryIndex] ?? "other",
    orbitClass: orbitClassOf(meanMotion, eccentricity),
    launchYear,
    epochMs: epochBase + epochOffsetS * 1000,
    meanMotion,
    eccentricity,
    inclination,
  };
}

// Same rule the server used to classify, repeated here so it does not travel.
export function orbitClassOf(
  meanMotion: number,
  eccentricity: number,
): OrbitClass {
  if (eccentricity > 0.25) return "heo";
  if (Math.abs(meanMotion - 1.0027) < 0.05) return "geo";
  if (meanMotion > 11.25) return "leo";
  return "meo";
}

export function satrecOf(tuple: SatelliteTuple, epochBase: number): SatRec {
  const [
    noradId,
    name,
    ,
    ,
    epochOffsetS,
    meanMotion,
    eccentricity,
    inclination,
    raan,
    argPericenter,
    meanAnomaly,
    bstar,
    meanMotionDot,
    meanMotionDdot,
  ] = tuple;
  const epoch = new Date(epochBase + epochOffsetS * 1000)
    .toISOString()
    .replace("Z", "");
  return json2satrec({
    OBJECT_NAME: name,
    OBJECT_ID: "",
    EPOCH: epoch,
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: eccentricity,
    INCLINATION: inclination,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argPericenter,
    MEAN_ANOMALY: meanAnomaly,
    NORAD_CAT_ID: noradId,
    ELEMENT_SET_NO: 999,
    BSTAR: bstar,
    MEAN_MOTION_DOT: meanMotionDot,
    MEAN_MOTION_DDOT: meanMotionDdot,
  });
}

export function feedMeta(feed: SatelliteFeed): SatelliteMeta[] {
  return feed.satellites.map((t) => metaOf(t, feed.epochBase));
}

// Orbit figures derived from the mean elements (Kepler's third law).
export function orbitFigures(meta: SatelliteMeta) {
  const periodMin = 1440 / meta.meanMotion;
  const n = (meta.meanMotion * 2 * Math.PI) / 86400;
  const semiMajorKm = Math.cbrt(MU / (n * n));
  return {
    periodMin,
    perigeeKm: semiMajorKm * (1 - meta.eccentricity) - EARTH_RADIUS_KM,
    apogeeKm: semiMajorKm * (1 + meta.eccentricity) - EARTH_RADIUS_KM,
  };
}
