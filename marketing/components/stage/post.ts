/**
 * What happens to the stage's picture after it is drawn, and how much of it a device gets.
 *
 * The scene is drawn in linear light into a buffer that can hold values brighter than white. Then:
 *   bloom    only what gives off light. The stage draws those things, and nothing else, into the bloom's
 *            first buffer: the phone's screen (with a gain the director sets, faint by day and strong at
 *            night), the dawn along the planet's edge, the stars. A glint on metal is not one of them. It is
 *            then blurred down a chain of half-sized buffers and added back up it.
 *   focus    a lens that can hold one place sharp. The picture is halved three times into a soft copy, and
 *            the finish shows that copy wherever is neither the station in focus nor the phone, in step with
 *            how far the focus has been pulled. A pane of glass can cross in front of the lens: a wide band,
 *            out of focus, with the prism on its edges.
 *   vignette a slight darkening toward the corners.
 *   shoulder everything up to near-white is left exactly as painted (so the bone is the stylesheet's bone);
 *            only what is brighter is eased down to white.
 *   grain    a fine, still film grain, which also keeps every soft gradient from banding.
 *
 * A tier is how much of this a device gets. The lower tier drops steps, never the picture.
 */
import * as THREE from "three";

export type Tier = {
  name: "full" | "light";
  /** The most device pixels drawn per CSS pixel. */
  dpr: number;
  /** Multisampling of the main picture. */
  samples: number;
  /** The mirror picture's size against the main one (0: no reflections). */
  mirror: number;
  /** How many half-sized steps the bloom is blurred down. */
  bloom: number;
  /** The key light's shadow map, in pixels a side. */
  shadow: number;
  /** The tallest the phone's screen is ever painted, in pixels. */
  screen: number;
};

export const FULL: Tier = { name: "full", dpr: 2, samples: 4, mirror: 0.5, bloom: 5, shadow: 1024, screen: 2048 };
export const LIGHT: Tier = { name: "light", dpr: 2, samples: 4, mirror: 0.33, bloom: 4, shadow: 512, screen: 1536 };

/** A phone, or anything that cannot say it has much memory, gets the lighter tier. */
export function chooseTier(): Tier {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return coarse || small || (memory !== undefined && memory <= 4) ? LIGHT : FULL;
}

const VERTEX = "varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }";

