/**
 * The phone: the one object on the page from top to bottom. Built here from primitives, no downloaded
 * model. A chamfered graphite frame, black glass with the lit screen behind it and its own reflections over
 * it, a matte back with its camera. Its height is 1 unit; the stage scales it to pixels.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DISPLAY, GLASS, PHONE } from "./dims";
import { fontFamily, painted, paintScreen, pictureOf, screenId, screenKey, SCREEN, type ScreenArt, type Shown } from "./screen";

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** A flat rounded rectangle whose texture coordinates run 0..1 across it. */
function plate(w: number, h: number, r: number): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) / w + 0.5, position.getY(i) / h + 0.5);
  return geometry;
}

export type Phone = {
  group: THREE.Group;
  /** The lit screen and what is painted on it: the stage draws them again, on their own, into the bloom. */
  screen: THREE.Mesh;
  texture: THREE.Texture;
  /** Paints the screen if what it shows has changed. Returns true when it did. */
  /**
   * Shows a screen. `px`: how many page pixels one point of the screen is drawn at (it chooses the picture).
   * When the screen is a different one from the last (another stop's, or the other app's) the phone makes one
   * move on its own clock: the old screen slides out as the new slides in (`way` 1: from the right; -1: from
   * the left). Returns true while that move is still running, so the stage keeps drawing.
   */
  show(target: Shown, px: number, time: number, way: 1 | -1): boolean;
  /** For the checks: which screen is up, in which picture, and whether it is in the middle of its move. */
  report(): { id: string; picture: string; type: number; sliding: boolean; overflow: boolean; sliced: boolean; bottom: number };
  /** Where the phone is cut off (down a narrow window it is cropped to its live message): a plane in the world; the stage moves it. */
  clip: THREE.Plane;
  /** Forces the next `show` to paint (the typeface has just loaded). */
  refresh(): void;
  dispose(): void;
};

