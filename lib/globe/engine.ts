import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createEarth, sunDirection } from "./earth";
import { SatellitesLayer } from "./satellites-layer";
import type { SatelliteMeta } from "./orbit-math";
import type { Observer, WorkerRequest, WorkerResponse } from "./protocol";
import type { SatelliteFeed } from "@/lib/types/satellite";

export type Details = Extract<WorkerResponse, { type: "details" }>;
export type Sky = Extract<WorkerResponse, { type: "sky" }>;

type Callbacks = {
  onReady: () => void;
  onHover: (index: number | null, x: number, y: number) => void;
  onSelect: (index: number | null) => void;
  onDetails: (details: Details) => void;
  onSky: (sky: Sky) => void;
};

// Fixed 30 fps: a steady 30 reads smoother than a rate that alternates between
// 60 and 30, and it behaves the same on phones and weak GPUs. The interval
// snaps to whole display refreshes so it holds on 60, 120 and 144 Hz screens.
const TARGET_MS = 1000 / 30;
const FRAME_SLACK_MS = 2;
const SAMPLE_MS = 1000;
const PICK_MS = 80;
const CLICK_TOLERANCE_PX = 5;
const ORBIT_VIEW_TILT = 0.45; // rad off the orbital plane: the ring reads as an ellipse
const SIDEREAL_RATE = (2 * Math.PI) / 86_164_090; // Earth's rotation, rad/ms

