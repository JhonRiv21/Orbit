import type { SatelliteFeed } from "@/lib/types/satellite";

// Messages between the globe and the propagation worker.

export type WorkerRequest =
  | { type: "init"; feed: SatelliteFeed }
  | { type: "positions"; time: number }
  | { type: "orbit"; index: number; time: number }
  | { type: "details"; index: number; time: number };

export type WorkerResponse =
  | { type: "ready"; count: number }
  | { type: "positions"; time: number; positions: Float32Array }
  | { type: "orbit"; index: number; time: number; points: Float32Array }
  | {
      type: "details";
      index: number;
      altitudeKm: number;
      speedKms: number;
      latDeg: number;
      lonDeg: number;
    };
