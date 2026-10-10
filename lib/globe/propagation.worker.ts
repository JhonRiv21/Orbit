/// <reference lib="webworker" />
import {
  propagate,
  gstime,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  degreesToRadians,
  radiansToDegrees,
  type SatRec,
} from "satellite.js";
import { EARTH_RADIUS_KM, satrecOf } from "./orbit-math";
import type {
  Observer,
  SkyObject,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

// SGP4 for every object runs here, off the main thread: ~16k propagations a
// second would otherwise cost the globe frames.

const ISS_NORAD = 25544;
const MIN_PASS_ELEVATION = 10;
const PASS_SEARCH_H = 24;
const PASS_STEP_S = 30;
const ORBIT_SAMPLES = 256;

let satrecs: (SatRec | null)[] = [];
let issIndex = -1;

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

// The typings promise a result, but SGP4 returns null (or a falsy position)
// when an orbit has degenerated; those objects are left out.
function eciAt(satrec: SatRec, date: Date) {
  const result = propagate(satrec, date) as ReturnType<typeof propagate> | null;
  const p = result?.position;
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    !Number.isFinite(p.z)
  ) {
    return null;
  }
  return p;
}

// ECEF kilometres to scene units (Earth radius = 1). Scene axes: y is north,
// x points at longitude 0 and -z at longitude 90°E.
function writeScene(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
) {
  out[i * 3] = x / EARTH_RADIUS_KM;
  out[i * 3 + 1] = z / EARTH_RADIUS_KM;
  out[i * 3 + 2] = -y / EARTH_RADIUS_KM;
}

function positions(time: number) {
  const date = new Date(time);
  const gmst = gstime(date);
  const out = new Float32Array(satrecs.length * 3);
  satrecs.forEach((satrec, i) => {
    const eci = satrec && eciAt(satrec, date);
    if (!eci) return; // stays at the origin, hidden inside the Earth
    const ecf = eciToEcf(eci, gmst);
    writeScene(out, i, ecf.x, ecf.y, ecf.z);
  });
  post({ type: "positions", time, positions: out }, [out.buffer]);
}

// One full revolution in the inertial frame, expressed in the Earth-fixed
// frame of `time`. The globe turns the ring as the Earth rotates under it.
function orbit(index: number, time: number) {
  const satrec = satrecs[index];
  const points = new Float32Array(ORBIT_SAMPLES * 3);
  if (satrec) {
    const periodMs = ((2 * Math.PI) / satrec.no) * 60_000;
    const gmst = gstime(new Date(time));
    for (let s = 0; s < ORBIT_SAMPLES; s++) {
      const eci = eciAt(
        satrec,
        new Date(time + (periodMs * s) / (ORBIT_SAMPLES - 1)),
      );
      if (!eci) continue;
      const ecf = eciToEcf(eci, gmst);
      writeScene(points, s, ecf.x, ecf.y, ecf.z);
    }
  }
  post({ type: "orbit", index, time, points }, [points.buffer]);
}

function details(index: number, time: number) {
  const satrec = satrecs[index];
  const date = new Date(time);
  const result =
    satrec && (propagate(satrec, date) as ReturnType<typeof propagate> | null);
  if (!satrec || !result || !eciAt(satrec, date)) return;
  const geo = eciToGeodetic(result.position, gstime(date));
  const v = result.velocity;
  post({
    type: "details",
    index,
    altitudeKm: geo.height,
    speedKms: Math.hypot(v.x, v.y, v.z),
    latDeg: radiansToDegrees(geo.latitude),
    lonDeg: radiansToDegrees(geo.longitude),
  });
}

function lookFrom(observer: Observer) {
  return {
    latitude: degreesToRadians(observer.latDeg),
    longitude: degreesToRadians(observer.lonDeg),
    height: 0,
  };
}

function sky(observer: Observer, time: number) {
  const date = new Date(time);
  const gmst = gstime(date);
  const site = lookFrom(observer);
  const above: SkyObject[] = [];
  satrecs.forEach((satrec, index) => {
    const eci = satrec && eciAt(satrec, date);
    if (!eci) return;
    const look = ecfToLookAngles(site, eciToEcf(eci, gmst));
    if (look.elevation <= 0) return;
    above.push({
      index,
      elevationDeg: radiansToDegrees(look.elevation),
      azimuthDeg: radiansToDegrees(look.azimuth),
      rangeKm: look.rangeSat,
    });
  });
  above.sort((a, b) => b.elevationDeg - a.elevationDeg);
  post({
    type: "sky",
    overhead: above.length,
    highest: above.slice(0, 8),
    issPass: issPass(site, time),
  });
}

// Next window where the ISS climbs above 10° over the observer.
function issPass(site: ReturnType<typeof lookFrom>, from: number) {
  const satrec = satrecs[issIndex];
  if (!satrec) return null;
  let rise = 0;
  let peak = 0;
  let maxElevation = -90;
  for (
    let t = from;
    t < from + PASS_SEARCH_H * 3_600_000;
    t += PASS_STEP_S * 1000
  ) {
    const date = new Date(t);
    const eci = eciAt(satrec, date);
    if (!eci) return null;
    const elevation = radiansToDegrees(
      ecfToLookAngles(site, eciToEcf(eci, gstime(date))).elevation,
    );
    if (elevation >= MIN_PASS_ELEVATION) {
      if (!rise) rise = t;
      if (elevation > maxElevation) {
        maxElevation = elevation;
        peak = t;
      }
    } else if (rise) {
      return { rise, peak, set: t, maxElevationDeg: maxElevation };
    }
  }
  return null;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      satrecs = message.feed.satellites.map((tuple) => {
        try {
          return satrecOf(tuple, message.feed.epochBase);
        } catch {
          return null; // malformed elements: that object is simply not drawn
        }
      });
      issIndex = message.feed.satellites.findIndex((t) => t[0] === ISS_NORAD);
      post({ type: "ready", count: satrecs.length });
      break;
    case "positions":
      positions(message.time);
      break;
    case "orbit":
      orbit(message.index, message.time);
      break;
    case "details":
      details(message.index, message.time);
      break;
    case "sky":
      sky(message.observer, message.time);
      break;
  }
};
