import { CATEGORY_RULES } from "@/lib/assets/categories";
import type { Category, OrbitClass } from "@/lib/types/satellite";

const SIDEREAL_DAY_REVS = 1.0027;

// GLONASS satellites fly under the generic "COSMOS" name; their medium orbit
// of ~2.13 revolutions per day is what gives them away.
const GLONASS_REVS = [2.0, 2.3];

export function categoryOf(name: string, meanMotion: number): Category {
  const upper = name.toUpperCase();
  for (const [category, rule] of CATEGORY_RULES) {
    if (rule.test(upper)) return category;
  }
  if (
    upper.startsWith("COSMOS") &&
    meanMotion > GLONASS_REVS[0] &&
    meanMotion < GLONASS_REVS[1]
  ) {
    return "navigation";
  }
  return "other";
}

// By shape and period: very eccentric orbits first (Molniya, transfer),
// then geosynchronous (one revolution per sidereal day), then the period
// boundary of 128 minutes that separates low orbit from medium.
export function orbitClassOf(
  meanMotion: number,
  eccentricity: number,
): OrbitClass {
  if (eccentricity > 0.25) return "heo";
  if (Math.abs(meanMotion - SIDEREAL_DAY_REVS) < 0.05) return "geo";
  if (meanMotion > 11.25) return "leo";
  return "meo";
}
