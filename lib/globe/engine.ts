import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createEarth, sunDirection } from "./earth";
import { SatellitesLayer } from "./satellites-layer";
import { EARTH_RADIUS_KM, type SatelliteMeta } from "./orbit-math";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { CATEGORY_COLORS, LANDMARKS } from "@/lib/assets/categories";
import type { Category, SatelliteFeed } from "@/lib/types/satellite";

export type Details = Extract<WorkerResponse, { type: "details" }>;

type Callbacks = {
  onReady: () => void;
  onHover: (index: number | null, x: number, y: number) => void;
  onSelect: (index: number | null) => void;
  onDetails: (details: Details) => void;
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
// Reference shells, in km of altitude: the top of low orbit, the GPS and
// Galileo band, and the geostationary belt.
const SHELLS_KM = [2000, 20200, 35786];
const OPENING_MS = 2600;
const WIDE_LAYOUT_PX = 1024; // Tailwind's lg: where the side panel stops being a drawer
const GLOBE_SHIFT_PX = 80;
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
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = { x: 0, y: 0 };
  private lastPick = 0;
  private hovered: number | null = null;
  private pendingFocus: number | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  // Flights move the camera relative to the orbit centre, which itself moves
  // to the followed satellite (or back to the Earth) during the same flight.
  private flight: {
    fromOffset: THREE.Vector3;
    toOffset: THREE.Vector3;
    fromTarget: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;
  private follow: number | null = null;
  private shells: THREE.LineLoop[] = [];
  private labels: HTMLDivElement;
  private shellLabels: HTMLSpanElement[] = [];
  private landmarks: {
    index: number;
    element: HTMLButtonElement;
    width: number;
    height: number;
  }[] = [];
  private restPosition: THREE.Vector3;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

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
    // The first view opens wide, showing the three shells, and flies in once
    // the data is ready: one orchestrated moment that explains the layers.
    this.restPosition = initialCameraPosition(compact ? 4.4 : 3.6);
    this.camera.position.copy(
      this.reducedMotion
        ? this.restPosition
        : this.restPosition.clone().setLength(compact ? 17 : 13.5),
    );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 18;
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
    this.scene.add(this.marker, this.orbitLine);

    for (const km of SHELLS_KM) {
      const shell = createShell(1 + km / EARTH_RADIUS_KM);
      this.shells.push(shell);
      this.scene.add(shell);
    }
    this.labels = document.createElement("div");
    this.labels.className = "globe-labels";
    container.appendChild(this.labels);
    this.shellLabels = SHELLS_KM.map(() => {
      const span = document.createElement("span");
      span.className = "shell-label";
      this.labels.appendChild(span);
      return span;
    });

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
    this.landmarks = LANDMARKS.flatMap(({ name, label }) => {
      const index = meta.findIndex((m) => m.name === name);
      if (index < 0 || meta[index].orbitClass !== "leo") return [];
      const element = document.createElement("button");
      element.type = "button";
      element.className = "landmark";
      element.textContent = label;
      element.style.setProperty("--dot", CATEGORY_COLORS[meta[index].category]);
      element.addEventListener("click", () => {
        this.focus(index);
        this.callbacks.onSelect(index);
      });
      this.labels.appendChild(element);
      // Measured once: the text never changes, and reading layout every
      // frame would force a reflow at 30 fps.
      return [
        {
          index,
          element,
          width: element.offsetWidth,
          height: element.offsetHeight,
        },
      ];
    });
    this.send({ type: "init", feed });
  }

  setFocus(category: Category | null) {
    this.layer?.setFocus(category);
    if (
      this.selected !== null &&
      this.layer &&
      !this.layer.isPickable(this.selected)
    ) {
      this.select(null);
      this.callbacks.onSelect(null);
    }
  }

  setShellLabels(texts: string[]) {
    texts.forEach((text, i) => {
      if (this.shellLabels[i]) this.shellLabels[i].textContent = text;
    });
  }

  select(index: number | null) {
    this.selected = index;
    this.pendingFocus = null;
    this.marker.visible = index !== null;
    this.orbitLine.visible = false;
    if (index === null) {
      // Leaving a followed satellite: the orbit centre glides back to the
      // Earth and the camera pulls out to the usual distance.
      if (this.follow !== null) {
        this.follow = null;
        this.flyTo(
          this.camera.position.clone().setLength(this.restPosition.length()),
        );
      }
      return;
    }
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
    if (!this.layer) return;
    const satellite = this.layer.positionOf(index);
    if (satellite.lengthSq() === 0) return;
    this.follow = index;
    // The flight starts on the tap, aimed straight above the satellite; the
    // orbital plane is only known when the orbit arrives a moment later, and
    // then just the final angle is refined (see aimAtOrbit).
    this.flyTo(followOffset(satellite));
    this.pendingFocus = index;
  }

  // The camera settles just outside the satellite, a little off its orbital
  // plane: the satellite sits at the centre with the Earth behind it and its
  // orbit crossing the view as an arc instead of a flat line.
  private aimAtOrbit(points: Float32Array) {
    if (!this.layer || this.selected === null || !this.flight) return;
    const satellite = this.layer.positionOf(this.selected);
    if (satellite.lengthSq() === 0) return;
    const quarter = Math.floor(points.length / 3 / 4);
    const a = new THREE.Vector3().fromArray(points, 0);
    const b = new THREE.Vector3().fromArray(points, quarter * 3);
    const normal = a.cross(b).normalize();
    if (normal.dot(this.camera.position) < 0) normal.negate();
    this.flight.toOffset = followOffset(satellite, normal);
  }

  // `toOffset` is where the camera ends up relative to the orbit centre.
  private flyTo(toOffset: THREE.Vector3, duration = 1400, stopRotation = true) {
    if (stopRotation) this.controls.autoRotate = false;
    this.flight = {
      fromOffset: this.camera.position.clone().sub(this.controls.target),
      toOffset,
      fromTarget: this.controls.target.clone(),
      start: performance.now(),
      duration,
    };
  }

  // Shells face the camera so each reads as a circle at its true radius, and
  // fade in as the view pulls back far enough to make them meaningful.
  // Labels follow their points on screen and hide behind the planet.
  private updateOverlays() {
    const distance = this.camera.position.length();
    const { clientWidth: w, clientHeight: h } = this.container;
    const right = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      0,
    );
    const up = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      1,
    );
    const anchor = new THREE.Vector3();

    this.shells.forEach((shell, i) => {
      shell.quaternion.copy(this.camera.quaternion);
      const radius = shell.scale.x;
      const opacity =
        THREE.MathUtils.clamp(
          (distance - radius * 1.15) / (radius * 0.8),
          0,
          1,
        ) * 0.32;
      (shell.material as THREE.LineDashedMaterial).opacity = opacity;
      shell.visible = opacity > 0.01;
      anchor
        .copy(right)
        .multiplyScalar(radius * 0.72)
        .addScaledVector(up, radius * 0.69);
      this.place(this.shellLabels[i], anchor, w, h, opacity > 0.08);
    });

    if (!this.layer) return;
    // Landmarks are listed by fame: when two would overlap on screen, only the
    // better-known one keeps its label.
    // Panels marked data-globe-occluder (side panel, detail card) count as
    // taken space: a label sliding under their glass would read through it.
    const origin = this.container.getBoundingClientRect();
    const taken: { x: number; y: number; w: number; h: number }[] = [
      ...document.querySelectorAll<HTMLElement>("[data-globe-occluder]"),
    ].map((panel) => {
      const r = panel.getBoundingClientRect();
      return { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height };
    });
    for (const { index, element, width, height } of this.landmarks) {
      const p = this.layer.positionOf(index, anchor);
      let visible =
        p.lengthSq() > 0 &&
        this.layer.isPickable(index) &&
        !behindEarth(this.camera.position, p);
      if (visible) {
        const ndc = p.clone().project(this.camera);
        const box = {
          x: ((ndc.x + 1) / 2) * w + 10,
          y: ((1 - ndc.y) / 2) * h - 11,
          w: width,
          h: height,
        };
        visible = !taken.some(
          (t) =>
            box.x < t.x + t.w + 4 &&
            t.x < box.x + box.w + 4 &&
            box.y < t.y + t.h + 2 &&
            t.y < box.y + box.h + 2,
        );
        if (visible) taken.push(box);
      }
      this.place(element, p, w, h, visible);
    }
  }

  private place(
    element: HTMLElement,
    world: THREE.Vector3,
    w: number,
    h: number,
    visible: boolean,
  ) {
    const ndc = world.clone().project(this.camera);
    const onScreen =
      visible && ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05;
    element.dataset.visible = String(onScreen);
    if (onScreen) {
      element.style.transform = `translate(${((ndc.x + 1) / 2) * w}px, ${((1 - ndc.y) / 2) * h}px)`;
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.worker.terminate();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.remove();
  }

  private send(message: WorkerRequest) {
    this.worker.postMessage(message);
  }

  private receive(message: WorkerResponse) {
    if (this.disposed) return;
    switch (message.type) {
      case "ready":
        this.send({ type: "positions", time: Date.now() });
        if (!this.reducedMotion)
          this.flyTo(this.restPosition, OPENING_MS, false);
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
          this.aimAtOrbit(message.points);
        }
        break;
      case "details":
        if (message.index === this.selected) this.callbacks.onDetails(message);
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
      this.updateCamera(now);
      this.updateOverlays();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private updateCamera(now: number) {
    const goal = new THREE.Vector3();
    if (this.follow !== null && this.layer)
      this.layer.positionOf(this.follow, goal);
    // Close to a satellite the camera may come much nearer than to the Earth.
    this.controls.minDistance =
      this.follow !== null || this.flight ? 0.06 : 1.3;

    if (!this.flight) {
      // Following: carry the camera along with the satellite.
      const delta = goal.clone().sub(this.controls.target);
      this.controls.target.add(delta);
      this.camera.position.add(delta);
      return;
    }
    const { fromOffset, toOffset, fromTarget, start, duration } = this.flight;
    const k = Math.min(1, (now - start) / duration);
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const offset = fromOffset
      .clone()
      .normalize()
      .lerp(toOffset.clone().normalize(), eased)
      .setLength(
        THREE.MathUtils.lerp(fromOffset.length(), toOffset.length(), eased),
      );
    this.controls.target.copy(fromTarget).lerp(goal, eased);
    this.camera.position.copy(this.controls.target).add(offset);
    if (k >= 1) this.flight = null;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // With the side panel docked, the globe sits slightly right of centre so
    // it reads as balanced against the panel. The shift is in the projection,
    // so picking and the overlay labels stay aligned.
    if (w >= WIDE_LAYOUT_PX)
      this.camera.setViewOffset(w, h, -GLOBE_SHIFT_PX, 0, w, h);
    else this.camera.clearViewOffset();
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
        !this.layer.isPickable(index) ||
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
    // Tapping a satellite flies to it, like the search and the labels do;
    // tapping empty space just clears the selection.
    if (index === null) this.select(null);
    else this.focus(index);
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

// Where the camera rests relative to a followed satellite: outside it, at a
// distance that grows with altitude, tilted off the orbital plane if known.
function followOffset(satellite: THREE.Vector3, normal?: THREE.Vector3) {
  const distance = THREE.MathUtils.clamp(satellite.length() * 1.5, 1.6, 6);
  const offset = satellite.clone().normalize();
  if (normal)
    offset
      .multiplyScalar(Math.cos(ORBIT_VIEW_TILT))
      .addScaledVector(normal, Math.sin(ORBIT_VIEW_TILT));
  return offset.setLength(distance);
}

// True when the segment from the camera to the point crosses the planet.
function behindEarth(camera: THREE.Vector3, point: THREE.Vector3) {
  const toPoint = point.clone().sub(camera);
  const length = toPoint.length();
  const direction = toPoint.divideScalar(length);
  const along = -camera.dot(direction);
  const closest = camera.lengthSq() - along * along;
  if (closest >= 1) return false;
  const entry = along - Math.sqrt(1 - closest);
  return entry > 0 && entry < length;
}

function createShell(radius: number) {
  const segments = 160;
  const points = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  });
  const shell = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: 0x9cc8ff,
      transparent: true,
      opacity: 0,
      dashSize: 0.02,
      gapSize: 0.03,
      depthWrite: false,
    }),
  );
  shell.computeLineDistances();
  shell.scale.setScalar(radius);
  return shell;
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
