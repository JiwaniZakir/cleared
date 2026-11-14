"use client";

import * as React from "react";
import grokBot from "@/brand/grokbot-icon.webp";
import { APPS, getApp, hasTurned, rolling, subscribeApp, type AppId } from "@/lib/app";
import { AGENT, AGENT_OR } from "@/lib/copy";

const IDS = Object.keys(APPS) as AppId[];

/** An app's own icon, unaltered, at the height of a capital letter beside its name. */
function Mark({ app }: { app: AppId }) {
  return app === "grok" ? (
    <span className="token__mark token__mark--window">
      {/* The Grok Bot picture, served as it is and shown through a window the size of its icon. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image would re-encode the mark */}
      <img src={grokBot.src} alt="" width={grokBot.width} height={grokBot.height} />
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- an SVG mark, served as it is
    <img className="token__mark token__mark--tile" src="/brand/muse-app-icon.svg" alt="" width={56} height={56} />
  );
}

/**
 * The agent's own name inside a headline: its mark and its name, rolling between Muse and Grok Bot.
 *
 * It follows the page's one app state (lib/app.ts), so the phone and the switch turn with it; while it is on
 * screen it tells that state's clock so, and `hold` is how long each name stays. Both names are always laid
 * out, one over the other, so the wider one's room is kept and nothing else in the line moves. `end` is the
 * punctuation that belongs to the name (a headline's full stop travels with it).
 *
 * A screen reader hears one stable name, "Grok Bot or Muse". With reduced motion, and on the page without
 * the stage, nothing rolls: the same words stand there with both marks.
 */
export function AgentName({ end = "", hold = 4000 }: { end?: string; hold?: number }) {
  const app = React.useSyncExternalStore(subscribeApp, getApp, () => "grok" as AppId);
  // Nothing moves until the name has turned once: the first paint is not a swap.
  const turned = React.useSyncExternalStore(subscribeApp, hasTurned, () => false);
  const token = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = token.current;
    if (!el) return;
    const key = {};
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    // A headline in the pinned show is on screen only while the director has switched its card on.
    const step = el.closest<HTMLElement>("[data-step]");
    let inView = false;
    const tell = () => rolling(key, inView && root.dataset.mode === "3d" && !still.matches && (!step || step.dataset.on === "1") ? hold : null);
    const seen = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio > 0.6;
        tell();
      },
      { threshold: [0, 0.6, 1] },
    );
    seen.observe(el);
    const changed = new MutationObserver(tell);
    changed.observe(root, { attributes: true, attributeFilter: ["data-mode"] });
    if (step) changed.observe(step, { attributes: true, attributeFilter: ["data-on"] });
    still.addEventListener("change", tell);
    return () => {
      seen.disconnect();
      changed.disconnect();
      still.removeEventListener("change", tell);
      rolling(key, null);
    };
  }, [hold]);

  return (
    <span className="token" ref={token} data-turned={turned || undefined}>
      <span className="token__roll" aria-hidden="true">
        {IDS.map((id) => (
          <span key={id} className="token__name" data-on={app === id || undefined}>
            <Mark app={id} />
            {APPS[id].name}
            {end}
          </span>
        ))}
      </span>
      {/* What a screen reader hears, and what stands there when nothing may move. */}
      <span className="token__both">
        <span className="token__pair">
          <Mark app="grok" />
          {APPS.grok.name}
        </span>{" "}
        {AGENT_OR}{" "}
        <span className="token__pair">
          <Mark app="muse" />
          {APPS.muse.name}
          {end}
        </span>
      </span>
    </span>
  );
}

/** The app's name as plain words, following the same state: "You, in Grok Bot". */
export function AppName() {
  const app = React.useSyncExternalStore(subscribeApp, getApp, () => "grok" as AppId);
  return <>{APPS[app].name}</>;
}

/**
 * A line of copy that names the app without rolling: plain words that follow the same state. Its first
 * sentence (the one with the name in it) keeps a line to itself, so when the name changes nothing after it moves.
 */
export function Following({ text }: { text: string }) {
  const at = text.indexOf(AGENT);
  if (at < 0) return <>{text}</>;
  const stop = text.indexOf(". ", at);
  const first = stop < 0 ? text : text.slice(0, stop + 1);
  return (
    <>
      <span className={stop < 0 ? undefined : "follow"}>
        {first.slice(0, at)}
        <AppName />
        {first.slice(at + AGENT.length)}
      </span>
      {stop < 0 ? null : text.slice(stop + 1)}
    </>
  );
}

/**
 * A line of copy that may have the rolling name in it (`{app}` in lib/copy.ts). The name always ends its
 * line, so the room kept for the wider name is never a gap inside a sentence: where words follow it, they
 * start the next line.
 */
export function Rolling({ text, hold }: { text: string; hold?: number }) {
  const at = text.indexOf(AGENT);
  if (at < 0) return <>{text}</>;
  const after = text.slice(at + AGENT.length);
  const closes = /^[.!?]?$/.test(after);
  return (
    <>
      {text.slice(0, at)}
      <AgentName end={closes ? after : ""} hold={hold} />
      {closes ? null : (
        <>
          {" "}
          <br className="token__break" />
          {after.trimStart()}
        </>
      )}
    </>
  );
}
