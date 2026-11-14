/**
 * The small things on the stage: what the companies build (a vessel, a drone, a rocket) on their stand,
 * the figure that marks a person, and the satellite. All built from primitives in graphite and glass, and
 * simple enough to read as silhouettes. Each is sized 1 unit across (or tall) and scaled by the stage.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type Kit = {
  graphite: THREE.Material;
  steel: THREE.Material;
  pale: THREE.Material;
  glass: THREE.Material;
  smoke: THREE.Material;
  white: THREE.Material;
  silver: THREE.Material;
  panel: THREE.Material;
  /** A soft, flat shadow to lay on a surface: one square, and a material per strength. */
  shadeGeometry: THREE.BufferGeometry;
  shade(strength: number): THREE.Material;
  /** Sets how much of every model is there, 0..1. */
  fade(amount: number): void;
  dispose(): void;
};

export function buildKit(): Kit {
  // Double-sided: the vessel's hull is a hand-built skin, and the dish is an open bowl.
  const graphite = new THREE.MeshStandardMaterial({ color: "#3a3835", metalness: 0.15, roughness: 0.58, side: THREE.DoubleSide });
  const pale = new THREE.MeshStandardMaterial({ color: "#6a6762", metalness: 0.1, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: "#4d4a46", metalness: 1, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#060607", metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
  const smoke = new THREE.MeshPhysicalMaterial({ color: "#16151a", metalness: 0, roughness: 0.08, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0, roughness: 0.55 });
  const silver = new THREE.MeshStandardMaterial({ color: "#d9d5ce", metalness: 1, roughness: 0.28, side: THREE.DoubleSide });
  const panel = new THREE.MeshPhysicalMaterial({ color: "#141032", metalness: 0.7, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 });
  const all: THREE.Material[] = [graphite, pale, steel, glass, smoke, white, silver, panel];
  // A model comes and goes by dissolving: with `alphaHash` an opacity below 1 thins it out grain by grain,
  // which needs no sorting and sits well under the film grain.
  for (const material of [graphite, pale, steel, glass, white, silver, panel]) material.alphaHash = true;
  const shadeGeometry = new THREE.PlaneGeometry(1, 1);
  const shade = (strength: number) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: strength } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      // The board's violet lift shadow, laid flat. Written already multiplied by its alpha.
      fragmentShader: "uniform float uAlpha; varying vec2 vUv; void main() { float d = length((vUv - 0.5) * 2.0); float a = exp(-d * d * 3.2) * (1.0 - smoothstep(0.75, 1.0, d)) * uAlpha; gl_FragColor = vec4(vec3(0.11, 0.0, 0.3) * a, a); }",
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    all.push(material);
    return material;
  };
  const solid = [graphite, pale, steel, glass, white, silver, panel];
  const fade = (amount: number) => {
    for (const material of solid) material.opacity = amount;
    smoke.opacity = 0.34 * amount;
  };
  return { graphite, pale, steel, glass, smoke, white, silver, panel, shadeGeometry, shade, fade, dispose: () => (all.forEach((m) => m.dispose()), shadeGeometry.dispose()) };
}

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
};

/** A person, as a turned peg: a body and a head. 1 unit tall, standing on y = 0. */
export function buildFigure(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  const profile = [
    [0, 0], [0.2, 0], [0.215, 0.012], [0.215, 0.03], [0.185, 0.3], [0.17, 0.48], [0.155, 0.545], [0.12, 0.59], [0.07, 0.612], [0, 0.62],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  group.add(mesh(new THREE.LatheGeometry(profile, 48), kit.graphite));
  group.add(mesh(new THREE.SphereGeometry(0.15, 40, 28), kit.graphite, 0, 0.82, 0));
  return group;
}

/**
 * A launch vehicle on its pad: a slim body in two stages, a fairing a little wider than it, four small
 * fins. Nothing swept or pointed, so it reads as a rocket that carries things up. 1 unit tall.
 */
export function buildRocket(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  const r = 0.062;
  const wide = 0.078;
  const body = [
    [r * 0.7, 0], [r * 0.86, 0.035], [r, 0.06], [r, 0.7], [wide, 0.735],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  group.add(mesh(new THREE.LatheGeometry(body, 56), kit.graphite));
  // The fairing: straight, then an ogive, in glass.
  const fairing: THREE.Vector2[] = [new THREE.Vector2(wide, 0.735), new THREE.Vector2(wide, 0.83)];
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    fairing.push(new THREE.Vector2(wide * Math.max(0, Math.cos((t * Math.PI) / 2)) ** 0.72, 0.83 + 0.17 * Math.sin((t * Math.PI) / 2)));
  }
  group.add(mesh(new THREE.LatheGeometry(fairing, 56), kit.glass));
  group.add(mesh(new THREE.CylinderGeometry(r + 0.0025, r + 0.0025, 0.012, 56), kit.silver, 0, 0.5, 0));
  const fin = new THREE.Shape();
  fin.moveTo(r - 0.01, 0.2);
  fin.lineTo(r + 0.05, 0.05);
  fin.lineTo(r + 0.05, 0.005);
  fin.lineTo(r - 0.01, 0.03);
  fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 0.01, bevelEnabled: false });
  finGeometry.translate(0, 0, -0.005);
  for (let i = 0; i < 4; i++) {
    const f = mesh(finGeometry, kit.graphite);
    f.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    group.add(f);
  }
  return group;
}

