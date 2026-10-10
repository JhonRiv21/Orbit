import * as THREE from "three";
import { sunPos, jday, gstime, eciToEcf } from "satellite.js";

// Day and night textures blended along the real terminator: the sun direction
// is computed for the current instant, so the lit half matches the sky.

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 albedo = texture2D(dayMap, vUv).rgb;
    float light = dot(normalize(vNormal), sunDirection);
    // Wide, soft terminator: twilight spans a band instead of a hard edge.
    float day = smoothstep(-0.28, 0.32, light);
    vec3 dayColor = albedo * (0.62 + 0.55 * max(light, 0.0));
    // The night side stays readable: the same continents under moonlight,
    // with the city lights on top, instead of a near-black disc.
    vec3 moonlit = albedo * vec3(0.30, 0.36, 0.52);
    vec3 cities = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.8, 0.5) * 1.6;
    vec3 nightColor = moonlit + cities;
    gl_FragColor = vec4(mix(nightColor, dayColor, day), 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.3, 0.4, dot(normalize(vNormal), sunDirection));
    gl_FragColor = vec4(vec3(0.38, 0.66, 1.0) * rim * lit * 1.25, rim * lit);
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Sun direction in scene axes (ECEF with y north, -z at 90°E), unit length.
export function sunDirection(time: number, out = new THREE.Vector3()) {
  const date = new Date(time);
  const [x, y, z] = sunPos(jday(date)).rsun;
  const ecf = eciToEcf({ x, y, z }, gstime(date));
  return out.set(ecf.x, ecf.z, -ecf.y).normalize();
}

export function createEarth(loader: THREE.TextureLoader, compact: boolean) {
  const load = (url: string) => {
    const texture = loader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const uniforms = {
    dayMap: {
      value: load(
        compact ? "/textures/earth-day-2k.webp" : "/textures/earth-day.webp",
      ),
    },
    nightMap: { value: load("/textures/earth-night.webp") },
    sunDirection: { value: new THREE.Vector3(1, 0, 0) },
  };

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    }),
  );

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.025, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { sunDirection: uniforms.sunDirection },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );

  const group = new THREE.Group();
  group.add(earth, atmosphere);
  return { group, earth, sun: uniforms.sunDirection.value };
}
