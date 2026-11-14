/**
 * The stage: one canvas, fixed behind the page's words, that draws a place and what stands in it.
 *
 * The unit is the CSS pixel, and the plane the phone stands in (z = 0) is kept in exact register with the
 * page: a point the director measured off the layout is that point on the stage. What changed from a flat
 * picture is the camera. It is a real one, with a lens that can widen, standing at a height above a real
 * floor and able to move; its projection is shifted (as a view camera's is) so that wherever it stands, the
 * phone's plane still fills the viewport. So moving it moves the space, never the layout: the floor recedes
 * to a horizon at the camera's eye level, near and far slide against each other, and verticals stay upright.
 *
 * A frame, in order:
 *   1. the scene drawn upside down about the floor into a small buffer, for the floor to mirror;
 *   2. the place (place.ts): floor, horizon, air, or the night sky;
 *   3. the floor's real shadow from the one key light, then everything that stands on it: the phone, and
 *      the bridge (set.ts), which the director moves as one thing to bring a part of it to the camera;
 *   4. the finish (post.ts): bloom on what gives off light, vignette, grain.
 *
 * It draws only when the director says something changed. Plain three.js, no React inside.
 */
import * as THREE from "three";
import { fallBack } from "@/lib/capability";
import { DISPLAY, PHONE } from "./dims";
import { begin, request, subscribe } from "./director";
import { buildRoom } from "./env";
import { live } from "./live";
import { buildKit, buildSatellite } from "./models";
import { buildPhone } from "./phone";
import { buildPlace } from "./place";
import { buildPost, chooseTier } from "./post";
import { buildSet, EMIT } from "./set";
import { fontFamily, loadScreenArt, SCREEN } from "./screen";
import grokIcon from "@/brand/grokbot-icon.webp";
import { getApp, subscribeApp } from "@/lib/app";
import { POOL } from "@/lib/copy";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const PURPLE = new THREE.Color(0.631, 0.384, 1);
const AQUA = new THREE.Color(0.337, 0.98, 0.969);
const CREAM = new THREE.Color(0.973, 0.863, 0.733);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
/** Things on this layer are not mirrored in the floor: the floor's own shadow, and flat lines of light. */
const UNMIRRORED = 1;

