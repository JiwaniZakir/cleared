/**
 * The bridge: the page's set, one physical thing standing on the floor.
 *
 *   your end      the lanes leave the phone here (the phone itself is the stage's, not the set's)
 *   the lanes     two thin rails, the upper one outbound and the lower one inbound, with comets of light
 *                 for agent traffic and one white card for the application
 *   cleared       a graphite plinth carrying four panes of frosted glass across the lanes; a pane that has
 *                 checked something is lit round its edge, and carries a small black check
 *   the pool      a wall of white tiles of one size, one for each company with open roles, each with the
 *                 company's own mark in the page's ink (lib/logos.ts)
 *
 * It is laid out from the page's own boxes (the director measures them in the bridge section), in the same
 * pixels as the page, so at rest in the wide shot every part stands exactly where its label is. The director
 * then moves the whole set as one (scale, turn, slide) to bring a station to the camera.
 *
 * Nothing here decides anything: every number comes from `live.set`.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SetGeometry, SetState } from "./live";
import { fitMarks, markOf, typeFor } from "@/lib/logos";

/** Drawn again, on their own, into the bloom: the lit edges of the panes, and the comets. */
export const EMIT = 2;
/** Not mirrored in the floor: flat things of light. */
const UNMIRRORED = 1;

const PRISM = ["#a162ff", "#56faf7", "#f8dcbb"] as const;
/** Each pane's own light, by its place along the bridge. */
const TINTS = [0.6, 0.2, 0.2, 0.6].map((far, i) => new THREE.Color(PRISM[1]).lerp(new THREE.Color(i < 2 ? PRISM[0] : PRISM[2]), far));
const WHITE = new THREE.Color("#ffffff");
/** At night a tile is dark glass: the ground its mark is read on, whatever the sky behind it is doing. */
const NIGHT_TILE = new THREE.Color("#0f0d1c");
const BLACK = new THREE.Color("#000000");
/** The page's one ink, for the companies' marks by day; and the one light ink they are drawn in at night. */
const INK = new THREE.Color("#000000");
const NIGHT_INK = new THREE.Color("#efeaff");
/** At night the outlines are dim, all alike; as the notification lands they brighten together, once. */
const RING_DIM = new THREE.Color("#6d64a8");
const RING_LIT = new THREE.Color("#e4dcff");
/** A mark is drawn only at this height on the page or more (smaller, it cannot be made out). */
const MARK_MIN = 11;
const NIGHT_FROST = new THREE.Color("#5b6f9c");
const UP = new THREE.Vector3(0, 1, 0);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.94 + 0.09 * Math.sin(t * Math.PI) + 0.06 * t);

export type BridgeSet = {
  group: THREE.Group;
  /** Lays every part out from the page's measurements. `X` and `Y` turn page pixels into stage units. */
  layout(geometry: SetGeometry, X: (px: number) => number, Y: (py: number) => number, names: readonly string[], family: string): void;
  update(state: SetState, day: number): void;
  /** For the bloom's pass: with `on`, every pane's edge is as bright as the light it gives off, and no brighter (an unlit one is black). */
  emit(on: boolean): void;
  /** For the checks: how much of the tiles' marks is showing (0: none, 1: all; between: fading), and whether every mark has been drawn. */
  report(): { marks: number; ready: boolean };
  /** For the checks: the wall's tiles as they stand, a tile's height and the height its mark is drawn at, in the set's own pixels. */
  wall(): { tiles: THREE.Object3D[]; tileH: number; markH: number };
  /** For the checks: every piece of the set that is drawn just now, by name (not the rail, the comets or the connector, which meet the phone by design). */
  pieces(): [string, THREE.Object3D][];
  dispose(): void;
};

function checkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0d0d0d";
    ctx.beginPath();
    ctx.arc(48, 48, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(28, 50);
    ctx.lineTo(42, 64);
    ctx.lineTo(68, 34);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A streak of the prism's light, bright at its head. */
function cometTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(161, 98, 255, 0)");
    g.addColorStop(0.55, "rgba(117, 122, 255, 0.85)");
    g.addColorStop(0.9, "rgba(86, 250, 247, 1)");
    g.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 4, 256, 8, 4);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Frost on a pane's face: denser toward its foot, with a fine grain. */
function frostTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    g.addColorStop(0.5, "rgba(244, 249, 252, 0.52)");
    g.addColorStop(1, "rgba(236, 244, 250, 0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const data = ctx.getImageData(0, 0, 64, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const n = Math.sin(i * 12.9898) * 43758.5453;
      data.data[i + 3] = Math.max(0, Math.min(255, data.data[i + 3] + ((n - Math.floor(n)) - 0.5) * 34));
    }
    ctx.putImageData(data, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** `changed` is called when something the set draws has arrived late (a company's mark, once its file has loaded). */
export function buildSet(changed: () => void = () => {}): BridgeSet {
  const group = new THREE.Group();
  const trash: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T): T => (trash.push(thing), thing);
  const unit = keep(new THREE.BoxGeometry(1, 1, 1));
  const flat = keep(new THREE.PlaneGeometry(1, 1));

  /* Materials. */
  // Standard, not physical, materials: the panes cover a large part of the picture, and the cheaper shading is what keeps every frame inside its sixtieth of a second.
  const graphite = keep(new THREE.MeshStandardMaterial({ color: "#2b2927", metalness: 0.5, roughness: 0.4 }));
  // One hairline, drawn after the glass so it runs on unbroken through every pane.
  const rail = keep(new THREE.MeshBasicMaterial({ color: "#8d8a85", transparent: true, depthWrite: false }));
  // Glass: a clear, slightly cool body whose bevelled edges take the room's light, under a frosted face.
  const glassOf = () => keep(new THREE.MeshStandardMaterial({ color: "#dfeaf1", metalness: 0, roughness: 0.12, transparent: true, opacity: 0.46, envMapIntensity: 2, emissive: "#9fd8ff", emissiveIntensity: 0, depthWrite: false }));
  const frostMap = keep(frostTexture());
  const edgeOf = () => keep(new THREE.MeshBasicMaterial({ color: "#000000", toneMapped: false }));
  const disc = keep(new THREE.MeshBasicMaterial({ map: keep(checkTexture()), transparent: true, depthWrite: false, toneMapped: false }));
  // Not additive: on a bone floor added light is invisible. The streak is the prism's own colour, and the bloom adds its glow.
  const streak = keep(new THREE.MeshBasicMaterial({ map: keep(cometTexture()), transparent: true, depthWrite: false, toneMapped: false }));
  const fanMaterial = keep(new THREE.LineBasicMaterial({ color: "#000000", transparent: true, opacity: 0.14 }));

  /* The rail: one continuous hairline, from your end to the companies (and down a narrow window, a lead-in from your phone's foot to its start). */
  const lanes = [new THREE.Mesh(unit, rail)];
  // The lead-in is a curve (it leaves your phone's foot, runs along under the phone and turns down into the
  // row's start, clear of the panes), drawn as short straight pieces.
  const LEAD_PIECES = 18;
  const leadRail = keep(new THREE.MeshBasicMaterial({ color: "#8d8a85", transparent: true, depthWrite: false }));
  const leadLanes = Array.from({ length: LEAD_PIECES }, () => new THREE.Mesh(unit, leadRail));
  for (const lane of [...lanes, ...leadLanes]) {
    lane.renderOrder = 2;
    group.add(lane);
  }
  const comets: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const comet = new THREE.Mesh(flat, streak);
    comet.layers.set(UNMIRRORED);
    comet.layers.enable(EMIT);
    comets.push(comet);
    group.add(comet);
  }

  /* cleared: the plinth and its four panes. */
  const plinth = new THREE.Mesh(unit, graphite);
  plinth.castShadow = true;
  group.add(plinth);
  const panes = Array.from({ length: 4 }, () => {
    const holder = new THREE.Group();
    const glass = glassOf();
    // The slab is a block of glass with rounded edges, cut to size when the set is laid out; its face is frosted.
    const slab = new THREE.Mesh(unit, glass);
    slab.castShadow = true;
    const frost = new THREE.Mesh(flat, keep(new THREE.MeshBasicMaterial({ map: frostMap, transparent: true, depthWrite: false, toneMapped: false })));
    holder.add(frost);
    const edge = edgeOf();
    // The lit rim: four thin bars round the pane's face. They are the part that gives off light.
    const bars = Array.from({ length: 4 }, () => {
      const bar = new THREE.Mesh(unit, edge);
      bar.layers.enable(EMIT);
      holder.add(bar);
      return bar;
    });
    const check = new THREE.Mesh(flat, disc);
    check.layers.set(UNMIRRORED);
    holder.add(slab);
    group.add(holder, check);
    return { holder, slab, glass, frost, edge, bars, check, at: new THREE.Vector3(), size: new THREE.Vector2(1, 1), shown: new THREE.Color(), light: new THREE.Color(), r: 1 };
  });

  /* The connector: a short block that slides along the lanes and locks at the phone. */
  const coupling = new THREE.Group();
  coupling.add(new THREE.Mesh(keep(new RoundedBoxGeometry(1, 0.52, 0.6, 4, 0.08)), graphite));
  const couplingGlass = glassOf();
  const half = new THREE.Mesh(keep(new RoundedBoxGeometry(0.46, 0.56, 0.64, 4, 0.08)), couplingGlass);
  half.position.x = -0.3;
  coupling.add(half);
  coupling.traverse((child) => child instanceof THREE.Mesh && (child.castShadow = true));
  group.add(coupling);

  /*
   * The five roles: one finished object each, a lozenge of frosted glass with a soft inner light and no outline,
   * too small for words (what they are is printed beside them: "5 roles"). A held one dims and drops beside its
   * reason. Nothing rides with them and nothing trails them. Drawn after the glass, so a pane never fogs them.
   */
  const tokenShape = new THREE.Shape();
  {
    const w = 1, h = 0.66, r = 0.16;
    tokenShape.moveTo(-w / 2 + r, -h / 2);
    tokenShape.lineTo(w / 2 - r, -h / 2);
    tokenShape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    tokenShape.lineTo(w / 2, h / 2 - r);
    tokenShape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    tokenShape.lineTo(-w / 2 + r, h / 2);
    tokenShape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    tokenShape.lineTo(-w / 2, -h / 2 + r);
    tokenShape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  }
  const tokenFace = keep(new THREE.ShapeGeometry(tokenShape, 8));
  {
    // Its texture coordinates run over the lozenge's own box, so the glass is painted to its shape.
    const uv = tokenFace.attributes.uv;
    const pos = tokenFace.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) + 0.5, (pos.getY(k) + 0.33) / 0.66);
  }
  const glassToken = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 106;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Frosted glass: white at its heart, cooler toward its rim, lit from within along its edge by the prism.
      const body = ctx.createLinearGradient(0, 0, 0, 106);
      body.addColorStop(0, "#ffffff");
      body.addColorStop(1, "#e7ebf8");
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, 160, 106);
      const rim = ctx.createLinearGradient(0, 0, 160, 0);
      rim.addColorStop(0, "rgba(161, 98, 255, 0.55)");
      rim.addColorStop(1, "rgba(86, 200, 247, 0.55)");
      ctx.strokeStyle = rim;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.roundRect(4.5, 4.5, 151, 97, 24);
      ctx.stroke();
      const glow = ctx.createRadialGradient(80, 40, 4, 80, 53, 80);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 160, 106);
    }
    const texture = keep(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  const tokens = [0, 1, 2, 3, 4].map(() => {
    const holder = new THREE.Group();
    const material = keep(new THREE.MeshBasicMaterial({ map: glassToken, transparent: true, depthWrite: false, toneMapped: false }));
    const face = new THREE.Mesh(tokenFace, material);
    face.renderOrder = 3;
    holder.add(face);
    holder.traverse((child) => child.layers.set(UNMIRRORED));
    group.add(holder);
    return { holder, face: material };
  });
  /**
   * Which tile each of the three roles that cross lands on: three different companies, in the column (across a
   * wide window) or the row (down a narrow one) nearest the lanes, so a role never passes over another tile.
   */
  let LANDS = [0, 4, 6];

  /*
   * The pool: one body. A wall of nine tiles of one size, each with its company's own mark in the page's ink
   * (or, where there is no mark to show, its name in type), on clean ground. It comes and goes as one.
   */
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = atlasCanvas.height = 2048;
  const atlas = keep(new THREE.CanvasTexture(atlasCanvas));
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 8;
  // By day each tile is a slab of the stage's frosted glass: a little of the room shows through it, the room's
  // light along its rim (`dayRim`), and its company's mark on it in the page's ink.
  const tileMaterial = keep(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.32, roughness: 0.45, metalness: 0, envMapIntensity: 1.6, transparent: true }));
  const dayRim = keep(new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.9 }));
  // The marks are a layer of their own, so they can go when the tiles are too small to show them, and at night.
  const nameMaterial = keep(new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, toneMapped: false }));
  const pool = new THREE.Group();
  group.add(pool);
  type Tile = { mesh: THREE.Mesh; home: THREE.Vector3; phase: number; w: number; h: number; outline: THREE.Mesh };
  // At night the wall is outlines, each with its company's mark in a light ink: nine rings alike, never one singled out.
  const nightOutline = keep(new THREE.MeshBasicMaterial({ color: RING_DIM, toneMapped: false, transparent: true }));
  /** The wall's size in its own pixels, whether it grows from its edge on the lanes' side, and where the fan's lines end on it. */
  let wallW = 0;
  let wallFromLeft = true;
  let fanEnds: { tile: number; dx: number; dy: number }[] = [];
  let tiles: Tile[] = [];
  /** The companies' marks, loaded once from this site. */
  const images = new Map<string, HTMLImageElement>();
  /** What the atlas holds: each tile's company, how its mark is fitted, the tile's size, and the size a mark is drawn at. */
  let wall: { names: readonly string[]; fitted: ReturnType<typeof fitMarks>; w: number; h: number; family: string } | null = null;
  let markH = 14;
  let drawn = false;
  const scratch = document.createElement("canvas");
  const K = 4; // the marks are drawn at four times their size on the page
  /** Draws every tile's mark into the atlas, in the ink: each file's own shapes, its colours replaced by the ink through its alpha. */
  const paintWall = () => {
    const ctx = atlasCanvas.getContext("2d");
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx || !sctx || !wall) return;
    const { names, fitted, w, h, family } = wall;
    const cw = Math.ceil(w * K);
    const ch = Math.ceil(h * K);
    scratch.width = cw;
    scratch.height = ch;
    ctx.clearRect(0, 0, 2048, 2048);
    let missing = 0;
    names.forEach((name, i) => {
      const ax = (i % 3) * (cw + 8);
      const ay = Math.floor(i / 3) * (ch + 8);
      const fit = fitted[i];
      if (!fit) {
        // No mark to show: the company's name in type, its capitals about as tall as the marks' letters.
        const type = typeFor(markH);
        ctx.font = `${type.weight} ${type.size * K}px ${family}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(-0.02 * type.size * K).toFixed(1)}px`;
        const m = ctx.measureText(name);
        ctx.fillText(name, ax + cw / 2, ay + ch / 2 + m.actualBoundingBoxAscent / 2);
        if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
        return;
      }
      const image = images.get(name);
      if (!image || !image.complete || !image.naturalWidth) {
        missing++;
        return;
      }
      sctx.clearRect(0, 0, cw, ch);
      sctx.drawImage(image, cw / 2 + fit.file.x * K, ch / 2 + fit.file.y * K, fit.file.w * K, fit.file.h * K);
      // In one colour: every pixel white, at the file's own alpha (its faintest, a ground of 1/255, left out; a
      // lighter second tone raised to solid, as the rest of the mark). The material's colour is the ink: the
      // page's by day, a light one at night.
      const data = sctx.getImageData(0, 0, cw, ch);
      const px = data.data;
      const solid = fit.mark.solid * fit.mark.weight;
      for (let k = 0; k < px.length; k += 4) {
        px[k] = px[k + 1] = px[k + 2] = 255;
        px[k + 3] = px[k + 3] < 6 ? 0 : Math.min(255, px[k + 3] * solid);
      }
      sctx.putImageData(data, 0, 0);
      ctx.drawImage(scratch, ax, ay);
    });
    drawn = missing === 0;
    atlas.needsUpdate = true;
  };
  const loadMarks = (names: readonly string[]) => {
    for (const name of names) {
      const mark = markOf(name);
      if (!mark || images.has(name)) continue;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        paintWall();
        changed();
      };
      image.src = mark.src;
      images.set(name, image);
    }
  };
  // A tick for each of the three tiles a role lands on, at the tile's corner, clear of its name.
  const tileChecks = [0, 1, 2].map(() => {
    const check = new THREE.Mesh(flat, disc);
    check.layers.set(UNMIRRORED);
    check.renderOrder = 5;
    group.add(check);
    return check;
  });
  const fan = new THREE.LineSegments(keep(new THREE.BufferGeometry()), fanMaterial);
  fan.layers.set(UNMIRRORED);
  group.add(fan);
  // At night a reply is a comet: out of the wall at the lanes' end and back along the lower lane.
  const replyComets = [0, 1, 2].map(() => {
    const comet = new THREE.Mesh(flat, streak);
    comet.layers.set(UNMIRRORED);
    comet.layers.enable(EMIT);
    group.add(comet);
    return comet;
  });

  let geo: SetGeometry | null = null;
  const held = new THREE.Color();
  const heldGlow = new THREE.Color();
  let start = new THREE.Vector3();
  let end = new THREE.Vector3();
  const poolAt = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const corner = new THREE.Vector3();
  /** A tile's place in the set (the pool's own place and size applied). */
  const tilePlace = (i: number, out: THREE.Vector3) => {
    const tile = tiles[Math.min(tiles.length - 1, Math.max(0, i))];
    // On its upper left corner, where its tick goes (the corner on the lanes' side at both sizes): only a quarter
    // of the tick is on the tile, in the corner the mark's padding keeps clear, so it never touches the mark.
    return tile ? out.copy(tile.mesh.position).add(corner.set(-tile.w * 0.5 + 1, tile.h * 0.5 - 1, 0)).multiplyScalar(pool.scale.x).applyAxisAngle(UP, pool.rotation.y).add(pool.position) : out.copy(end);
  };
  /** Along a lane, and past its end (u from 1 to 1.2) on into the pool to a tile. */
  const path = (u: number, lane: -1 | 0 | 1, tile: number, out: THREE.Vector3) => {
    if (u <= 1) return along(u, lane, out);
    const from = along(1, lane, out).clone();
    return out.lerpVectors(from, tilePlace(tile, spot), ease(clamp((u - 1) / 0.2)));
  };
  let across = 12;
  /** A landing tick's radius; the plinth's top (across a wide window), where a held role comes to rest. */
  let tickR = 7;
  /** The plinth's left end, in the set's own place (across a wide window it may start later, at the cut). */
  let plinthLeft = 0;
  let plinthTop = 0;
  /** Down a narrow window: your phone's foot (the lead-in's top), and the lead-in's length as a share of the rail's. */
  const leadFrom = new THREE.Vector3();
  const leadBend = new THREE.Vector3();
  let leadU = 0;
  /** A point on the lead-in, `t` from 0 at your phone's foot to 1 at the rail's start (a quadratic curve). */
  const leadAt = (t: number, out: THREE.Vector3) => {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return out.set(a * leadFrom.x + b * leadBend.x + c * start.x, a * leadFrom.y + b * leadBend.y + c * start.y, 0);
  };
  const leadA = new THREE.Vector3();
  const leadB = new THREE.Vector3();
  /** The page's pixels as the set's own place (from the last layout). */
  let X0 = (px: number) => px;
  let Y0 = (py: number) => -py;
  /** A place along the lanes, 0 at your end and 1 at the pool, on the upper (-1) or lower (+1) lane. (Below 0, on the lead-in, where there is one.) */
  const along = (u: number, lane: -1 | 0 | 1, out = new THREE.Vector3()) => {
    if (u < 0 && leadU > 0) return leadAt(1 - Math.min(1, -u / leadU), out);
    out.lerpVectors(start, end, u);
    if (geo?.axis === "y") out.x += (lane * across) / 2;
    else out.y -= (lane * across) / 2;
    return out;
  };

  return {
    group,
    layout(geometry, X, Y, names, fontFamily) {
      geo = geometry;
      X0 = X;
      Y0 = Y;
      const x = geometry.axis === "x";
      across = geometry.gap;
      start = new THREE.Vector3(X(geometry.start[0]), Y(geometry.start[1]), 0);
      end = new THREE.Vector3(X(geometry.end[0]), Y(geometry.end[1]), 0);
      const length = start.distanceTo(end);

      lanes.forEach((lane, i) => {
        const mid = along(0.5, i === 0 ? -1 : 1);
        lane.position.copy(mid);
        lane.scale.set(x ? length : 2, x ? 2 : length, 2);
        lane.userData.length = length;
      });

      // The plinth lies along the lanes under the panes (across a wide window), or behind them as a spine (down a narrow one).
      const p = geometry.plinth;
      plinthLeft = X(p.x);
      plinth.position.set(X(p.x + p.w / 2), Y(p.y + p.h / 2), x ? 0 : -geometry.pane[1] * 0.6);
      plinth.scale.set(p.w, p.h, x ? geometry.pane[1] * 0.42 : 8);

      const [pw, ph] = geometry.pane;
      panes.forEach((pane, i) => {
        const [cx, cy] = geometry.panes[i];
        pane.at.set(X(cx), Y(cy), 0);
        pane.size.set(pw, ph);
        pane.holder.position.copy(pane.at);
        // Across a wide window a pane stands across the lanes and is seen at an angle; down a narrow one it lies across them, tipped to show its top.
        const depth = x ? ph * 0.34 : ph * 2.2;
        const thick = x ? Math.max(10, ph * 0.05) : Math.max(7, ph * 0.42);
        if (pane.slab.geometry !== unit) pane.slab.geometry.dispose();
        pane.slab.geometry = x ? new RoundedBoxGeometry(thick, ph, depth, 3, thick * 0.42) : new RoundedBoxGeometry(pw, thick, depth, 3, thick * 0.42);
        pane.slab.scale.set(1, 1, 1);
        if (x) {
          // (Down a narrow window, turned less: the row is small, and its faces are what is read.)
          pane.holder.rotation.set(0, geometry.lead ? -0.55 : -0.92, 0);
          pane.frost.rotation.set(0, Math.PI / 2, 0);
          pane.frost.position.set(thick / 2 + 0.5, 0, 0);
          pane.frost.scale.set(depth - thick, ph - thick, 1);
        } else {
          pane.holder.rotation.set(0.5, 0, 0);
          pane.frost.rotation.set(-Math.PI / 2, 0, 0);
          pane.frost.position.set(0, thick / 2 + 0.5, 0);
          pane.frost.scale.set(pw - thick, depth - thick, 1);
        }
        // The rim, round the face that looks at the camera.
        const b = 3;
        const [fw, fh, fz] = x ? [depth - 2, ph - 2, thick / 2 + 1] : [pw - 2, depth - 2, thick / 2 + 1];
        pane.bars.forEach((bar, k) => {
          const horizontal = k < 2;
          const sign = k % 2 === 0 ? -1 : 1;
          if (x) {
            bar.scale.set(b, horizontal ? b : fh, horizontal ? fw : b);
            bar.position.set(fz, horizontal ? (sign * fh) / 2 : 0, horizontal ? 0 : (sign * fw) / 2);
          } else {
            bar.scale.set(horizontal ? fw : b, b, horizontal ? b : fh);
            bar.position.set(horizontal ? 0 : (sign * fw) / 2, fz, horizontal ? (sign * fh) / 2 : 0);
          }
        });
        const r = Math.max(9, (x ? pw : ph) * 0.2);
        pane.r = r * 2;
        pane.check.scale.set(r * 2, r * 2, 1);
        pane.check.position.set(pane.at.x + (x ? 0 : pw / 2 + r * 0.2), pane.at.y + (x ? ph / 2 + r * 1.1 : r * 1.2), x ? 2 : depth * 0.3);
      });

      coupling.scale.setScalar(geometry.pane[x ? 1 : 0] * 0.24);

      /*
       * The pool: a wall of tiles of one size, in rows about the pool's centre (two columns across a wide window,
       * three down a narrow one), flat to the camera so no tile ever stands over another.
       */
      for (const tile of tiles) tile.mesh.traverse((child) => child instanceof THREE.Mesh && child.geometry.dispose());
      for (const tile of tiles) pool.remove(tile.mesh);
      tiles = [];
      const box = geometry.pool;
      poolAt.set(X(box.x + box.w / 2), Y(box.y + box.h / 2), 0);
      pool.position.copy(poolAt);
      const seeded = (n: number) => {
        const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
      };
      // (Three a row at both sizes: a balanced block of nine.)
      const columns = 3;
      const rows = Math.ceil(names.length / columns);
      const gap = x ? 10 : 8;
      const w = (box.w - (columns - 1) * gap) / columns;
      const h = Math.min(w * 0.42, (box.h - (rows - 1) * gap) / rows);
      // The marks' room in a tile, clear of its corners (where a tick can stand).
      const padX = Math.max(10, w * 0.09);
      const padY = h * 0.25;
      const fitted = fitMarks(names, w - 2 * padX, h - 2 * padY);
      const heights = fitted.flatMap((fit) => (fit ? [fit.inkH] : [])).sort((a, b) => a - b);
      markH = heights.length ? heights[Math.floor(heights.length / 2)] : h * 0.3;
      wall = { names, fitted, w, h, family: fontFamily };
      // The three tiles a role lands on: in the column nearest the lanes (across), or the row nearest them (down).
      // The same three companies at both sizes: the first, third and fifth, in the column nearest the lanes across a
      // wide window, and moved to the row nearest them down a narrow one (the wall is otherwise in the listing's order).
      LANDS = [0, 2, 4].map((n) => Math.min(n, names.length - 1));
      // The three a role lands on are nearest the rail's end: in the left column where the rail comes from the
      // left (across a wide window), in the top row where it comes from above (down a narrow one).
      const fromLeft = geometry.end[0] < box.x;
      const rest = names.map((_, i) => i).filter((i) => !LANDS.includes(i));
      const order = fromLeft ? [LANDS[0], rest[0], rest[1], LANDS[1], rest[2], rest[3], LANDS[2], ...rest.slice(4)] : [...LANDS, ...rest];
      tickR = Math.round(Math.min(w, h) * 0.15);
      plinthTop = Y(geometry.plinth.y);
      const r = Math.min(10, h * 0.2);
      /** A rounded rectangle about the centre, drawn into a shape or a hole. */
      const rounded = <T extends THREE.Path>(path: T, w: number, h: number, r: number): T => {
        path.moveTo(-w / 2 + r, -h / 2);
        path.lineTo(w / 2 - r, -h / 2);
        path.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
        path.lineTo(w / 2, h / 2 - r);
        path.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
        path.lineTo(-w / 2 + r, h / 2);
        path.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
        path.lineTo(-w / 2, -h / 2 + r);
        path.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
        return path;
      };
      const shape = rounded(new THREE.Shape(), w, h, r);
      // The outline lit at night: a ring just outside the tile's edge (a filled shape would show through the night's dim glass as a bar of light).
      const ring = rounded(new THREE.Shape(), w + 6, h + 6, r + 3);
      ring.holes.push(rounded(new THREE.Path(), w - 1, h - 1, r));
      const ringGeometry = new THREE.ShapeGeometry(ring, 6);
      const cw = Math.ceil(w * K);
      const ch = Math.ceil(h * K);
      names.forEach((_, i) => {
        const ax = (i % 3) * (cw + 8);
        const ay = Math.floor(i / 3) * (ch + 8);
        const face = new THREE.PlaneGeometry(w, h);
        const uv = face.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (ax + uv.getX(k) * w * K) / 2048, 1 - (ay + (1 - uv.getY(k)) * h * K) / 2048);
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 6), tileMaterial);
        mesh.castShadow = true;
        // (Not mirrored in the floor: no dark tiles under the horizon at night.)
        mesh.layers.set(UNMIRRORED);
        mesh.layers.enable(EMIT);
        // Its outline: the day's rim, or the night's ring.
        const outline = new THREE.Mesh(i === 0 ? ringGeometry : ringGeometry.clone(), nightOutline);
        outline.position.z = 0.3;
        outline.visible = false;
        outline.layers.set(UNMIRRORED);
        outline.layers.enable(EMIT);
        mesh.add(outline);
        const label = new THREE.Mesh(face, nameMaterial);
        label.position.z = 0.6;
        label.layers.set(UNMIRRORED);
        mesh.add(label);
        const cell = order.indexOf(i);
        const row = Math.floor(cell / columns);
        const inRow = Math.min(columns, names.length - row * columns);
        const home = new THREE.Vector3((cell % columns - (inRow - 1) / 2) * (w + gap), ((rows - 1) / 2 - row) * (h + gap), 0);
        tiles.push({ mesh, home, phase: seeded(i + 40) * 6.28, w, h, outline });
        pool.add(mesh);
      });
      loadMarks(names);
      paintWall();
      wallW = Math.max(...tiles.map((tile) => tile.home.x + tile.w / 2)) - Math.min(...tiles.map((tile) => tile.home.x - tile.w / 2));
      wallFromLeft = fromLeft;
      // The lanes fan out into the wall: a hairline from their end to each tile on their side (placed as the wall stands, in `update`).
      fanEnds = [];
      tiles.forEach((tile, i) => {
        const cell = order.indexOf(i);
        const near = fromLeft ? cell % columns === 0 : cell < columns;
        if (near) fanEnds.push({ tile: i, dx: fromLeft ? -tile.w / 2 : 0, dy: fromLeft ? 0 : tile.h / 2 });
      });
      fan.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Array(fanEnds.length * 6).fill(0), 3));
    },

    update(s, day) {
      if (!geo) return;
      const x = geo.axis === "x";
      group.visible = s.show > 0.004;
      if (!group.visible) return;
      const night = 1 - day;
      rail.color.set(night > 0.5 ? "#4a4852" : "#8d8a85");
      leadRail.color.copy(rail.color);
      leadRail.opacity = s.leadOn;
      fanMaterial.color.set(night > 0.5 ? "#ffffff" : "#000000");
      fanMaterial.opacity = 0.14 * s.pool;

      /* The rail draws out from the phone. */
      const length = start.distanceTo(end);
      // Down a narrow window, the lead-in from your phone's foot.
      if (geo.lead && s.from) {
        leadFrom.set(X0(s.from[0]), Y0(s.from[1]), 0);
        // It bends at the rail's start, a little under the phone's foot: along under the phone, then down.
        leadBend.set(start.x, leadFrom.y - 10, 0);
        let d = 0;
        leadAt(0, leadA);
        for (let i = 1; i <= LEAD_PIECES; i++) {
          leadAt(i / LEAD_PIECES, leadB);
          d += leadA.distanceTo(leadB);
          leadA.copy(leadB);
        }
        leadU = d / Math.max(1, length);
      } else leadU = 0;
      leadLanes.forEach((piece, i) => {
        piece.visible = leadU > 0 && s.lanes > 0.002 && s.leadOn > 0.01;
        if (!piece.visible) return;
        leadAt(i / LEAD_PIECES, leadA);
        leadAt((i + 1) / LEAD_PIECES, leadB);
        piece.position.lerpVectors(leadA, leadB, 0.5);
        piece.scale.set(leadA.distanceTo(leadB) + 0.6, 1.5, 1.5);
        piece.rotation.z = Math.atan2(leadB.y - leadA.y, leadB.x - leadA.x);
      });
      lanes.forEach((lane) => {
        const to = Math.max(0.0001, s.lanes);
        // Once the camera has left your end it runs on behind the phone, so the bridge never ends in mid-air.
        // (Down a narrow window it starts at the row: the lead-in comes down to it from your phone.)
        const from = Math.min(to, leadU > 0 ? 0 : Math.max(-0.7 * s.lead, x ? -9 : s.cut));
        const mid = along((from + to) / 2, 0);
        lane.position.copy(mid);
        lane.scale.set(x ? length * (to - from) : 1.5, x ? 1.5 : length * (to - from), 1.5);
        lane.visible = s.lanes > 0.002;
      });

      /* Agent traffic: comets along the rail, out and back. */
      const tail = geo.comet;
      comets.forEach((comet, i) => {
        const outbound = i % 2 === 0;
        const u = (s.traffic * 0.9 + i * 0.137 + (outbound ? 0 : 0.5)) % 1;
        const at = along(outbound ? u : 1 - u, 0);
        comet.position.set(at.x, at.y, 1);
        comet.scale.set(tail, Math.max(3, tail / 30), 1);
        comet.rotation.z = (x ? 0 : -Math.PI / 2) + (outbound ? 0 : Math.PI);
        // A comet shows only on the part of the lane that is drawn, and fades at the lane's two ends.
        const edge = Math.min(u, 1 - u) * 8;
        comet.visible = s.comets > 0.01 && (outbound ? u : 1 - u) < s.lanes && (outbound ? u : 1 - u) > s.cut;
        (comet.material as THREE.MeshBasicMaterial).opacity = 1;
        comet.scale.x = tail * clamp(edge) * (0.5 + 0.5 * s.comets);
        comet.scale.y *= s.comets;
      });

      /* cleared. */
      const assemble = s.layer;
      // (With some of the panes alone in the picture, at a stop, the plinth is not: it would run on behind the
      // phone, under the card and out of the window. They stand on the floor.)
      plinth.visible = assemble > 0.01 && geo.plinth.w > 0 && s.only < 0;
      // (Across a wide window it starts at the cut: never behind the phone.)
      if (x && plinth.visible) {
        const p = geo.plinth;
        const left = Math.max(plinthLeft, along(s.cut, 0).x);
        const right = plinthLeft + p.w;
        plinth.visible = right - left > 4;
        plinth.position.x = (left + right) / 2;
        plinth.scale.x = Math.max(1, right - left);
      }
      graphite.opacity = 1;
      const g = geo;
      panes.forEach((pane, i) => {
        // Each pane rises into place a moment after the one before it.
        // (A pane the frame carries up to the cut goes before it reaches it; across a wide window, a pane that
        // would stand behind the phone is not there.)
        const near = x ? (g.panes[i][0] - g.pane[0] * 0.8 - g.start[0]) / Math.max(1, g.end[0] - g.start[0]) : (g.panes[i][1] - g.pane[1] * 0.95 - g.start[1]) / Math.max(1, g.end[1] - g.start[1]);
        const below = clamp(((near - s.cut) * length) / 24);
        const shown = s.only < 0 || s.only === i || (s.only === 4 && i < 3);
        const k = ease(clamp(assemble * 1.6 - i * 0.2)) * (shown ? 1 : 0) * below;
        pane.holder.visible = k > 0.01;
        pane.holder.position.set(pane.at.x, pane.at.y - (1 - k) * 24, pane.at.z);
        const lit = Math.max(s.lit[i], s.glow[i] * 0.5, night * 0.14);
        pane.glass.opacity = (0.46 + 0.16 * s.lit[i]) * k;
        pane.glass.emissiveIntensity = 0.5 * lit;
        pane.glass.emissive.copy(TINTS[i]);
        (pane.frost.material as THREE.MeshBasicMaterial).opacity = k * lerp(0.9, 0.6, day);
        (pane.frost.material as THREE.MeshBasicMaterial).color.copy(night > 0.5 ? NIGHT_FROST : WHITE).lerp(TINTS[i], 0.5 * lit);
        // The luminous rim is only there while the pane is lit: unlit, the glass speaks for itself.
        for (const bar of pane.bars) bar.visible = lit > 0.03;
        // The rim takes the prism's colour for this place along the bridge: purple toward your end, cream toward
        // the companies, aqua between. Unlit, it is a quiet edge the colour of the frame.
        pane.light.copy(TINTS[i]).multiplyScalar(lit * 1.9);
        pane.shown.copy(WHITE).lerp(TINTS[i], clamp(1.3 - lit * 0.5));
        pane.edge.color.copy(pane.shown);
        const c = pop(s.checks[i]);
        pane.check.visible = k > 0.5 && c > 0.01;
        pane.check.scale.set(pane.r * c, pane.r * c, 1);
      });

      /* The connector. */
      // (Down a narrow window it comes from beyond your end of the rail: there its place is below 0.)
      coupling.visible = s.coupling.u > -5 && (s.coupling.u >= 0 || leadU > 0 || s.coupling.u > -0.99);
      if (coupling.visible) {
        const at = along(s.coupling.u, 0);
        coupling.position.set(at.x, at.y, 0);
        // (On the lead-in it lies along it, its glass end toward your phone.)
        if (s.coupling.u < 0 && leadU > 0) {
          const t = 1 - Math.min(1, -s.coupling.u / leadU);
          leadAt(Math.max(0, t - 0.02), leadA);
          leadAt(Math.min(1, t + 0.02), leadB);
          coupling.rotation.z = Math.atan2(leadB.y - leadA.y, leadB.x - leadA.x);
        } else coupling.rotation.z = x ? 0 : Math.PI / 2;
        couplingGlass.emissive.set(PRISM[0]);
        couplingGlass.emissiveIntensity = 0.4 + 2.2 * s.coupling.lock;
        couplingGlass.opacity = 0.55;
      }

      /* The roles. */
      const size = geo.cardSize[0];
      tokens.forEach((token, i) => {
        const u = s.tokens[i]?.u ?? -1;
        // Landed, it is on its tile (the tile's tick says so): the token itself is gone. (Not drawn before the cut.)
        token.holder.visible = u > -5 && u >= -leadU && u < 1.17 && (u < 0 || u > s.cut + (size * 0.6) / Math.max(1, length));
        if (!token.holder.visible) return;
        const into = clamp((u - 1) / 0.2);
        const at = path(u, 0, LANDS[i] ?? 0, spot);
        const held = s.tokens[i].held;
        // A held one dims and drops off the rail beside its reason: across a wide window down the pane to just
        // above the plinth (the reason is under it); down a narrow one, aside toward the words.
        const drop = x ? Math.max(size * 1.1, (start.y - plinthTop) * 0.78) : size * 1.15;
        const down = held * drop;
        token.holder.position.set(at.x + (x ? 0 : down), at.y - (x ? down : 0), at.z + 3 + i * 0.2);
        token.holder.scale.setScalar(size * lerp(1, 0.45, into));
        token.face.color.set(held ? "#a9a7b4" : "#ffffff");
        token.face.opacity = held ? 0.62 : 1;
      });
      // At night the replies are comets: each out of the wall at the lanes' end, along the rail and back to you.
      // (Out of the wall as a whole: no company's tile is singled out as the one that wrote.)
      replyComets.forEach((comet, i) => {
        const u = s.replies[i] ?? -1;
        comet.visible = u >= 0;
        if (!comet.visible) return;
        const at = along(u, 0, spot);
        const ahead = along(Math.max(0, u - 0.02), 0, new THREE.Vector3());
        comet.position.set(at.x, at.y, at.z + 2);
        comet.rotation.z = Math.atan2(ahead.y - at.y, ahead.x - at.x);
        comet.scale.set(tail * 1.5 * clamp(Math.min(u, 1 - u) * 10), Math.max(4, tail / 16), 1);
      });

      /* The pool: it comes and goes as one body, and drifts as one. */
      const settle = ease(s.pool);
      pool.visible = settle > 0.01;
      // In the night's wide shot the set is small; the wall is enlarged with it, so its marks are drawn at
      // MARK_MIN or more: about its edge on the lanes' side across a wide window (it grows away from the panes),
      // about its middle down a narrow one.
      const drawnAt = s.scale * markH;
      // (Taken up early in the move into the shot, so a mark is never smaller than that on the way.)
      const grow = lerp(1, Math.max(1, (MARK_MIN + 0.8) / Math.max(0.01, drawnAt)), clamp(s.wallGrow * 4));
      const base = 0.72 + 0.28 * settle;
      pool.scale.setScalar(base * grow);
      pool.position.copy(poolAt);
      if (wallFromLeft) pool.position.x += ((grow - 1) * base * wallW) / 2;
      {
        const at = fan.geometry.attributes.position as THREE.BufferAttribute;
        const from = along(1, 0, spot);
        fanEnds.forEach((end, n) => {
          const tile = tiles[end.tile];
          if (!tile) return;
          at.setXYZ(n * 2, from.x, from.y, 0);
          at.setXYZ(n * 2 + 1, pool.position.x + (tile.home.x + end.dx) * pool.scale.x, pool.position.y + (tile.home.y + end.dy) * pool.scale.x, tile.home.z);
        });
        at.needsUpdate = true;
      }
      // Across a wide window it sways a little as it drifts; down a narrow one the picture is flat, and so is the wall.
      pool.rotation.y = x ? Math.sin(s.traffic * 1.3) * 0.04 : 0;
      // By day white tiles with the companies' marks in the page's ink; at night dark tiles in their outlines, the marks in a light ink.
      tileMaterial.opacity = settle * (day >= 0.5 ? 0.8 * (day * 2 - 1) : 0.9 * (1 - day * 2));
      tileMaterial.emissiveIntensity = lerp(0.3, 0.32, day);
      dayRim.opacity = settle * 0.95 * clamp(day * 2 - 1);
      tileMaterial.color.copy(NIGHT_TILE).lerp(WHITE, day);
      tileMaterial.emissive.copy(BLACK).lerp(WHITE, day);
      // The marks are there while they are large enough to make out (smaller than that, the tiles are plain), by day and by night.
      nameMaterial.opacity = ease(clamp((drawnAt * grow - MARK_MIN) / 0.5)) * settle;
      nameMaterial.color.copy(INK).lerp(NIGHT_INK, night);
      nightOutline.color.copy(RING_DIM).lerp(RING_LIT, s.ring);
      // (It holds still: turned, it would reach the words over and under the wall.)
      tiles.forEach((tile) => {
        // A tile stays in its place in the wall (a landing is its tick, at its corner). (No drift: the rows stay level.)
        tile.mesh.position.set(tile.home.x, tile.home.y, tile.home.z);
        tile.mesh.scale.setScalar(1);
        tile.outline.visible = true;
        tile.outline.material = night > 0.5 ? nightOutline : dayRim;
      });
      tileChecks.forEach((check, n) => {
        const tile = tiles[LANDS[n]];
        check.visible = !!tile && pool.visible && (s.ticks[n] ?? 0) > 0.5 && day > 0.5;
        if (!tile || !check.visible) return;
        const at = tilePlace(LANDS[n], spot);
        check.scale.set(tickR * 2, tickR * 2, 1);
        check.position.set(at.x, at.y, at.z + 2);
      });
    },

    pieces() {
      const list: [string, THREE.Object3D][] = [];
      if (!group.visible) return list;
      if (plinth.visible) list.push(["plinth", plinth]);
      panes.forEach((pane, i) => {
        if (pane.holder.visible) list.push([`pane ${i}`, pane.holder]);
        if (pane.check.visible) list.push([`pane ${i}'s tick`, pane.check]);
      });
      tokens.forEach((token, i) => token.holder.visible && list.push([`role ${i}`, token.holder]));
      if (pool.visible) tiles.forEach((tile, i) => list.push([`tile ${i}`, tile.mesh]));
      tileChecks.forEach((check, i) => check.visible && list.push([`tile tick ${i}`, check]));
      return list;
    },

    report() {
      return { marks: pool.visible ? nameMaterial.opacity : 0, ready: drawn };
    },

    wall() {
      return { tiles: pool.visible ? tiles.map((tile) => tile.mesh) : [], tileH: tiles[0]?.h ?? 0, markH };
    },

    emit(on) {
      for (const pane of panes) pane.edge.color.copy(on ? pane.light : pane.shown);
      // The tiles give off no light (at night their outlines do, on their own): a lit fill would read as a bar of light.
      if (on) {
        held.copy(tileMaterial.color);
        heldGlow.copy(tileMaterial.emissive);
        tileMaterial.color.copy(BLACK);
        tileMaterial.emissive.copy(BLACK);
        tileMaterial.envMapIntensity = 0;
      } else {
        tileMaterial.color.copy(held);
        tileMaterial.emissive.copy(heldGlow);
        tileMaterial.envMapIntensity = 1.4;
      }
    },

    dispose() {
      for (const thing of trash) thing.dispose();
      for (const tile of tiles) tile.mesh.traverse((child) => child instanceof THREE.Mesh && child.geometry.dispose());
    },
  };
}
