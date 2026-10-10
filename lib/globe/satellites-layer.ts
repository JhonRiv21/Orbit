import * as THREE from "three";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_WEIGHT,
} from "@/lib/assets/categories";
import type { Category } from "@/lib/types/satellite";
import type { SatelliteMeta } from "./orbit-math";

// Every satellite is one point of a single draw call. Positions arrive from the
// worker once a second and are interpolated here every frame.

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute vec2 weight;
  attribute float category;
  uniform float pixelRatio;
  uniform float focus;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    bool lensed = focus >= 0.0;
    bool chosen = !lensed || abs(category - focus) < 0.5;
    float size = weight.x * (lensed && chosen ? 1.5 : 1.0);
    vAlpha = weight.y;
    if (lensed) vAlpha = chosen ? 1.0 : 0.07;
    // Points on the far side of the planet (visible past the limb) fade, so
    // the near half of each shell reads as the front.
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    if (dot(world, cameraPosition) < 0.0) vAlpha *= 0.45;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective only nudges the size: far away a point keeps its weight in
    // pixels, so GPS and the geostationary belt stay visible zoomed out.
    gl_PointSize = size * pixelRatio * clamp(5.0 / -mv.z, 0.85, 2.2);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.15, d));
    #include <colorspace_fragment>
  }
`;

export class SatellitesLayer {
  readonly points: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private from: Float32Array;
  private to: Float32Array;
  private fromTime = 0;
  private toTime = 0;
  private focus = -1;

  constructor(
    private meta: SatelliteMeta[],
    pixelRatio: number,
  ) {
    const n = meta.length;
    this.from = new Float32Array(n * 3);
    this.to = new Float32Array(n * 3);

    const colors = new Float32Array(n * 3);
    const weights = new Float32Array(n * 2);
    const categories = new Float32Array(n);
    const color = new THREE.Color();
    meta.forEach((m, i) => {
      color.set(CATEGORY_COLORS[m.category]).toArray(colors, i * 3);
      weights.set(CATEGORY_WEIGHT[m.category], i * 2);
      categories[i] = CATEGORIES.indexOf(m.category);
    });

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute("weight", new THREE.BufferAttribute(weights, 2));
    this.geometry.setAttribute(
      "category",
      new THREE.BufferAttribute(categories, 1),
    );
    // Bounds are the whole sky up to beyond geostationary: never recomputed.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    this.material = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: pixelRatio }, focus: { value: -1 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
  }

  // A new sample from the worker: the current interpolated state becomes the
  // start, so a late sample never makes points jump backwards.
  push(time: number, positions: Float32Array, now: number) {
    const current = this.geometry.getAttribute("position")
      .array as Float32Array;
    if (this.toTime) this.from.set(current);
    else this.from.set(positions);
    this.to = positions;
    this.fromTime = this.toTime ? now : time;
    this.toTime = time;
  }

  update(now: number) {
    if (!this.toTime) return;
    const span = this.toTime - this.fromTime;
    const k = span > 0 ? Math.min(1, (now - this.fromTime) / span) : 1;
    const out = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = out.array as Float32Array;
    for (let i = 0; i < array.length; i++) {
      array[i] = this.from[i] + (this.to[i] - this.from[i]) * k;
    }
    out.needsUpdate = true;
  }

  // Lens: one category stands out and the rest fade to ghosts; null clears it.
  setFocus(category: Category | null) {
    this.focus = category ? CATEGORIES.indexOf(category) : -1;
    this.material.uniforms.focus.value = this.focus;
  }

  isPickable(index: number) {
    return (
      this.focus < 0 ||
      CATEGORIES.indexOf(this.meta[index].category) === this.focus
    );
  }

  positionOf(index: number, out = new THREE.Vector3()) {
    return out.fromBufferAttribute(
      this.geometry.getAttribute("position") as THREE.BufferAttribute,
      index,
    );
  }
}