/**
 * An uncrewed vessel, from the waterline up: a raked bow with the deck rising to it, a low house with a
 * smaller one on top, a mast. 1 unit long, bow toward +x, on y = 0.
 */
export function buildVessel(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  // The hull: stations from stern to bow, each a waterline point and a deck edge, mirrored.
  const stations = 18;
  const positions: number[] = [];
  const ring: THREE.Vector3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = -0.5 + t * 0.94;
    const taper = t < 0.34 ? 1 : Math.max(0, Math.cos(((t - 0.34) / 0.66) * (Math.PI / 2))) ** 0.8;
    const beam = 0.1 * taper;
    const deck = 0.075 + 0.085 * t ** 2.4;
    // The deck overhangs the waterline more and more toward the bow: the stem rakes forward.
    const rake = 0.06 * t ** 3;
    ring.push([new THREE.Vector3(x, 0, -beam * 0.7), new THREE.Vector3(x + rake, deck, -beam), new THREE.Vector3(x + rake, deck, beam), new THREE.Vector3(x, 0, beam * 0.7)]);
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    for (const v of [a, b, c, a, c, d]) positions.push(v.x, v.y, v.z);
  };
  for (let i = 0; i < stations; i++) {
    const p = ring[i];
    const q = ring[i + 1];
    quad(p[0], p[1], q[1], q[0]); // port side
    quad(p[1], p[2], q[2], q[1]); // deck
    quad(p[2], p[3], q[3], q[2]); // starboard side
  }
  quad(ring[0][0], ring[0][3], ring[0][2], ring[0][1]); // transom
  const hull = new THREE.BufferGeometry();
  hull.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  hull.computeVertexNormals();
  group.add(new THREE.Mesh(hull, kit.graphite));

  // The house: raked fore and aft, a band of glass across its front, and a smaller house on top.
  const block = (from: number, to: number, height: number, width: number, lean: number) => {
    const side = new THREE.Shape();
    side.moveTo(from, 0);
    side.lineTo(to, 0);
    side.lineTo(to - lean, height);
    side.lineTo(from + lean * 0.5, height);
    side.closePath();
    const geometry = new THREE.ExtrudeGeometry(side, { depth: width, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    geometry.translate(0, 0, -width / 2);
    return geometry;
  };
  group.add(mesh(block(-0.3, 0.06, 0.06, 0.11, 0.07), kit.pale, 0, 0.082, 0));
  group.add(mesh(block(-0.2, -0.03, 0.045, 0.08, 0.04), kit.pale, 0, 0.146, 0));
  const band = new THREE.Shape();
  band.moveTo(0.05, 0.016);
  band.lineTo(0.008, 0.052);
  band.lineTo(-0.02, 0.052);
  band.lineTo(0.022, 0.016);
  band.closePath();
  const windows = new THREE.ExtrudeGeometry(band, { depth: 0.122, bevelEnabled: false });
  windows.translate(0, 0, -0.061);
  group.add(mesh(windows, kit.glass, 0, 0.082, 0));
  // The mast and its sensor.
  group.add(mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.13, 12), kit.graphite, -0.14, 0.255, 0));
  group.add(mesh(new THREE.BoxGeometry(0.014, 0.01, 0.1), kit.graphite, -0.14, 0.275, 0));
  group.add(mesh(new THREE.SphereGeometry(0.02, 24, 16), kit.silver, -0.14, 0.33, 0));
  return group;
}

