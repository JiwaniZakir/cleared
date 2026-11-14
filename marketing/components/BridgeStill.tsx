import { AppName } from "@/components/AgentName";
import { SlotStill } from "@/components/Still";
import { foundScreen } from "@/components/stage/states";
import { ALT, BRIDGE, POOL } from "@/lib/copy";
import { fitMarks, typeFor } from "@/lib/logos";
import { PRODUCT } from "@/lib/product";
import type { CSSProperties } from "react";

const FOUND_SCREEN = foundScreen();
/** The three tiles a role lands on (the same three as on the live bridge, at both sizes). */
const LANDS = [0, 2, 4];
/**
 * The companies' wall: every tile one size (100 by 42, scaled with the tile), each mark fitted in the same room
 * as on the live bridge (lib/logos.ts), placed as shares of the tile so it scales with it.
 */
const TILE = { w: 100, h: 42 };
const NAMES = POOL.companies.map((company) => company.name);
const FITTED = fitMarks(NAMES, TILE.w * 0.8, TILE.h * 0.5);
const MIDDLE = FITTED.flatMap((fit) => (fit ? [fit.inkH] : [])).sort((a, b) => a - b)[Math.floor(FITTED.filter(Boolean).length / 2)] ?? 10;
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

/** One tile: the company's own mark in the ink, or (where there is none to show) its name in type. */
function Tile({ i }: { i: number }) {
  const fit = FITTED[i];
  const name = NAMES[i];
  return (
    <li className="bstill__tile">
      {fit ? (
        // eslint-disable-next-line @next/next/no-img-element -- the company's own file, served as it is
        <img
          src={fit.mark.src}
          alt={name}
          width={Math.round(fit.mark.ratio * 100)}
          height={100}
          style={{ left: pct(TILE.w / 2 + fit.file.x, TILE.w), top: pct(TILE.h / 2 + fit.file.y, TILE.h), width: pct(fit.file.w, TILE.w), height: pct(fit.file.h, TILE.h), filter: `url(#${fit.mark.solid > 1 ? "ink-solid" : "ink"})` }}
        />
      ) : (
        <span className="bstill__type" style={{ "--size": `${((typeFor(MIDDLE).size / TILE.w) * 100).toFixed(3)}cqw` } as CSSProperties}>
          {name}
        </span>
      )}
      {LANDS.includes(i) ? <Check /> : null}
    </li>
  );
}

const Check = () => (
  <span className="disc">
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 6.4l2.2 2.2L9.200 4" />
    </svg>
  </span>
);

/**
 * The bridge as one still picture, for the page without the live stage (reduced motion, no hardware
 * graphics): the whole diagram at the moment everything has happened. Your phone; the two lanes; the four
 * panes, each lit, with its name and what it found; the two roles held at Export control, with why; what the
 * checks do not do; the direct line; and the companies, three of them ticked where a role has landed.
 *
 * It is built from the page's own type and boxes, so its words are real text at their own sizes on any
 * window (a drawing scaled to a narrow window would shrink them past reading), and it turns to run down the
 * page on a narrow one. A screen reader is given it as one picture with one description.
 */
export function BridgeStill() {
  return (
    <figure className="bstill" role="img" aria-label={ALT.bridge}>
      <div className="bstill__you">
        <p className="label label--ink">
          {BRIDGE.you} <AppName />
        </p>
        <div className="bstill__phone">
          <SlotStill state={FOUND_SCREEN} />
        </div>
      </div>

      <div className="bstill__layer">
        <p className="bstill__mark">
          <span className="wordmark">{PRODUCT.name}</span>
          <span className="label label--ink">{BRIDGE.layer}</span>
        </p>
        <ol className="bstill__panes">
          {BRIDGE.checks.map((check, i) => (
            <li key={check}>
              <span className="bstill__pane">
                <Check />
              </span>
              <span className="bstill__name">
                <span className="label label--ink">{check}</span>
                <span className="verdict">{BRIDGE.verdicts[i]}</span>
                {i === 1 ? <span className="held">{BRIDGE.held}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="note bstill__limits">{BRIDGE.limits}</p>
      </div>

      <div className="bstill__direct">
        <p className="lead lead--ink">{BRIDGE.direct}</p>
        <p className="body">{BRIDGE.decides}</p>
      </div>

      <div className="bstill__pool">
        <p className="bstill__companies">
          <span className="label label--pool">{BRIDGE.companies}</span>
          <span className="label label--ink">{POOL.count}</span>
          <span className="note">{BRIDGE.listings}</span>
        </p>
        {/* The page's one ink for the marks: every pixel black at the file's own alpha (its faintest ground left out), or with a lighter second tone raised to solid. */}
        <svg className="bstill__filters" width="0" height="0" aria-hidden="true" focusable="false">
          <filter id="ink" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.02 -0.02" />
          </filter>
          <filter id="ink-solid" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.31 -0.02" />
          </filter>
        </svg>
        <ul className="bstill__tiles">
          {NAMES.map((name, i) => (
            <Tile key={name} i={i} />
          ))}
        </ul>
      </div>
    </figure>
  );
}
