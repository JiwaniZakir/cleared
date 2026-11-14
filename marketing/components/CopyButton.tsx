"use client";

import * as React from "react";
import { BUTTON, COPIED } from "@/lib/copy";
import { PRODUCT } from "@/lib/product";

/**
 * The page's one action, in its one wording: it puts the connect message on the clipboard, ready to send
 * to an agent. `size` only changes how large it is drawn.
 */
export function CopyButton({ size = "md" }: { size?: "md" | "lg" }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PRODUCT.message);
    } catch {
      // No clipboard here (an insecure origin, or permission refused): nothing to confirm.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" className={`btn btn--${size}`} onClick={copy} data-copied={copied || undefined}>
        {/* Both labels are always laid out, one over the other, so the button never changes width. */}
        <span className="btn__label" aria-hidden={copied}>{BUTTON}</span>
        <span className="btn__label btn__label--done" aria-hidden={!copied}>{COPIED}</span>
      </button>
      <span className="sr" role="status">{copied ? "The message is on your clipboard." : ""}</span>
    </>
  );
}
