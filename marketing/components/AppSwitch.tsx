"use client";

import * as React from "react";
import grokBot from "@/brand/grokbot-icon.webp";
import { APPS, getApp, setApp, subscribeApp, type AppId } from "@/lib/app";

/**
 * The app switch: Grok Bot or Muse, each with its own mark, unaltered. It is one choice for the whole page;
 * every copy of this control shows the same state, and the phone's screen follows it.
 */
export function AppSwitch({ label }: { label: string }) {
  // Grok Bot until the page has woken up in the browser, so the server's HTML and the first paint agree.
  const app = React.useSyncExternalStore(subscribeApp, getApp, () => "grok" as AppId);
  const id = React.useId();
  return (
    <div className="switch" role="radiogroup" aria-labelledby={id}>
      <span className="label" id={id}>
        {label}
      </span>
      {(Object.keys(APPS) as AppId[]).map((key) => (
        <button key={key} type="button" role="radio" aria-checked={app === key} className="switch__option" onClick={() => setApp(key)}>
          {key === "grok" ? (
            <span className="switch__window">
              {/* The Grok Bot picture, served as it is and shown through a window the size of its icon. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image would re-encode the mark */}
              <img src={grokBot.src} alt="" width={grokBot.width} height={grokBot.height} />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- an SVG mark, served as it is
            <img className="switch__mark" src="/brand/muse.svg" alt="" width={20} height={20} />
          )}
          {APPS[key].name}
        </button>
      ))}
    </div>
  );
}
