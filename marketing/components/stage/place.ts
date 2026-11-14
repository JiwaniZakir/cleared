/**
 * The place the phone stands in, drawn behind everything as one rectangle with one shader.
 *
 * By day it is a bone studio sweep, as a product photographer's backdrop is: a floor that takes light,
 * shadow and a soft reflection, and runs back into the backdrop with no horizon line. The floor is worked out
 * per pixel by following that pixel's line of sight from the camera down to the ground, so it recedes in true
 * perspective and slides against the phone when the camera moves, with no geometry at all. On it: the key's
 * light around the phone, the prism's rim light where it lands beside it, the glow the screen throws in front
 * of it, a soft dark line where the phone touches, and the phone's own reflection (the scene drawn upside
 * down by the stage, blurred more the further it is from the phone's base).
 *
 * By night it is the sky: a few stars, the planet's edge with its air lit along it, the orbit as a hairline,
 * and the phone's reflection on glass that is otherwise not there.
 *
 * The turn from one to the other is a dusk: after the phone's screen has dimmed, the dark comes down from
 * the horizon across the whole ground, with the prism's light along its edge. While the bridge stands on it, the floor carries a faint survey grid, finer toward the companies.
 *
 * Colours are written as they should look and turned to linear light here: the stage's picture is kept in
 * linear light until the last pass (post.ts). With `uEmit` set it draws only what gives off light, which is
 * what the bloom is made from.
 */
