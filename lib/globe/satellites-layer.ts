import * as THREE from "three";
import { CATEGORY_COLORS } from "@/lib/assets/categories";
import type { SatelliteMeta } from "./orbit-math";

// Every satellite is one point of a single draw call. Positions arrive from the
// worker once a second and are interpolated here every frame.

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float visible;
  uniform float pixelRatio;
  uniform float size;
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    vColor = color;
    vVisible = visible;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(size * pixelRatio * (3.0 / -mv.z), 1.5 * pixelRatio, 4.0 * pixelRatio);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    if (vVisible < 0.5) discard;
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.2, d));
    #include <colorspace_fragment>
  }
`;

export class SatellitesLayer {
  readonly points: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private from: Float32Array;
  private to: Float32Array;
  private fromTime = 0;
  private toTime = 0;

  constructor(
    private meta: SatelliteMeta[],
    pixelRatio: number,
  ) {
    const n = meta.length;
    this.from = new Float32Array(n * 3);
    this.to = new Float32Array(n * 3);

    const colors = new Float32Array(n * 3);
    const color = new THREE.Color();
    meta.forEach((m, i) => {
      color.set(CATEGORY_COLORS[m.category]).toArray(colors, i * 3);
    });

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute(
      "visible",
      new THREE.BufferAttribute(new Float32Array(n).fill(1), 1),
    );
    // Bounds are the whole sky up to beyond geostationary: never recomputed.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({
        uniforms: { pixelRatio: { value: pixelRatio }, size: { value: 2.2 } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    );
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

  setVisible(predicate: (meta: SatelliteMeta) => boolean) {
    const attribute = this.geometry.getAttribute(
      "visible",
    ) as THREE.BufferAttribute;
    this.meta.forEach((m, i) => attribute.setX(i, predicate(m) ? 1 : 0));
    attribute.needsUpdate = true;
  }

  isVisible(index: number) {
    return this.geometry.getAttribute("visible").getX(index) > 0.5;
  }

  positionOf(index: number, out = new THREE.Vector3()) {
    return out.fromBufferAttribute(
      this.geometry.getAttribute("position") as THREE.BufferAttribute,
      index,
    );
  }
}