export function mountStage(canvas: HTMLCanvasElement): () => void {
  const tier = chooseTier();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: "high-performance" });
  // (The phone can be cropped: see `live.phone.crop`.)
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const post = buildPost(renderer, tier);
  const place = buildPlace();
  place.uniforms.uMirror.value = post.mirror?.texture ?? null;

  const scene = new THREE.Scene();
  const room = buildRoom(renderer);
  scene.environment = room;
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = true;

  /* ── Light: one soft key that throws the shadows, and the prism from behind on either side ── */
  const key = new THREE.DirectionalLight("#fff8ee", 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(tier.shadow, tier.shadow);
  key.shadow.radius = 7;
  key.shadow.blurSamples = 12;
  key.shadow.bias = -0.0002;
  // The prism is rim light, and its colour follows the place along the bridge: purple at your end, aqua over
  // the checks, cream at the companies (set each frame from `live.along`).
  const west = new THREE.DirectionalLight("#a162ff", 0);
  const east = new THREE.DirectionalLight("#9f95ff", 0);
  scene.add(key, key.target, west, west.target, east, east.target);

  /* ── What stands on the floor (and is mirrored in it) ── */
  const world = new THREE.Group();
  scene.add(world);
  // The screen is painted so that one of its pixels is never larger than one of the display's at the phone's
  // largest pose, up to the tier's cap.
  const largest = Math.max(...[...document.querySelectorAll<HTMLElement>('[data-slot="phone"]')].map((slot) => slot.getBoundingClientRect().height), 400);
  const art = loadScreenArt({ grokIcon: grokIcon.src, museIcon: "/brand/muse-app-icon.svg", museAvatar: "/brand/muse-avatar.webp" }, () => {
    phone.refresh();
    request();
  });
  const phone = buildPhone(renderer.capabilities.getMaxAnisotropy(), Math.min(tier.screen, Math.ceil((largest * Math.min(window.devicePixelRatio || 1, tier.dpr) * DISPLAY.h) / 64) * 64), art);

  // Which app the screen is in. Throwing the switch dissolves the whole screen to the other app in 300 ms.
  // Which app the screen is in. When it changes (the rolling name, or the switch) the phone slides to the other app's screen.
  let app = getApp();
  const unsubscribeApp = subscribeApp(() => {
    app = getApp();
    request();
  });
  phone.group.rotation.order = "YXZ";
  world.add(phone.group);

  const kit = buildKit();
  const satellite = buildSatellite(kit);
  satellite.rotation.order = "ZYX";
  // The bridge: one set, laid out from the page's own boxes and moved as one.
  // (A company's mark arrives once its file has loaded: draw again then.)
  const set = buildSet(request);
  const names = POOL.companies.map((company) => company.name);
  let laid = -1;
  world.add(set.group, satellite);

  /* ── What is not mirrored: the floor's shadow ── */
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ color: "#1c004c", opacity: 0.3 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.receiveShadow = true;
  shadow.layers.set(UNMIRRORED);
  const view = new THREE.Vector2(1, 1);
  scene.add(shadow);

  /* ── The lit screen again, on its own, for the bloom ── */
  const glowMaterial = new THREE.MeshBasicMaterial({ map: phone.texture, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, clippingPlanes: [phone.clip] });
  // Over a cropped phone's cut, a short fade into the page's ground, drawn by the page over the canvas.
  const fade = document.createElement("div");
  fade.className = "stage__fade";
  canvas.parentElement?.appendChild(fade);
  let fadeStyle = "";
  const glowMesh = new THREE.Mesh(phone.screen.geometry, glowMaterial);
  glowMesh.matrixAutoUpdate = false;
  glowMesh.frustumCulled = false;
  const glowScene = new THREE.Scene();
  glowScene.add(glowMesh);
  const black = new THREE.MeshBasicMaterial({ color: "#000000" });

  const anchor = new THREE.Vector3();
  const rim = new THREE.Color();
  let width = 0;
  let height = 0;
  let style = "";
  let primed = false;

  const resize = () => {
    width = live.w;
    height = live.h;
    const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    view.set(width, height);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    post.resize(width, height, dpr);
  };

  /** A place in the viewport (pixels from its top-left corner) as a place in the phone's plane. */
  const X = (px: number) => px - width / 2;
  const Y = (py: number) => height / 2 - py;

  /**
   * Draws everything once, into one pixel, before the visitor scrolls. A material's program is compiled and
   * its pipeline built at its first real draw, which costs tens of milliseconds: without this, each thing
   * cost a long frame the moment it first came into view.
   */
  const prime = () => {
    const hidden: THREE.Object3D[] = [];
    const culled: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (!object.visible) hidden.push(object);
      if (object.frustumCulled) culled.push(object);
      object.visible = true;
      object.frustumCulled = false;
    });
    camera.layers.enableAll();
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(post.scene);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.render(place.scene, place.camera);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    renderer.setRenderTarget(null);
    for (const object of hidden) object.visible = false;
    for (const object of culled) object.frustumCulled = true;
  };

  // What the checks may read: `window.__stage`.
  const report = { screen: { id: "", picture: "", type: 0, sliding: false, overflow: false, sliced: false, bottom: 1 }, phone: { onScreen: true, top: 0, bottom: 0, left: 0, right: 0 }, tiles: { marks: 0, ready: false, night: false }, blends: {}, settled: false, over: [] as string[], focus: { soft: 0, window: [0, 0, 0, 0] as number[] } };
  /** A thing's box as drawn on the viewport, in pixels: left, top, right, bottom. */
  const seen = new THREE.Box3();
  const corner = new THREE.Vector3();
  const drawnBox = (object: THREE.Object3D): [number, number, number, number] => {
    seen.setFromObject(object);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? seen.max.x : seen.min.x, i & 2 ? seen.max.y : seen.min.y, i & 4 ? seen.max.z : seen.min.z).project(camera);
      const x = ((corner.x + 1) / 2) * width;
      const y = ((1 - corner.y) / 2) * height;
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
    }
    return [l, t, r, b];
  };
  // For the checks: which pieces of the set stand on the phone's silhouette (over its screen, or peeking from
  // behind it), worked out when read. A little inside the phone's own drawn box, so a piece that only meets its edge is not counted.
  Object.defineProperty(report, "over", {
    enumerable: true,
    get() {
      if (!set.group.visible || !report.phone.onScreen) return [];
      const [pl, pt, pr, drawnFoot] = drawnBox(phone.group);
      // (Cropped, the phone ends at its crop.)
      const pb = live.phone.crop > 0 ? Math.min(drawnFoot, live.phone.crop) : drawnFoot;
      const inset = 3;
      const round = (box: number[]) => box.map((v) => Math.round(v)).join(" ");
      return set
        .pieces()
        .map(([name, object]) => [name, drawnBox(object)] as const)
        .filter(([, [l, t, r, b]]) => r > pl + inset && l < pr - inset && b > pt + inset && t < pb - inset && r > 0 && l < width && b > 0 && t < height)
        .map(([name, box]) => `${name} (${round(box)}; the phone ${round([pl, pt, pr, pb])})`);
    },
  });
  (window as unknown as { __stage?: typeof report }).__stage = report;

  const draw = (time: number) => {
    if (live.w !== width || live.h !== height) resize();
    if (width < 2 || height < 2) return;
    const p = live.phone;
    const H = p.h;
    const intro = easeOut(live.intro);

    /* The camera: at the eye point, as far back as the lens says, its projection shifted to keep the phone's plane on the viewport. */
    const D = live.lens * height * (1 + (1 - intro) * 0.5);
    const cx = X(live.eye.x);
    const cy = Y(live.eye.y) + (1 - intro) * H * 0.12;
    const near = D * 0.05;
    const far_ = D * 40;
    const k = near / D;
    camera.position.set(cx, cy, D);
    camera.updateMatrixWorld();
    camera.projectionMatrix.makePerspective((-width / 2 - cx) * k, (width / 2 - cx) * k, (height / 2 - cy) * k, (-height / 2 - cy) * k, near, far_);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    /* The phone. */
    const g = phone.group;
    g.position.set(X(p.x), Y(p.y), 0);
    g.scale.setScalar(H);
    g.rotation.set(p.rx, p.ry - (1 - intro) * 0.55, p.rz);
    // The screen: the director's state in the chosen app. While the switch is turning, the old app's screen
    // dissolves to the new one's; otherwise one state dissolves to the next as the page scrolls.
    // How many page pixels one point of the screen is drawn at: it chooses the screen's picture (screen.ts).
    const px = (DISPLAY.w * H) / SCREEN.w;
    // One state, in the chosen app. To another screen, or the other app, the phone makes one slide on its own clock.
    if (phone.show({ app, state: live.screen.state }, px, time, live.screen.way)) request();
    // Cropped to its live message (down a narrow window): nothing of it below the line, and a short fade over the cut.
    const crop = live.phone.crop;
    phone.clip.constant = crop > 0 ? -Y(crop) : 1e6;
    {
      const pw = PHONE.w * H;
      const next = crop > 0 ? `display:block;left:${(p.x - pw / 2 - 6).toFixed(1)}px;top:${(crop - 30).toFixed(1)}px;width:${(pw + 12).toFixed(1)}px;height:31px` : "display:none";
      if (next !== fadeStyle) fade.setAttribute("style", (fadeStyle = next));
    }
    // For the checks (tests/overlap.mjs): what the stage is showing right now.
    report.screen = phone.report();
    // (The director crops the phone to where its conversation ends: when that moves, it works the frame out again.)
    if (Math.abs(live.screenBottom - report.screen.bottom) > 0.001) {
      live.screenBottom = report.screen.bottom;
      request();
    }
    report.tiles = { ...set.report(), night: live.day < 0.5 };
    const foot = crop > 0 ? Math.min(p.y + H / 2, crop) : p.y + H / 2;
    report.phone = { onScreen: p.y - H / 2 < height - 24 && foot > 24 && p.x + H / 4 > 0 && p.x - H / 4 < width, top: p.y - H / 2, bottom: foot, left: p.x - (PHONE.w * H) / 2, right: p.x + (PHONE.w * H) / 2 };
    report.blends = { sliding: report.screen.sliding, day: live.day, pane: live.focus.pane.amount, intro: live.intro };
    // What is in focus (centre and half size, in CSS pixels), and how far the rest is pulled.
    report.focus = { soft: live.focus.soft, window: [...live.focus.window] };
    report.settled = live.intro >= 1 && !live.busy && !report.screen.sliding && (live.day === 0 || live.day === 1) && live.focus.pane.amount === 0;
    const floorY = Y(live.floor.y);
    const base = new THREE.Vector3(g.position.x, floorY, 0);

    /* Light. */
    const day = live.day;
    scene.environmentIntensity = lerp(0.11, 0.9, day);
    key.intensity = day * 1.5;
    // The key stands high, to the left and a little behind, so shadows fall forward and to the right, where
    // they are seen. Its shadow box is wider than the viewport, so the box's own edge is never in the picture.
    key.position.set(base.x - H * 2.0, base.y + H * 3.2, -H * 1.0);
    key.target.position.set(base.x, base.y, 0);
    const box = key.shadow.camera;
    if (box.right !== H * 5) {
      box.left = box.bottom = -H * 5;
      box.right = box.top = H * 5;
      box.near = H * 0.5;
      box.far = H * 12;
      box.updateProjectionMatrix();
    }
    // The prism comes from behind, low, on either side: by day with the hero's light, at night from the horizon.
    west.intensity = day * (0.6 + live.prism * 5.2) + (1 - day) * 3.6;
    east.intensity = day * (0.4 + live.prism * 3.6) + (1 - day) * 2.8;
    west.position.set(base.x - H * 3, base.y + H * 0.1, -H * 1.3);
    east.position.set(base.x + H * 3.2, base.y + H * 0.3, -H * 1.1);
    west.target.position.copy(key.target.position);
    east.target.position.copy(key.target.position);

    /* The floor's shadow. */
    shadow.position.set(base.x, floorY + 0.5, -H * 2.2);
    shadow.scale.set(H * 9, H * 9, 1);
    (shadow.material as THREE.ShadowMaterial).opacity = 0.32 * live.floor.day * intro;

    /* The bridge: laid out when the page's boxes change, then placed where the director says. */
    const G = live.set.geometry;
    const S = live.set.state;
    if (G && laid !== live.set.version) {
      laid = live.set.version;
      set.layout(G, X, Y, names, fontFamily());
    }
    if (G) {
      // The anchor is to be seen at the target, at that size, from a plane `back` behind the phone's.
      const deeper = (D + S.back) / D;
      const scale = S.scale * deeper;
      anchor.set(X(S.anchor[0]), Y(S.anchor[1]), 0).multiplyScalar(scale).applyAxisAngle(UP, -S.yaw);
      set.group.position.set(cx + (X(S.target[0]) - cx) * deeper - anchor.x, cy + (Y(S.target[1]) - cy) * deeper - anchor.y, -S.back - anchor.z);
      set.group.scale.setScalar(scale);
      set.group.rotation.y = -S.yaw;
      set.update(S, day);
    }
    // (Not down a narrow window: there its orbit runs behind the night's card.)
    satellite.visible = live.sky > 0.004 && live.set.geometry?.axis !== "y";
    kit.fade(1);
    const n = live.night;
    const centreY = n.apex + n.radius;
    const orbit = n.radius + (n.apex - n.orbitApex);
    if (satellite.visible) {
      // Far behind the phone's plane, and enlarged by as much, so it slides against the phone as the camera moves.
      const depth = height * 0.6;
      const s = (D + depth) / D;
      const edge = Math.asin(Math.min(0.98, (width / 2 + n.satSize) / orbit));
      const angle = lerp(-edge, edge, n.sat);
      satellite.position.set(cx + (X(n.cx + orbit * Math.sin(angle)) - cx) * s, cy + (Y(centreY - orbit * Math.cos(angle)) - cy) * s, -depth);
      satellite.scale.setScalar(n.satSize * s);
      satellite.rotation.set(0.5, -0.5 + n.sat * 1.3, -angle);
    }

    /* The place. */
    const u = place.uniforms;
    u.uView.value.copy(view);
    u.uEye.value.set(live.eye.x, height / 2 - cy);
    u.uD.value = D;
    u.uFloorY.value = live.floor.y;
    u.uPhone.value.set(p.x, (PHONE.w * H) / 2, H, g.rotation.y);
    u.uPrism.value = live.prism * intro;
    u.uScreen.value.set(live.screenLight[0], live.screenLight[1], live.screenLight[2]).multiplyScalar(intro);
    u.uDark.value = 1 - day;
    u.uGrid.value = S.show;
    u.uLimb.value.set(n.cx, centreY, n.radius, orbit);
    const sky = live.sky;
    u.uNight.value.set(n.horizon * sky, n.glow, n.orbit * sky, sky);
    // The prism's colour here: purple at your end, aqua over the checks, cream at the companies.
    const along = live.along;
    rim.copy(along < 0.5 ? PURPLE : AQUA).lerp(along < 0.5 ? AQUA : CREAM, along < 0.5 ? along * 2 : along * 2 - 2 + 1);
    u.uRim.value.set(rim.r, rim.g, rim.b);
    west.color.copy(rim);
    east.color.copy(rim).lerp(CREAM, 0.25);
    u.uQuiet.value.set(n.quiet[0], n.quiet[1], n.quiet[2], n.quiet[3]);
    u.uHeader.value = width < 768 ? 56 : 64;

    if (!primed) {
      primed = true;
      prime();
    }

    /* 1. The mirror: the same scene, turned over about the floor. */
    const mirrored = !!post.mirror && live.floor.y < height + H * 0.2;
    u.uMirrorK.value = mirrored ? lerp(0.5, 0.3, day) * intro * live.floor.mirror : 0;
    if (post.mirror && mirrored) {
      world.scale.y = -1;
      world.position.y = 2 * floorY;
      camera.layers.set(0);
      renderer.setRenderTarget(post.mirror);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      world.scale.y = 1;
      world.position.y = 0;
    }

    /* 2 and 3. The place, then the shadow and everything standing in it. */
    camera.layers.enableAll();
    renderer.shadowMap.needsUpdate = day > 0.02;
    renderer.setRenderTarget(post.scene);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(place.scene, place.camera);
    renderer.render(scene, camera);

    /* 4. The finish. The screen is drawn into the bloom by itself: faintly by day, fully once it is the light in the dark. */
    glowMesh.matrix.copy(phone.screen.matrixWorld);
    // By day the screen is no brighter than the bone around it, so it gives the bloom almost nothing: any more
    // lays a veil over its own black type. At night it is the light.
    glowMaterial.color.setScalar((lerp(0.6, 0, day) * (0.25 + 0.75 * live.glow) + 0.012 * day) * intro);
    post.finish(() => {
      // What gives off light in the place, then everything standing in front of it as black (so the dawn does
      // not glow through the phone), then the lit screen.
      u.uEmit.value = 1;
      renderer.render(place.scene, place.camera);
      u.uEmit.value = 0;
      camera.layers.set(0);
      scene.overrideMaterial = black;
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      // Then what gives off light on the set, in its own colour: the lit edges of the panes, the comets.
      if (set.group.visible) {
        set.emit(true);
        camera.layers.set(EMIT);
        renderer.render(scene, camera);
        set.emit(false);
      }
      camera.layers.enableAll();
    }, () => renderer.render(glowScene, camera), 0.85, {
      soft: live.focus.soft,
      window: live.focus.window,
      // The phone is always in focus: its box, a little generous.
      keep: [p.x, p.y, (PHONE.w * H) / 2 + 12, H / 2 + 12],
      pane: live.focus.pane,
      flat: live.flat,
    });

    // The arrival, once: the picture comes up out of the page's own bone.
    const next = live.intro < 1 ? `opacity:${Math.min(1, live.intro * 2.2).toFixed(3)}` : "";
    if (next !== style) canvas.setAttribute("style", (style = next));
  };

  const unsubscribe = subscribe(draw);
  const lost = (event: Event) => {
    event.preventDefault();
    fallBack();
  };
  canvas.addEventListener("webglcontextlost", lost);

  // The screen is painted in the page's typeface: wait for it, then let the phone arrive.
  const family = fontFamily();
  Promise.all([document.fonts.load(`680 64px ${family}`), document.fonts.load(`455 21px ${family}`)])
    .catch(() => {})
    .then(() => {
      phone.refresh();
      begin();
      request();
    });

  return () => {
    unsubscribe();
    unsubscribeApp();
    canvas.removeEventListener("webglcontextlost", lost);
    phone.dispose();
    kit.dispose();
    set.dispose();
    place.dispose();
    post.dispose();
    shadow.geometry.dispose();
    (shadow.material as THREE.Material).dispose();
    glowMaterial.dispose();
    black.dispose();
    room.dispose();
    renderer.dispose();
  };
}