/** A quadcopter. 1 unit across its rotors, centred. */
export function buildDrone(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(0.3, 0.085, 0.2, 5, 0.04), kit.graphite));
  group.add(mesh(new RoundedBoxGeometry(0.16, 0.03, 0.14, 4, 0.014), kit.glass, 0.02, 0.045, 0));
  const reach = 0.33;
  const arm = new THREE.BoxGeometry(reach * 2 * Math.SQRT2 * 0.96, 0.026, 0.04);
  for (const turn of [Math.PI / 4, -Math.PI / 4]) {
    const a = mesh(arm, kit.graphite);
    a.rotation.y = turn;
    group.add(a);
  }
  const motor = new THREE.CylinderGeometry(0.036, 0.042, 0.07, 28);
  const guard = new THREE.TorusGeometry(0.168, 0.011, 12, 64);
  const disc = new THREE.CircleGeometry(0.16, 56);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const x = sx * reach;
    const z = sz * reach;
    group.add(mesh(motor, kit.steel, x, 0.02, z));
    const g = mesh(guard, kit.graphite, x, 0.058, z);
    g.rotation.x = Math.PI / 2;
    group.add(g);
    const d = mesh(disc, kit.smoke, x, 0.058, z);
    d.rotation.x = -Math.PI / 2;
    group.add(d);
  }
  // Its eye, under the nose.
  group.add(mesh(new THREE.SphereGeometry(0.045, 24, 16), kit.glass, 0.14, -0.05, 0));
  return group;
}

/**
 * The three on their stand: one group, 1 unit across the stand, standing on y = 0. The vessel is low at
 * the front left, under where their agents' orb floats; the rocket is tall at the back right; the drone
 * hovers between them.
 */
export function buildFarSide(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.028, 96), kit.white, 0, 0.014, 0));
  const top = 0.028;

  const vessel = buildVessel(kit);
  vessel.scale.setScalar(0.66);
  vessel.position.set(-0.07, top, 0.2);
  // Bow toward the viewer's left: it is seen from ahead and to one side.
  vessel.rotation.y = Math.PI + 0.5;
  group.add(vessel);

  const rocket = buildRocket(kit);
  rocket.scale.setScalar(0.86);
  rocket.position.set(0.24, top, -0.14);
  group.add(rocket);

  const drone = buildDrone(kit);
  drone.scale.setScalar(0.33);
  drone.position.set(0.0, top + 0.47, -0.08);
  drone.rotation.set(0.18, 0.6, 0.05);
  group.add(drone);
  // Soft shadows on the stand, under each of the three: they sit on it, and the drone hangs over it.
  const shade = (x: number, z: number, w: number, d: number, turn: number, strength: number) => {
    const m = mesh(kit.shadeGeometry, kit.shade(strength), x, top + 0.002, z);
    m.rotation.set(-Math.PI / 2, 0, turn);
    m.scale.set(w, d, 1);
    group.add(m);
  };
  shade(-0.05, 0.215, 0.82, 0.3, 0.5, 0.5);
  shade(0.255, -0.125, 0.3, 0.26, 0, 0.55);
  shade(0.02, -0.06, 0.4, 0.34, 0, 0.2);
  return group;
}

/** A satellite: a body, two wings of panels, a dish. 1 unit across its wings, centred. */
export function buildSatellite(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(0.15, 0.19, 0.15, 3, 0.012), kit.silver));
  const cell = new THREE.BoxGeometry(0.118, 0.17, 0.008);
  const rim = new THREE.BoxGeometry(0.126, 0.178, 0.004);
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 10).rotateZ(Math.PI / 2), kit.silver, side * 0.285, 0, 0));
    for (let i = 0; i < 3; i++) {
      const x = side * (0.165 + i * 0.134);
      group.add(mesh(rim, kit.silver, x, 0, -0.003));
      group.add(mesh(cell, kit.panel, x, 0, 0));
    }
  }
  // The dish, looking down at the ground.
  const bowl: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    bowl.push(new THREE.Vector2(0.075 * t, 0.03 * t * t));
  }
  const dish = mesh(new THREE.LatheGeometry(bowl, 36), kit.silver, 0, -0.16, 0.02);
  dish.rotation.x = Math.PI;
  group.add(dish);
  group.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), kit.silver, 0, -0.125, 0.02));
  return group;
}