import * as THREE from "three";

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uView;       // the viewport, in CSS pixels
  uniform vec2 uEye;        // the point straight ahead of the camera, pixels from the top-left corner
  uniform float uD;         // how far back the camera stands, in pixels
  uniform float uFloorY;    // where the floor meets the phone's plane, pixels from the top
  uniform vec4 uPhone;      // its place across the viewport, half its width, its height (pixels), and its turn (radians)
  uniform float uPrism;     // 0..1: the prism's light
  uniform vec3 uScreen;     // the light the screen throws, linear
  uniform sampler2D uMirror;
  uniform float uMirrorK;   // how strongly the floor mirrors (0 when there is no mirror picture)
  uniform float uDark;      // 0 by day, 1 at night: the whole ground at once
  uniform float uGrid;      // 0..1: the survey grid on the floor, there while the bridge is
  uniform vec4 uLimb;       // the planet's edge: centre x, centre y, radius, and the orbit's radius
  uniform vec4 uNight;      // how much there is of the edge, its glow, the orbit, the stars
  uniform vec3 uRim;        // the prism's colour here: it follows the place along the bridge
  uniform vec4 uQuiet;      // where the chapter's words are: left, top, right, bottom
  uniform float uHeader;    // the header's height
  uniform float uEmit;      // 1: draw only what gives off light (for the bloom)

  const vec3 PURPLE = vec3(0.631, 0.384, 1.0);
  const vec3 AQUA = vec3(0.337, 0.980, 0.969);
  const vec3 CREAM = vec3(0.973, 0.863, 0.733);
  vec3 L(vec3 c) { return pow(c, vec3(2.2)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sat(float v) { return clamp(v, 0.0, 1.0); }
  float bell(float v, float width) { v /= width; return exp(-v * v); }

  // A survey grid on the floor, in the floor's own pixels: fine lines, a heavier one every fifth, finer toward
  // the companies (to the right). It fades with distance so it never moires.
  float grid(vec2 f) {
    float step = mix(96.0, 48.0, smoothstep(0.0, 1.4 * uView.x, f.x + 0.3 * uView.x));
    vec2 g = f / step;
    vec2 w = fwidth(g) * 1.2;
    vec2 fine = 1.0 - smoothstep(vec2(0.0), w, abs(fract(g - 0.5) - 0.5));
    vec2 g5 = g / 5.0;
    vec2 w5 = fwidth(g5) * 1.2;
    vec2 coarse = 1.0 - smoothstep(vec2(0.0), w5, abs(fract(g5 - 0.5) - 0.5));
    float fade = exp(-max(f.y, 0.0) / (uD * 0.55)) * (1.0 - smoothstep(0.25, 0.6, max(w.x, w.y)));
    return (max(fine.x, fine.y) * 0.5 + max(coarse.x, coarse.y) * 0.5) * fade;
  }

  // The phone's reflection: the upside-down picture, softer the further below the phone's base it falls.
  vec4 mirror(vec2 p) {
    float fall = sat((p.y - uFloorY) / (0.7 * uPhone.z));
    float radius = (1.5 + 30.0 * fall) / uView.y;
    vec4 sum = vec4(0.0);
    for (int i = 0; i < 9; i++) {
      float a = float(i) * 2.399963;
      float r = sqrt((float(i) + 0.5) / 9.0) * radius;
      sum += texture2D(uMirror, vUv + vec2(cos(a) * uView.y / uView.x, sin(a)) * r);
    }
    return sum / 9.0 * exp(-fall * 2.6) * step(uFloorY, p.y) * uMirrorK;
  }

  vec3 day(vec2 p) {
    float H = uPhone.z;
    float dy = p.y - uEye.y;                                   // below the camera's eye level when positive
    // A studio sweep: the floor runs back and turns up into the backdrop with no line between them.
    const vec3 BACK = vec3(0.922, 0.914, 0.898);
    if (dy <= 0.0) return L(mix(BACK, vec3(0.902, 0.894, 0.875), smoothstep(0.45, 1.2, -dy / uView.y)));
    // The floor: follow this pixel's line of sight down to it.
    float t = (uFloorY - uEye.y) / max(dy, 0.5);
    vec2 f = vec2(uEye.x + (p.x - uEye.x) * t - uPhone.x, uD * (t - 1.0));   // across, and away from the camera, from the phone's base
    float away = 1.0 - exp(-max(f.y, 0.0) / (uD * 0.9));
    // Lit where the key falls, around the phone; falling off to the backdrop behind, a shade deeper toward the camera.
    float pool = bell(f.x - 0.1 * H, 1.5 * H) * bell(f.y - 0.1 * H, 1.3 * H);
    vec3 ground = mix(vec3(0.906, 0.896, 0.878), vec3(0.957, 0.949, 0.937), pool);
    ground = mix(ground, BACK, away);
    ground *= 1.0 - 0.045 * sat(-f.y / (uD * 0.6));
    ground *= 1.0 - 0.055 * grid(f) * uGrid;
    // The prism's rim light, where it lands on the floor beside the phone. Never in the air behind it.
    // It comes from behind, so it lies in two long streaks that run toward the camera past the phone's edges.
    float pl = bell(f.x + 0.5 * H + f.y * 0.12, 0.3 * H) * bell(f.y + 0.1 * H, 1.0 * H);
    float pr = bell(f.x - 0.55 * H - f.y * 0.12, 0.3 * H) * bell(f.y + 0.1 * H, 1.0 * H);
    ground = mix(ground, uRim, sat(pl * 0.6 + pr * 0.42) * uPrism);
    vec3 col = L(ground);
    // Along the phone's base: its width, and the way its screen faces.
    vec2 wide = vec2(cos(uPhone.w), sin(uPhone.w));
    vec2 front = vec2(sin(uPhone.w), -cos(uPhone.w));
    float a = dot(f, wide);
    float b = dot(f, front);
    // The glow the screen throws on the floor in front of it.
    col += uScreen * 0.2 * bell(a, 1.7 * uPhone.y) * exp(-max(b, 0.0) / (0.42 * H)) * step(0.0, b);
    // The dark line where it touches.
    col *= 1.0 - 0.6 * exp(-pow(abs(a) / (uPhone.y * 1.06), 6.0)) * exp(-abs(b) / (0.035 * H));
    vec4 m = mirror(p);
    return col * (1.0 - m.a) + m.rgb;
  }

  // What gives off light at night: the stars, and the planet's lit edge with its air.
  // The second value is how much of the soft air above the edge to include: all of it in the picture, little of it
  // in the bloom, which is already a blur.
  vec3 lights(vec2 p, float air) {
    vec2 rel = p - uLimb.xy;
    float r = length(rel);
    float d = r - uLimb.z;                                      // above the planet's edge when positive
    // A few stars, none of them near the edge's light.
    vec2 cell = floor(p / 54.0);
    float bright = pow(hash(cell + 13.1), 11.0);
    vec2 at = (cell + 0.2 + 0.6 * vec2(hash(cell), hash(cell + 7.3))) * 54.0;
    float size = 0.55 + 0.9 * hash(cell + 3.7);
    float star = bright * (1.0 - smoothstep(size * 0.5, size, length(p - at))) * smoothstep(40.0, 260.0, d) * uNight.w;
    // No star behind words: not behind the chapter's own, and not behind the header.
    vec2 inside = smoothstep(uQuiet.xy - 36.0, uQuiet.xy - 8.0, p) * (1.0 - smoothstep(uQuiet.zw + 8.0, uQuiet.zw + 36.0, p));
    star *= (1.0 - inside.x * inside.y) * smoothstep(uHeader, uHeader + 28.0, p.y);
    vec3 col = vec3(0.86, 0.9, 1.0) * star * 1.4;
    // A thin line of the prism's light along the edge, and the air above it.
    float across = sat(p.x / uView.x);
    vec3 light = L(across < 0.5 ? mix(PURPLE, AQUA, smoothstep(0.08, 0.5, across)) : mix(AQUA, CREAM, smoothstep(0.5, 0.92, across)));
    float rim = exp(-d * d / 3.0) * step(-4.0, d);
    float thin = exp(-max(d, 0.0) / mix(14.0, 34.0, uNight.y)) * step(0.0, d) * mix(0.3, 0.75, uNight.y);
    float wide = exp(-max(d, 0.0) / mix(90.0, 210.0, uNight.y)) * step(0.0, d) * mix(0.05, 0.16, uNight.y);
    float inner = exp(min(d, 0.0) / 9.0) * step(d, 0.0) * 0.25;
    return col + light * (rim * mix(1.0, 1.5, uNight.y) + (thin + wide + inner) * air) * uNight.x;
  }

  vec3 night(vec2 p) {
    vec3 col = L(vec3(0.027, 0.024, 0.043));
    float r = length(p - uLimb.xy);
    float d = r - uLimb.z;
    // The dark of the planet under its edge.
    col *= 1.0 - (1.0 - smoothstep(-1.0, 1.0, d)) * exp(min(d, 0.0) / 170.0) * 0.85 * uNight.x;
    col += lights(p, 1.0);
    // The orbit.
    col += vec3(1.0) * (1.0 - smoothstep(0.5, 1.5, abs(r - uLimb.w))) * 0.045 * uNight.z;
    vec4 m = mirror(p);
    return col * (1.0 - m.a * 0.5) + m.rgb * 0.8;
  }

  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;
    float u = uDark;
    if (uEmit > 0.5) {
      // For the bloom: only what gives off light, and nothing else.
      gl_FragColor = vec4(lights(p, 0.35) * smoothstep(0.55, 1.0, u), 1.0);
      return;
    }
    vec3 col;
    if (u <= 0.0) col = day(p);
    else if (u >= 1.0) col = night(p);
    else {
      // Dusk comes down from the horizon: the air and the far floor go dark first, the floor at your feet
      // last, and where the dark is arriving the prism's light lies along its edge.
      float g = (p.y - uEye.y) / uView.y;
      float v = smoothstep(0.0, 1.0, u * 1.9 - 0.9 * sat(g / 0.5));
      col = mix(day(p), night(p), v);
      float across = sat(p.x / uView.x);
      vec3 light = L(across < 0.5 ? mix(PURPLE, AQUA, smoothstep(0.08, 0.5, across)) : mix(AQUA, CREAM, smoothstep(0.5, 0.92, across)));
      col += light * v * (1.0 - v) * 1.1;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export type Place = { scene: THREE.Scene; camera: THREE.Camera; uniforms: Record<string, THREE.IUniform>; dispose(): void };

export function buildPlace(): Place {
  const uniforms: Record<string, THREE.IUniform> = {
    uView: { value: new THREE.Vector2(1, 1) },
    uEye: { value: new THREE.Vector2() },
    uD: { value: 1000 },
    uFloorY: { value: 0 },
    uPhone: { value: new THREE.Vector4(0, 100, 600, 0) },
    uPrism: { value: 0 },
    uScreen: { value: new THREE.Vector3(1, 1, 1) },
    uMirror: { value: null },
    uMirrorK: { value: 0 },
    uDark: { value: 0 },
    uGrid: { value: 0 },
    uLimb: { value: new THREE.Vector4(0, 2000, 1000, 1400) },
    uNight: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRim: { value: new THREE.Vector3(0.631, 0.384, 1) },
    uEmit: { value: 0 },
    uQuiet: { value: new THREE.Vector4() },
    uHeader: { value: 64 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }",
    fragmentShader: FRAGMENT,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  // One triangle that covers the viewport.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, camera: new THREE.Camera(), uniforms, dispose: () => (geometry.dispose(), material.dispose()) };
}
