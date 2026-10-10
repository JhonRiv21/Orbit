export type Category =
  | "starlink"
  | "comms"
  | "navigation"
  | "stations"
  | "earth"
  | "science"
  | "other";

export type OrbitClass = "leo" | "meo" | "geo" | "heo";

// Orbital elements as CelesTrak publishes them (OMM keywords), already parsed.
export type GpElements = {
  noradId: number;
  name: string;
  intlDesignator: string | null;
  epoch: Date;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
  raan: number;
  argPericenter: number;
  meanAnomaly: number;
  bstar: number;
  meanMotionDot: number;
  meanMotionDdot: number;
  elementSetNo: number;
  revAtEpoch: number;
};

export type SatelliteInsert = GpElements & {
  category: Category;
  orbitClass: OrbitClass;
};

// Compact wire format for /api/satellites: one array per object, so ~16k
// objects stay small. The category travels as its index in CATEGORIES, the
// epoch as seconds after the feed's epochBase, and the orbit class is derived
// in the browser from the elements.
export type SatelliteTuple = [
  noradId: number,
  name: string,
  categoryIndex: number,
  launchYear: number,
  epochOffsetS: number,
  meanMotion: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argPericenter: number,
  meanAnomaly: number,
  bstar: number,
  meanMotionDot: number,
  meanMotionDdot: number,
];

export type SatelliteFeed = {
  updatedAt: string | null;
  epochBase: number;
  satellites: SatelliteTuple[];
};
