"use client";

import * as React from "react";
import grokIcon from "@/brand/grokbot-icon.webp";
import { getApp, subscribeApp, type AppId } from "@/lib/app";
import { readMode, subscribeMode } from "@/lib/capability";
import { fontFamily, loadScreenArt, painted, paintScreen, pictureOf, SCREEN, type ScreenState } from "./stage/screen";

/**
 * The phone as a flat still: a graphite frame around one painted screen. It is the picture in an open card,
 * and it stands in each section for a visitor who gets the page without 3D. Painted by the same code as the
 * live phone's screen, in the app the visitor chose (or the one given).
 */
export function Still({ state, alt, className, app }: { state: ScreenState; alt: string; className?: string; app?: AppId }) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const chosen = React.useSyncExternalStore(subscribeApp, getApp, () => "grok" as AppId);
  const shown = app ?? chosen;

  React.useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let gone = false;
    let width = 0;
    const paint = () => {
      if (gone) return;
      width = el.getBoundingClientRect().width;
      // Not laid out (a closed sheet, a hidden row): nothing to size the picture by yet. It is painted when it is.
      if (width < 2) return;
      // The picture that suits the size it is shown at: the conversation magnified until its type can be read.
      paintScreen(ctx, el.width, el.height, fontFamily(), art, { app: shown, state }, width / SCREEN.w);
      // For the checks: which picture this still shows (never the wordless one where it is read), and whether anything ran over.
      el.dataset.picture = pictureOf(width / SCREEN.w).kind;
      el.dataset.overflow = painted.overflow ? "1" : "";
    };
    const art = loadScreenArt({ grokIcon: grokIcon.src, museIcon: "/brand/muse-app-icon.svg", museAvatar: "/brand/muse-avatar.webp" }, paint);
    paint();
    document.fonts.load(`680 64px ${fontFamily()}`).then(paint, () => {});
    // Painted again whenever the size it is shown at changes (a sheet opening, a window turning).
    const resized = new ResizeObserver(() => {
      if (Math.abs(el.getBoundingClientRect().width - width) > 0.5) paint();
    });
    resized.observe(el);
    return () => {
      gone = true;
      resized.disconnect();
    };
  }, [state, shown]);

  return (
    <div className={`still ${className ?? ""}`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <canvas ref={canvas} width={780} height={1688} className="still__screen" />
      <span className="still__island" />
    </div>
  );
}

const isStill = () => readMode() === "still";

/** The still in a section's phone slot: only there for a visitor who gets the page without the live stage. */
export function SlotStill({ state }: { state: ScreenState }) {
  const still = React.useSyncExternalStore(subscribeMode, isStill, () => true);
  return still ? <Still state={state} alt="" /> : null;
}