/** Halves a picture. */
const DOWN = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSource;
  uniform vec2 uTexel;       // one pixel of the source
  void main() {
    vec3 c = texture2D(tSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(min(c * 0.25, vec3(24.0)), 1.0);
  }
`;

/** Doubles a picture, softly, to be added onto the step above it. */
const UP = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSource;
  uniform vec2 uTexel;
  void main() {
    vec3 c = texture2D(tSource, vUv).rgb * 4.0;
    c += (texture2D(tSource, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(1.0, 0.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(0.0, 1.0)).rgb) * 2.0;
    c += texture2D(tSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 16.0, 1.0);
  }
`;

const FINISH = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloom;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uAspect;
  uniform sampler2D tSoft;   // the picture, out of focus
  uniform float uSoft;       // 0..1: how far the focus is pulled (0: everything sharp)
  uniform vec4 uWindow;      // what is in focus: centre and half size, in CSS pixels from the top-left corner
  uniform vec4 uKeep;        // the phone, always in focus: the same
  uniform vec4 uPane;        // the pane crossing the lens: where its middle is, its half width, how much of it is there, and 1 if it travels down the picture
  uniform vec2 uView;        // the viewport, in CSS pixels
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // 1 inside a box, falling to 0 over a margin outside it.
  float inside(vec2 p, vec4 box, float margin) {
    vec2 d = abs(p - box.xy) - box.zw;
    return 1.0 - smoothstep(0.0, margin, length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    if (uSoft > 0.001 || uPane.z > 0.001) {
      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;
      vec3 soft = texture2D(tSoft, vUv).rgb;
      float m = uSoft * (1.0 - max(inside(p, uWindow, 110.0), inside(p, uKeep, 16.0)));
      vec2 q = uPane.w > 0.5 ? p.yx : p.xy;
      float span = uPane.w > 0.5 ? uView.x : uView.y;
      float d = (q.x - uPane.x + (q.y - 0.5 * span) * 0.16) / uPane.y;
      float band = (1.0 - smoothstep(0.84, 1.0, abs(d))) * uPane.z;
      c = mix(c, soft, max(m, band));
      // Glass in front of the lens: what is behind it a little lighter and cooler, light caught along its two edges.
      c = mix(c, c * vec3(0.93, 0.97, 1.0) + 0.05, band * 0.5);
      c += vec3(0.5, 0.78, 1.0) * exp(-pow((abs(d) - 0.92) * 16.0, 2.0)) * uPane.z * 0.1;
    }
    c += texture2D(tBloom, vUv).rgb * uBloom;
    vec2 v = (vUv - 0.5) * vec2(min(uAspect, 1.6), 1.0);
    c *= 1.0 - uVignette * smoothstep(0.5, 1.1, length(v) * 1.25);
    // Up to near-white, exactly as painted. Brighter than that eases down to white and loses its colour.
    float peak = max(c.r, max(c.g, c.b));
    const float knee = 0.94;
    if (peak > knee) {
      float eased = knee + (1.0 - knee) * (1.0 - exp(-(peak - knee) / (1.0 - knee)));
      c = mix(c * (eased / peak), vec3(eased), smoothstep(1.0, 5.0, peak) * 0.7);
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
  }
`;

/** Where the lens is focused. Boxes are a centre and a half size, in CSS pixels from the viewport's top-left corner. */
export type Focus = {
  /** 0..1: how far the focus is pulled. 0: everything is sharp. */
  soft: number;
  /** What is in focus besides the phone. */
  window: [number, number, number, number];
  /** The phone: always in focus. */
  keep: [number, number, number, number];
  /** 0..1: a flat picture has no darkened corners (so a ground laid over part of it in the page's own colour does not show). */
  flat: number;
  /** The pane crossing the lens: its middle, its half width, how much of it is there (0..1), and whether it travels down the picture. */
  pane: { at: number; half: number; amount: number; down: boolean };
};

export type Post = {
  /** The buffer the scene is drawn into. */
  scene: THREE.WebGLRenderTarget;
  /** The buffer the upside-down scene is drawn into for the floor to mirror, or null on a tier without one. */
  mirror: THREE.WebGLRenderTarget | null;
  resize(width: number, height: number, dpr: number): void;
  /**
   * Finishes the frame onto the canvas. `glow` draws what gives off a fine light (the dawn's line, stars)
   * into the bloom's first buffer, already selected and cleared to black. `wash` draws what gives off a broad
   * light (the phone's screen) into a buffer three steps down, where fine detail is already gone: the screen
   * then spills light from its whole face and edge, and no letter on it gets a halo of its own.
   */
  finish(glow: () => void, wash: () => void, strength: number, focus: Focus): void;
  dispose(): void;
};

export function buildPost(renderer: THREE.WebGLRenderer, tier: Tier): Post {
  const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const scene = new THREE.WebGLRenderTarget(2, 2, { type, samples: tier.samples, depthBuffer: true });
  const mirror = tier.mirror > 0 ? new THREE.WebGLRenderTarget(2, 2, { type, depthBuffer: true }) : null;
  // The first step has depth: the stage draws what stands in the picture into it as black, and then only the
  // parts of the set that give off light and are not behind something.
  const steps = Array.from({ length: tier.bloom }, (_, i) => new THREE.WebGLRenderTarget(2, 2, { type, depthBuffer: i === 0 }));

  // The soft copy: halved three times, then spread back up one step so it has no blocks in it.
  const soft = [2, 4, 8, 4].map(() => new THREE.WebGLRenderTarget(2, 2, { type, depthBuffer: false }));
  const softBy = [2, 4, 8, 4];

  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const camera = new THREE.Camera();
  const stage = new THREE.Scene();
  const mesh = new THREE.Mesh(triangle);
  mesh.frustumCulled = false;
  stage.add(mesh);
  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, additive = false) =>
    new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...(additive ? { blending: THREE.AdditiveBlending, transparent: true } : {}) });
  const down = pass(DOWN, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = pass(UP, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() } }, true);
  const spread = pass(UP, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const finish = pass(FINISH, {
    tScene: { value: null },
    tBloom: { value: null },
    uBloom: { value: 1 },
    uVignette: { value: 0.1 },
    uGrain: { value: 0.016 },
    uAspect: { value: 1 },
    tSoft: { value: null },
    uSoft: { value: 0 },
    uWindow: { value: new THREE.Vector4() },
    uKeep: { value: new THREE.Vector4() },
    uPane: { value: new THREE.Vector4() },
    uView: { value: new THREE.Vector2(1, 1) },
  });

  const run = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(stage, camera);
  };

  return {
    scene,
    mirror,
    resize(width, height, dpr) {
      const w = Math.max(2, Math.round(width * dpr));
      const h = Math.max(2, Math.round(height * dpr));
      // Where a CSS pixel is already two device pixels or more, edges need less smoothing: half the samples,
      // which is what keeps a large high-density window inside a sixtieth of a second a frame.
      const samples = dpr >= 1.75 ? Math.min(2, tier.samples) : tier.samples;
      if (scene.samples !== samples) {
        scene.samples = samples;
        scene.dispose();
      }
      scene.setSize(w, h);
      mirror?.setSize(Math.round(w * tier.mirror), Math.round(h * tier.mirror));
      steps.forEach((step, i) => step.setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1))));
      soft.forEach((target, i) => target.setSize(Math.max(2, Math.round(w / softBy[i])), Math.max(2, Math.round(h / softBy[i]))));
      finish.uniforms.uAspect.value = width / height;
      finish.uniforms.uView.value.set(width, height);
    },
    finish(glow, wash, strength, focus) {
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      // The soft copy of the picture, only while something is out of focus.
      const pulled = focus.soft > 0.001 || focus.pane.amount > 0.001;
      if (pulled) {
        let from: THREE.WebGLRenderTarget = scene;
        for (let i = 0; i < 3; i++) {
          down.uniforms.tSource.value = from.texture;
          down.uniforms.uTexel.value.set(0.5 / from.width, 0.5 / from.height);
          run(down, soft[i]);
          from = soft[i];
        }
        spread.uniforms.tSource.value = soft[2].texture;
        spread.uniforms.uTexel.value.set(1 / soft[2].width, 1 / soft[2].height);
        run(spread, soft[3]);
      }
      const f = finish.uniforms;
      f.uVignette.value = 0.1 * (1 - focus.flat);
      f.tSoft.value = soft[3].texture;
      f.uSoft.value = pulled ? focus.soft : 0;
      f.uWindow.value.set(...focus.window);
      f.uKeep.value.set(...focus.keep);
      f.uPane.value.set(focus.pane.at, Math.max(1, focus.pane.half), pulled ? focus.pane.amount : 0, focus.pane.down ? 1 : 0);
      // Down: only what gives off light, drawn by the stage into the first buffer, then halved again and again.
      renderer.setRenderTarget(steps[0]);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      glow();
      const broad = Math.min(2, steps.length - 1);
      for (let i = 1; i < steps.length; i++) {
        down.uniforms.tSource.value = steps[i - 1].texture;
        down.uniforms.uTexel.value.set(0.5 / steps[i - 1].width, 0.5 / steps[i - 1].height);
        run(down, steps[i]);
        if (i === broad) wash();
      }
      // Up: each step added, softened, onto the one above.
      for (let i = steps.length - 1; i > 0; i--) {
        up.uniforms.tSource.value = steps[i].texture;
        up.uniforms.uTexel.value.set(1 / steps[i].width, 1 / steps[i].height);
        run(up, steps[i - 1]);
      }
      finish.uniforms.tScene.value = scene.texture;
      finish.uniforms.tBloom.value = steps[0].texture;
      // Each step was added onto the one above it, so the sum is as many times too bright as there are steps.
      finish.uniforms.uBloom.value = strength / steps.length;
      run(finish, null);
      renderer.autoClear = autoClear;
    },
    dispose() {
      scene.dispose();
      mirror?.dispose();
      steps.forEach((step) => step.dispose());
      soft.forEach((target) => target.dispose());
      triangle.dispose();
      [down, up, spread, finish].forEach((m) => m.dispose());
    },
  };
}
