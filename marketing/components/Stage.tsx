"use client";

import * as React from "react";
import { readMode, subscribeMode } from "@/lib/capability";
import { startDirector } from "./stage/director";

const wants3d = () => readMode() === "3d";

/**
 * The fixed layer behind the words: one canvas the stage draws into (components/stage/stage.ts). It is a
 * picture, never content: every word is in the page's own HTML, and each section says what its picture
 * shows in words for anyone who cannot see it. So it is hidden from assistive technology and never takes
 * the pointer. It covers each section's own ground, which is still there for the page without the stage.
 *
 * three.js is only downloaded by a visitor who will see it. The director (scroll to numbers) runs either
 * way, because the header and the words need it too.
 */
export function Stage() {
  const enabled = React.useSyncExternalStore(subscribeMode, wants3d, () => false);
  const canvas = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => startDirector(), []);

  React.useEffect(() => {
    const el = canvas.current;
    if (!enabled || !el) return;
    let dispose: (() => void) | undefined;
    let gone = false;
    import("./stage/stage")
      .then(({ mountStage }) => {
        if (gone) return;
        dispose = mountStage(el);
      })
      .catch(() => {
        // The stage could not be built: the page is complete without it.
        document.documentElement.dataset.mode = "still";
      });
    return () => {
      gone = true;
      dispose?.();
    };
  }, [enabled]);

  return (
    <div className="stage" data-stage aria-hidden="true">
      {enabled ? <canvas ref={canvas} className="stage__layer" style={{ opacity: 0 }} /> : null}
    </div>
  );
}