export function buildPhone(maxAnisotropy: number, textureHeight: number, art: ScreenArt): Phone {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };
  const half = PHONE.d / 2;

  /* The body: a graphite band with a flat chamfer front and back, which is what catches a line of light. */
  const edge = PHONE.edge;
  const extruded = new THREE.ExtrudeGeometry(roundedRect(GLASS.w, GLASS.h, GLASS.corner), {
    depth: PHONE.d - 2 * edge,
    bevelEnabled: true,
    bevelThickness: edge,
    bevelSize: edge,
    bevelSegments: 1,
    curveSegments: 40,
    steps: 1,
  });
  extruded.translate(0, 0, -(PHONE.d - 2 * edge) / 2);
  // Extrusion gives every triangle its own corners, which shades as facets. Weld them, then smooth only
  // where the surface turns gently (round the corners): the chamfer's two edges stay crisp.
  extruded.deleteAttribute("normal");
  extruded.deleteAttribute("uv");
  const welded = mergeVertices(extruded, 1e-5);
  extruded.dispose();
  const body = keep(toCreasedNormals(welded, 0.5));
  welded.dispose();
  const frame = keep(new THREE.MeshPhysicalMaterial({ color: "#2f2d2a", metalness: 0.75, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.35 }));
  group.add(new THREE.Mesh(body, frame));

  /* The front: black glass, and the screen lit behind it. */
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: "#040405", metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.7 }));
  const front = new THREE.Mesh(keep(plate(GLASS.w, GLASS.h, GLASS.corner)), glass);
  front.position.z = half + 0.0003;
  group.add(front);

  const canvas = document.createElement("canvas");
  canvas.height = textureHeight;
  canvas.width = Math.round((textureHeight * SCREEN.w) / SCREEN.h);
  // Kept in ordinary memory, not on the GPU: its pixels are handed to WebGL every time the screen changes,
  // and a GPU-backed 2D canvas makes that a copy between two graphics contexts.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const texture = keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  // The screen is its own light: its colours are exactly the ones painted, whatever the room does.
  const lit = keep(
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  const screen = new THREE.Mesh(keep(plate(DISPLAY.w, DISPLAY.h, DISPLAY.corner)), lit);
  screen.position.z = half + 0.0008;
  group.add(screen);

  // The glass over the screen: it adds only what glass reflects, so a light crosses the screen as the phone
  // turns and its edges brighten at a glancing angle, while the picture under it keeps its own colours.
  const sheen = keep(new THREE.MeshPhysicalMaterial({ color: "#000000", metalness: 0, roughness: 0.04, ior: 1.5, envMapIntensity: 0.2, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  const cover = new THREE.Mesh(screen.geometry, sheen);
  cover.position.z = half + 0.0011;
  cover.userData.sheen = true;
  group.add(cover);

  const island = new THREE.Mesh(keep(plate(0.118, 0.034, 0.017)), keep(new THREE.MeshBasicMaterial({ color: "#020203" })));
  island.position.set(0, DISPLAY.h / 2 - 0.036, half + 0.0013);
  group.add(island);

  /* The back: matte glass, and the camera. */
  const matte = keep(new THREE.MeshPhysicalMaterial({ color: "#262421", metalness: 0.25, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  const back = new THREE.Mesh(keep(plate(GLASS.w, GLASS.h, GLASS.corner)), matte);
  back.rotation.y = Math.PI;
  back.position.z = -half - 0.0003;
  group.add(back);

  const plateau = new THREE.Mesh(keep(new RoundedBoxGeometry(0.2, 0.2, 0.012, 6, 0.006)), keep(new THREE.MeshPhysicalMaterial({ color: "#2e2c29", metalness: 0.3, roughness: 0.4, clearcoat: 0.6 })));
  plateau.position.set(GLASS.w / 2 - 0.118, GLASS.h / 2 - 0.118, -half - 0.006);
  group.add(plateau);
  const ring = keep(new THREE.CylinderGeometry(0.041, 0.041, 0.016, 40));
  const lens = keep(new THREE.CylinderGeometry(0.031, 0.031, 0.018, 40));
  const lensGlass = keep(new THREE.MeshPhysicalMaterial({ color: "#050507", metalness: 0, roughness: 0.04, clearcoat: 1 }));
  for (const [dx, dy] of [[-0.047, 0.047], [-0.047, -0.047], [0.047, 0]] as const) {
    for (const [geometry, material] of [[ring, frame], [lens, lensGlass]] as const) {
      const part = new THREE.Mesh(geometry, material);
      part.rotation.x = Math.PI / 2;
      part.position.set(plateau.position.x + dx, plateau.position.y + dy, -half - 0.012);
      group.add(part);
    }
  }

  /* The buttons on the frame. */
  const button = (length: number, x: number, y: number) => {
    const mesh = new THREE.Mesh(keep(new RoundedBoxGeometry(0.008, length, 0.02, 4, 0.0035)), frame);
    mesh.position.set(x, y, 0);
    group.add(mesh);
  };
  button(0.11, PHONE.w / 2, 0.12);
  button(0.036, -PHONE.w / 2, 0.275);
  button(0.066, -PHONE.w / 2, 0.19);
  button(0.066, -PHONE.w / 2, 0.105);

  // It throws a shadow; nothing throws one on it.
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.sheen) child.castShadow = true;
  });
  // Every part of it can be cut off below a line (far away until the stage moves it).
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) for (const material of [child.material].flat()) material.clippingPlanes = [clip];
  });

  let shown = "";
  let family = "";
  /** How long the slide from one screen to the next takes. */
  const SLIDE_MS = 280;
  let current: Shown | null = null;
  let overflow = false;
  let sliced = false;
  let bottom = 1;
  let previous: Shown | null = null;
  let currentPx = 1;
  let slideFrom = 0;
  let slideWay: 1 | -1 = 1;
  return {
    group,
    screen,
    texture,
    clip,
    show(target, px, time, way) {
      if (!ctx) return false;
      const key = screenKey(target, px);
      const id = screenId(target);
      if (!family) family = fontFamily();
      if (current && id !== screenId(current) && shown) {
        // Another screen: one slide, started now.
        previous = current;
        slideFrom = time;
        slideWay = way;
      }
      current = target;
      currentPx = px;
      const t = previous ? Math.min(1, (time - slideFrom) / SLIDE_MS) : 1;
      if (previous && t < 1) {
        // Side by side, never one over the other. Eased out, as the apps' own pushes are.
        const e = 1 - Math.pow(1 - t, 3);
        paintScreen(ctx, canvas.width, canvas.height, family, art, previous, px, -e * slideWay);
        paintScreen(ctx, canvas.width, canvas.height, family, art, target, px, (1 - e) * slideWay);
        shown = "";
        texture.needsUpdate = true;
        return true;
      }
      previous = null;
      if (key === shown) return false;
      shown = key;
      paintScreen(ctx, canvas.width, canvas.height, family, art, target, px);
      overflow = painted.overflow;
      sliced = painted.sliced;
      bottom = painted.bottom;
      texture.needsUpdate = true;
      return false;
    },
    report() {
      const picture = pictureOf(currentPx);
      return { id: current ? screenId(current) : "", picture: picture.kind, type: picture.type, sliding: !!previous, overflow, sliced, bottom };
    },
    refresh() {
      shown = "";
      family = "";
    },
    dispose() {
      for (const thing of disposables) thing.dispose();
    },
  };
}
