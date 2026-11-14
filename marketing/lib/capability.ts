/**
 * Decides, before first paint, whether a visitor gets the live 3D stage, and records the answer as
 * `<html data-mode="3d" | "still">`. Every word and every card is in the page's own HTML either way; in
 * "still" mode the phone is a flat still in each section and nothing is pinned.
 *
 * A visitor gets the still page when they ask for reduced motion, have data saver on, their browser cannot
 * create a hardware WebGL2 context, or the context it creates is drawn in software (the stage would run at
 * about a frame a second). `?3d=off` and `?3d=force` override the decision for testing: headless browsers
 * draw WebGL in software, which the check refuses.
 *
 * This is plain JavaScript in a string because it is inlined into <head> and runs before first paint, so
 * the page never flashes from one layout to the other. It also sets `data-js`, which is what lets the
 * stylesheet hold words back for their entrance: without scripts every word is simply there.
 */
export const MODE_SCRIPT = `(function(){
  var root = document.documentElement, mode = "still";
  try {
    var override = new URLSearchParams(location.search).get("3d");
    var forced = override === "force";
    if (forced) root.dataset.forced = "1";
    var wantsMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    var savesData = !!(navigator.connection && navigator.connection.saveData);
    if (override !== "off" && (forced || (wantsMotion && !savesData))) {
      var gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: !forced });
      if (gl && !forced) {
        var info = gl.getExtension("WEBGL_debug_renderer_info");
        var renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
        if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) gl = null;
      }
      if (gl) mode = "3d";
    }
  } catch (e) {}
  root.dataset.mode = mode;
  root.dataset.js = "1";
})()`;

export type Mode = "3d" | "still";

const listeners = new Set<() => void>();

export function subscribeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The mode in effect. Set before first paint by MODE_SCRIPT. */
export function readMode(): Mode {
  return document.documentElement.dataset.mode === "3d" ? "3d" : "still";
}

/** True when the stage was forced on for testing: it must never fall back by itself. */
export function isForced(): boolean {
  return document.documentElement.dataset.forced === "1";
}

/** Falls back to the still page (a lost graphics context, an error in the stage, reduced motion turned on). */
export function fallBack(): void {
  const root = document.documentElement;
  if (root.dataset.mode === "still" || isForced()) return;
  root.dataset.mode = "still";
  listeners.forEach((listener) => listener());
}
