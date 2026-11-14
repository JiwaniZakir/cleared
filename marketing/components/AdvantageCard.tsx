"use client";

import * as React from "react";
import { holdRolling } from "@/lib/app";
import { ADVANTAGE_COUNT, type Advantage } from "@/lib/copy";
import { Rolling } from "./AgentName";
import { request, reveal } from "./stage/director";

const CLOSE_MS = 250;
const TOTAL = String(ADVANTAGE_COUNT).padStart(2, "0");

/* Which advantage the one sheet shows, and whether it is open. Every card and the sheet read the same state. */
let page = 0;
let isOpen = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener));
const set = (nextPage: number, nextOpen: boolean) => {
  page = nextPage;
  isOpen = nextOpen;
  listeners.forEach((listener) => listener());
};
const getPage = () => page;
const getOpen = () => isOpen;

/**
 * One advantage, closed, on the stage: a card with its index, its title, one sentence and a plus in the
 * corner. The title is the button (so it is still a heading), and its target is stretched over the whole
 * card. It opens the page's one sheet at this advantage.
 *
 * `step` is the name the director switches this card on by: a card reached with the keyboard while it is
 * off brings the page to its own stop.
 */
export function Card({ advantage, at, step, night }: { advantage: Advantage; at: number; step: string; night?: boolean }) {
  const open = React.useSyncExternalStore(subscribe, () => isOpen && page === at, () => false);
  return (
    <article className={`card${night ? " card--night" : ""}`} onClick={() => set(at, true)}>
      <p className="label label--index">
        <span>{advantage.index}</span> / {TOTAL}
        {advantage.eyebrow ? <span className="card__eyebrow">{advantage.eyebrow}</span> : null}
      </p>
      <h3 className="title">
        <button type="button" className="card__button" data-card={at} aria-haspopup="dialog" aria-expanded={open} aria-controls="sheet" onFocus={() => reveal(step)}>
          <Rolling text={advantage.title} />
        </button>
      </h3>
      <p className="lead">{advantage.opener}</p>
      <span className="plus" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </span>
    </article>
  );
}

/**
 * The one sheet every card opens: a modal dialog over a blurred veil, holding an advantage's index, title,
 * opener, its remaining lines and one picture (`pictures`, in the advantages' order). The arrows page through
 * all six without going back to the page. It closes by the cross, Escape, a tap outside or a downward swipe;
 * focus moves to its title and returns to the card of the advantage it was showing; the page behind does not
 * scroll, and the rolling name holds still while it is open.
 */
export function Sheet({ advantages, pictures }: { advantages: readonly Advantage[]; pictures: readonly React.ReactNode[] }) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const sheet = React.useRef<HTMLDivElement>(null);
  const scroller = React.useRef<HTMLDivElement>(null);
  const title = React.useRef<HTMLHeadingElement>(null);
  const closing = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = React.useSyncExternalStore(subscribe, getPage, () => 0);
  const open = React.useSyncExternalStore(subscribe, getOpen, () => false);
  const advantage = advantages[at];

  const hide = React.useCallback(() => {
    const d = dialog.current;
    if (!d || !d.open || d.dataset.state === "closing") return;
    d.dataset.state = "closing";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closing.current = setTimeout(
      () => {
        d.close();
        d.dataset.state = "closed";
        sheet.current?.removeAttribute("style");
        delete document.documentElement.dataset.sheet;
        holdRolling(false);
        set(page, false);
        // Back to the card of the advantage it was showing (which brings the page to that card's stop).
        const card = document.querySelector<HTMLElement>(`[data-card="${page}"]`);
        card?.focus({ preventScroll: true });
        // Without the stage nothing is pinned: the card may be a screen away, so bring it into view.
        if (document.documentElement.dataset.mode !== "3d") card?.scrollIntoView({ block: "center" });
        request();
      },
      reduced ? 150 : CLOSE_MS,
    );
  }, []);

  // A card asked for it: open.
  React.useEffect(() => {
    const d = dialog.current;
    if (!open || !d || d.open) return;
    if (closing.current) clearTimeout(closing.current);
    document.documentElement.dataset.sheet = "open";
    holdRolling(true);
    d.dataset.state = "closed";
    d.showModal();
    // One frame closed, then open: the transition has somewhere to start from. The title takes focus once the
    // sheet is shown (while it is still hidden, closed, it cannot be focused, and the dialog itself would keep it).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        d.dataset.state = "open";
        title.current?.focus({ preventScroll: true });
      }),
    );
  }, [open]);

  React.useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
      delete document.documentElement.dataset.sheet;
      holdRolling(false);
    },
    [],
  );

  // A downward swipe on the sheet closes it (when the sheet's own content is scrolled to its top).
  React.useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let dragging = false;
    const onStart = (e: TouchEvent) => {
      dragging = e.touches.length === 1 && (scroller.current?.scrollTop ?? 0) <= 0;
      startY = e.touches[0].clientY;
      startT = e.timeStamp;
      dy = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        dy = 0;
        el.style.transform = "";
        return;
      }
      e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      const speed = dy / Math.max(1, e.timeStamp - startT);
      el.style.transition = "";
      if (dy > 110 || (dy > 40 && speed > 0.6)) hide();
      else el.style.transform = "";
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [hide]);

  const turn = (by: number) => {
    set((page + by + advantages.length) % advantages.length, true);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <dialog
      ref={dialog}
      id="sheet"
      className="sheet-layer"
      data-ground={at === advantages.length - 1 ? "night" : "bone"}
      data-state="closed"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        hide();
      }}
      onClick={(e) => {
        // A tap outside the sheet: on the veil.
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.veil !== undefined) hide();
      }}
    >
      <div className="veil" data-veil="" />
      <div ref={sheet} className="sheet">
        <button type="button" className="sheet__close" onClick={hide} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
        </button>
        <div ref={scroller} className="sheet__scroll">
          <div className="sheet__text" key={advantage.id}>
            <p className="label label--index">
              <span>{advantage.index}</span> / {TOTAL}
              {advantage.eyebrow ? <span className="card__eyebrow">{advantage.eyebrow}</span> : null}
            </p>
            <h2 id="sheet-title" ref={title} tabIndex={-1} className="title">
              <Rolling text={advantage.title} />
            </h2>
            <p className="lead">{advantage.opener}</p>
            <ul className="sheet__lines">
              {advantage.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="pager">
              <button type="button" onClick={() => turn(-1)} aria-label="The advantage before this one">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.5 6l-6 6 6 6" />
                </svg>
              </button>
              <span className="label" aria-live="polite">
                {advantage.index} / {TOTAL}
              </span>
              <button type="button" onClick={() => turn(1)} aria-label="The advantage after this one">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.5 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="sheet__picture">{pictures[at]}</div>
        </div>
      </div>
    </dialog>
  );
}