export class GlobeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private worker: Worker;
  private earth: ReturnType<typeof createEarth>;
  private layer: SatellitesLayer | null = null;
  private selected: number | null = null;
  private marker: THREE.Points;
  private orbitLine: THREE.Line;
  private orbitTime = 0;
  private observer: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = { x: 0, y: 0 };
  private lastPick = 0;
  private hovered: number | null = null;
  private pendingFocus: number | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private flight: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    start: number;
  } | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: Callbacks,
  ) {
    const compact = Math.min(innerWidth, innerHeight) < 700;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.75 : 2));
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
    this.camera.position.copy(initialCameraPosition(compact ? 4.2 : 3.4));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 14;
    this.controls.rotateSpeed = 0.5;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener("start", () => {
      this.controls.autoRotate = false;
      this.flight = null;
    });

    this.earth = createEarth(new THREE.TextureLoader(), compact);
    this.scene.add(this.earth.group, createStars());

    this.marker = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(3), 3),
      ),
      new THREE.PointsMaterial({
        map: ringTexture(),
        size: 26,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.marker.visible = false;
    this.orbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.orbitLine.visible = false;
    this.observer = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    this.observer.visible = false;
    this.scene.add(this.marker, this.orbitLine, this.observer);

    this.worker = new Worker(
      new URL("./propagation.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
      this.receive(e.data);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.startLoop();
  }

  load(feed: SatelliteFeed, meta: SatelliteMeta[]) {
    this.layer = new SatellitesLayer(meta, this.renderer.getPixelRatio());
    this.scene.add(this.layer.points);
    this.send({ type: "init", feed });
  }

  setFilter(predicate: (meta: SatelliteMeta) => boolean) {
    this.layer?.setVisible(predicate);
    if (
      this.selected !== null &&
      this.layer &&
      !this.layer.isVisible(this.selected)
    )
      this.select(null);
  }

  select(index: number | null) {
    this.selected = index;
    this.pendingFocus = null;
    this.marker.visible = index !== null;
    this.orbitLine.visible = false;
    if (index === null) return;
    this.controls.autoRotate = false;
    const now = Date.now();
    this.send({ type: "orbit", index, time: now });
    this.send({ type: "details", index, time: now });
  }

  // Selects and flies the camera round to the satellite. The flight starts
  // when its orbit arrives: viewed from straight above the satellite the ring
  // would be edge-on, a flat line, so the camera tilts off the orbital plane.
  focus(index: number) {
    this.select(index);
    this.pendingFocus = index;
  }

  private flyToOrbit(points: Float32Array) {
    if (!this.layer || this.selected === null) return;
    const satellite = this.layer.positionOf(this.selected);
    if (satellite.lengthSq() === 0) return;
    const quarter = Math.floor(points.length / 3 / 4);
    const a = new THREE.Vector3().fromArray(points, 0);
    const b = new THREE.Vector3().fromArray(points, quarter * 3);
    const normal = a.cross(b).normalize();
    if (normal.dot(this.camera.position) < 0) normal.negate();
    const distance = Math.max(satellite.length() * 2.5, 3.3);
    this.flyTo(
      satellite
        .normalize()
        .multiplyScalar(Math.cos(ORBIT_VIEW_TILT))
        .addScaledVector(normal, Math.sin(ORBIT_VIEW_TILT))
        .setLength(distance),
    );
  }

  locate(observer: Observer) {
    const position = fromLatLon(observer.latDeg, observer.lonDeg, 1.002);
    this.observer.position.copy(position);
    this.observer.visible = true;
    this.flyTo(
      position.clone().setLength(Math.max(this.camera.position.length(), 2.6)),
    );
    this.send({ type: "sky", observer, time: Date.now() });
  }

  private flyTo(to: THREE.Vector3) {
    this.controls.autoRotate = false;
    this.flight = {
      from: this.camera.position.clone(),
      to,
      start: performance.now(),
    };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.worker.terminate();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private send(message: WorkerRequest) {
    this.worker.postMessage(message);
  }

  private receive(message: WorkerResponse) {
    if (this.disposed) return;
    switch (message.type) {
      case "ready":
        this.send({ type: "positions", time: Date.now() });
        this.callbacks.onReady();
        break;
      case "positions":
        this.layer?.push(message.time, message.positions, Date.now());
        break;
      case "orbit":
        if (message.index !== this.selected) return;
        this.orbitLine.geometry.dispose();
        this.orbitLine.geometry = new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.BufferAttribute(message.points, 3),
        );
        this.orbitTime = message.time;
        this.orbitLine.rotation.y = 0;
        this.orbitLine.visible = true;
        if (this.pendingFocus === message.index) {
          this.pendingFocus = null;
          this.flyToOrbit(message.points);
        }
        break;
      case "details":
        if (message.index === this.selected) this.callbacks.onDetails(message);
        break;
      case "sky":
        this.callbacks.onSky(message);
        break;
    }
  }

  private startLoop() {
    let nextFrameAt = 0;
    let lastTick = 0;
    let vsyncMs = 1000 / 60;
    let refreshesPerFrame = 2;
    let nextSample = 0;
    let nextDetails = 0;

    this.renderer.setAnimationLoop((now: number) => {
      const tick = now - lastTick;
      lastTick = now;
      if (tick > 3 && tick < 25) vsyncMs += (tick - vsyncMs) * 0.05;
      const ideal = TARGET_MS / vsyncMs;
      if (Math.abs(ideal - refreshesPerFrame) > 0.6)
        refreshesPerFrame = Math.max(1, Math.round(ideal));
      if (now < nextFrameAt - FRAME_SLACK_MS) return;
      nextFrameAt += refreshesPerFrame * vsyncMs;
      if (nextFrameAt < now) nextFrameAt = now + refreshesPerFrame * vsyncMs;

      const clock = Date.now();
      // Ask for the state one second ahead and glide towards it meanwhile.
      if (this.layer && clock >= nextSample) {
        nextSample = clock + SAMPLE_MS;
        this.send({ type: "positions", time: clock + SAMPLE_MS });
      }
      if (this.selected !== null && clock >= nextDetails) {
        nextDetails = clock + SAMPLE_MS;
        this.send({ type: "details", index: this.selected, time: clock });
      }

      sunDirection(clock, this.earth.sun);
      this.layer?.update(clock);
      // The orbit ring is fixed in space while the Earth turns beneath it.
      if (this.orbitLine.visible)
        this.orbitLine.rotation.y = -(clock - this.orbitTime) * SIDEREAL_RATE;
      if (this.selected !== null && this.layer) {
        const attribute = this.marker.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const p = this.layer.positionOf(this.selected);
        attribute.setXYZ(0, p.x, p.y, p.z);
        attribute.needsUpdate = true;
      }
      this.fly(now);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private fly(now: number) {
    if (!this.flight) return;
    const k = Math.min(1, (now - this.flight.start) / 1400);
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const length = THREE.MathUtils.lerp(
      this.flight.from.length(),
      this.flight.to.length(),
      eased,
    );
    this.camera.position
      .copy(this.flight.from)
      .normalize()
      .lerp(this.flight.to.clone().normalize(), eased)
      .setLength(length);
    if (k >= 1) this.flight = null;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Nearest visible satellite under the pointer, ignoring the ones behind the
  // Earth: the ray must reach the point before it reaches the globe.
  private pick(clientX: number, clientY: number): number | null {
    if (!this.layer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points.threshold =
      this.camera.position.length() * 0.012;
    const earthHit = this.raycaster.ray.intersectSphere(
      new THREE.Sphere(new THREE.Vector3(), 1),
      new THREE.Vector3(),
    );
    const earthDistance = earthHit
      ? earthHit.distanceTo(this.raycaster.ray.origin)
      : Infinity;
    let best: { index: number; distanceToRay: number } | null = null;
    for (const hit of this.raycaster.intersectObject(this.layer.points)) {
      const index = hit.index ?? -1;
      if (
        index < 0 ||
        !this.layer.isVisible(index) ||
        hit.distance > earthDistance
      )
        continue;
      const distanceToRay = hit.distanceToRay ?? Infinity;
      if (!best || distanceToRay < best.distanceToRay)
        best = { index, distanceToRay };
    }
    return best?.index ?? null;
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    const now = performance.now();
    if (now - this.lastPick < PICK_MS) return;
    this.lastPick = now;
    const index = this.pick(e.clientX, e.clientY);
    this.renderer.domElement.style.cursor = index !== null ? "pointer" : "";
    if (index !== this.hovered || index !== null)
      this.callbacks.onHover(index, e.clientX, e.clientY);
    this.hovered = index;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(
      e.clientX - this.pointerDown.x,
      e.clientY - this.pointerDown.y,
    );
    if (moved > CLICK_TOLERANCE_PX) return;
    const index = this.pick(e.clientX, e.clientY);
    this.select(index);
    this.callbacks.onSelect(index);
  };

  private onPointerLeave = () => {
    if (this.hovered !== null) this.callbacks.onHover(null, 0, 0);
    this.hovered = null;
  };
}

function fromLatLon(latDeg: number, lonDeg: number, radius: number) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

// First view over the visitor's own longitude, guessed from the time zone
// offset: no permission needed, and the globe opens on familiar ground.
function initialCameraPosition(distance: number) {
  const lonDeg = THREE.MathUtils.clamp(
    -new Date().getTimezoneOffset() / 4,
    -180,
    180,
  );
  return fromLatLon(18, lonDeg, distance);
}

function ringTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStars() {
  const count = 2500;
  const positions = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection()
      .multiplyScalar(90)
      .toArray(positions, i * 3);
  }
  return new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    ),
    new THREE.PointsMaterial({
      color: 0x9fb3d1,
      size: 1.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
    }),
  );
}
