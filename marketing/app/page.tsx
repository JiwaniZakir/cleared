import { Card, Sheet } from "@/components/AdvantageCard";
import { AppName, Following, Rolling } from "@/components/AgentName";
import { AppSwitch } from "@/components/AppSwitch";
import { BridgeStill } from "@/components/BridgeStill";
import { CopyButton } from "@/components/CopyButton";
import { Header } from "@/components/Header";
import { Stage } from "@/components/Stage";
import { SlotStill, Still } from "@/components/Still";
import { applyScreen, checksScreen, connectScreen, heroScreen, lockScreen, taskScreen, weekScreen } from "@/components/stage/states";
import { ADVANTAGES, ALT, BRIDGE, FOOTER, HERO, NIGHTS, POOL, START } from "@/lib/copy";
import { PRODUCT } from "@/lib/product";
import type { CSSProperties } from "react";

const HERO_SCREEN = heroScreen();
/** All six advantages, with the phone's screen at each and what that picture shows. */
const ALL = [...ADVANTAGES, NIGHTS];
const SCREENS = [connectScreen(), checksScreen(), weekScreen(), taskScreen(false, true), applyScreen(), lockScreen()];
const ALTS = [ALT.connector, ALT.checks, ALT.week, ALT.task, ALT.apply, ALT.lock];
const CONNECT_SCREEN = SCREENS[0];
/** The message, with its address kept in one piece (it never breaks at its hyphen). */
const Message = () => (
  <p className="well__message">
    {PRODUCT.message.replace(PRODUCT.address, "")}
    <span className="nowrap">{PRODUCT.address}</span>
  </p>
);
/** Why two roles stay at Export control (the tokens themselves are on the stage, dimmed, beside it). */
const Held = ({ step }: { step: string }) => (
  <span className="held" data-step={step}>
    {BRIDGE.held}
  </span>
);
/** Where the four panes stand along the cleared layer, as shares of its length. The director knows the same numbers. */
const PANES = [0.1125, 0.3375, 0.5625, 0.7875];

/** The order in which a section's words arrive, 85 ms apart. */
const nth = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * The page: the hero; the show, which is one pinned stage
 * in three acts (the bridge whole, the journey along it with one stop for each advantage, the night); the
 * start; the footer.
 *
 * Every word here is real text. The stage behind it is a picture: each section says in words what its
 * picture shows. The empty boxes marked `data-slot` are where the phone and the parts of the set stand at
 * this window size; the pieces marked `data-step` are switched on by the director as their moment comes.
 */
export default function Page() {
  return (
    <>
      <Header />
      <Stage />
      <main>
        <section id="top" className="hero" data-chapter="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="label label--eyebrow rv" style={nth(0)}>
              {HERO.eyebrow}
            </p>
            <h1 id="hero-title" className="display rv" style={nth(1)}>
              {HERO.title[0]}
              <span className="prism-word">{HERO.title[1]}</span>
              <Rolling text={HERO.title[2]} hold={3500} />
            </h1>
            <p className="lead rv hero__second" style={nth(2)}>
              <Following text={HERO.second} />
            </p>
            <div className="well rv" style={nth(3)}>
              <Message />
              <CopyButton size="lg" />
            </div>
            <p className="note rv hero__caption" style={nth(4)}>
              <Following text={HERO.caption} />
            </p>
            <div className="rv" style={nth(5)}>
              <AppSwitch label={HERO.runsInside} />
            </div>
          </div>
          <div className="slot hero__phone" data-slot="phone" role="img" aria-label={ALT.hero}>
            <SlotStill state={HERO_SCREEN} />
          </div>
        </section>

        <section id="how" className="chapter show" data-chapter="show" aria-labelledby="bridge-title">
          <div className="pin" data-pin data-ground="bone">
            {/* Act one: the bridge, whole. */}
            <div className="act bridge" data-act="bridge">
              <div className="bridge__head" data-step="bridge-title" data-bridge-head>
                <h2 id="bridge-title" className="headline">
                  {BRIDGE.title}
                </h2>
                {/* (Down a narrow window the direct line takes this line's place at the arrival.) */}
                <p className="lead" data-step="bridge-line">
                  {BRIDGE.line}
                </p>
              </div>
              {/* Without the stage: the bridge as a still. */}
              <BridgeStill />
              <p className="sr bridge__spoken">{ALT.bridge}</p>
              {/* What the picture says in words that are only drawn: the direct line, who decides, and each company on the wall (its tile shows the company's mark). */}
              <div className="sr">
                <p>
                  {BRIDGE.direct} {BRIDGE.decides}
                </p>
                <ul aria-label={BRIDGE.companies}>
                  {POOL.companies.map((company) => (
                    <li key={company.name}>{company.name}</li>
                  ))}
                </ul>
              </div>
              <div className="bridge__frame" data-bridge-frame aria-hidden="true">
                {/* Your end: the hero's own phone, come to the head of the rail (down a narrow window, pinned at the top while the roles drop out of it). */}
                <div className="slot bridge__phone" data-slot="phone">
                  <p className="label label--ink bridge__you" data-step="you">
                    {BRIDGE.you} <AppName />
                  </p>
                  <p className="label label--ink bridge__roles" data-step="train">
                    {BRIDGE.train}
                  </p>
                </div>
                {/* The roles as they leave your phone, and the three that arrive. */}
                <p className="label label--ink bridge__train" data-step="train">
                  {BRIDGE.train}
                </p>
                <p className="label label--ink bridge__sent" data-step="sent">
                  {BRIDGE.sent}
                </p>
                <div className="bridge__layer" data-slot="layer">
                  <div className="bridge__mark" data-step="layer">
                    <span className="wordmark">{PRODUCT.name}</span>
                    <span className="label label--ink">{BRIDGE.layer}</span>
                  </div>
                  {/* Down a narrow window each pane's number stands under it, and its name and what it found in a block of four under the row. */}
                  {BRIDGE.checks.map((check, i) => (
                    <span key={`n${check}`} className="label bridge__num" style={{ "--f": PANES[i] } as CSSProperties} data-step={`num${i}`}>
                      {i + 1}
                    </span>
                  ))}
                  {BRIDGE.checks.map((check, i) => (
                    <div key={check} className="bridge__check" style={{ "--f": PANES[i], "--col": i % 2, "--row": Math.floor(i / 2) } as CSSProperties} data-step={`pane${i}`}>
                      <span className="label label--ink">
                        <span className="bridge__n">{i + 1} · </span>
                        {check}
                      </span>
                      {/* What this check finds, in words, once the roles have reached it. */}
                      <span className="verdict" data-step={`lit${i}`}>
                        {BRIDGE.verdicts[i]}
                      </span>
                      {i === 1 ? <Held step="held" /> : null}
                    </div>
                  ))}
                </div>
                <p className="note bridge__limits" data-step="limits">
                  {BRIDGE.limits}
                </p>
                <div className="bridge__direct" data-step="direct">
                  <p className="lead lead--ink">{BRIDGE.direct}</p>
                  <p className="body">{BRIDGE.decides}</p>
                </div>
                <div className="bridge__pool" data-slot="pool">
                  <p className="bridge__companies" data-step="pool">
                    <span className="label label--pool">{BRIDGE.companies}</span>
                    <span className="label label--ink">{POOL.count}</span>
                    <span className="note">{BRIDGE.listings}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Act two: the journey along it. One stop, and one card, for each advantage. */}
            <div className="act journey" data-act="journey">
              <div className="slot journey__phone" data-slot="phone" />
              <div className="journey__station" data-slot="station" aria-hidden="true">
                {/* 02, across a wide window: the three legal checks, each with where its rule is published (what they found is written once, on the bridge). */}
                {[0, 1, 2].map((i) => (
                  <div key={i} className="station__col" style={{ "--n": i - 1 } as CSSProperties} data-step={`legal${i}`}>
                    <span className="label label--ink">{BRIDGE.checks[i]}</span>
                    <span className="chip" data-step={`legal-lit${i}`}>
                      {BRIDGE.source} ↗
                    </span>
                  </div>
                ))}
                {/* 03 and 04: the Vetting pane alone. */}
                <div className="station__col" style={{ "--n": 0 } as CSSProperties} data-step="vetting">
                  <span className="label label--ink">{BRIDGE.checks[3]}</span>
                </div>
              </div>
              {/* 05: the direct line and the companies (placed in the act, round where the station stands). */}
              <p className="station__label station__label--pool" data-step="station-pool" aria-hidden="true">
                <span className="label label--pool">{BRIDGE.companies}</span>
                <span className="label label--ink">{POOL.count}</span>
              </p>
              <div className="station__direct" data-step="station-direct">
                <p className="lead lead--ink">{BRIDGE.directLabel}</p>
                {/* What happens to it, in three steps along the line, each as the application reaches it. */}
                <ol className="steps">
                  {BRIDGE.backend.map((step, i) => (
                    <li key={step} className="steps__step" data-step={`backend${i}`}>
                      <span className="label label--index">{i + 1}</span>
                      <span className="steps__text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="cards">
                {ADVANTAGES.map((advantage, i) => (
                  <div key={advantage.id} className="row" data-step={`card${i + 1}`}>
                    <SlotStill state={SCREENS[i]} />
                    <Card advantage={advantage} at={i} step={`card${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Act three: 06, the night, on the same set. */}
            <div className="act night" data-act="night">
              <div className="slot night__phone" data-slot="phone" />
              <div className="night__horizon" data-slot="horizon" />
              <div className="night__orbit" data-slot="orbit" />
              <div className="night__sat" data-slot="sat" />
              <div className="cards">
                <div className="row" data-step="card6">
                  <SlotStill state={SCREENS[5]} />
                  <Card advantage={NIGHTS} at={5} step="card6" night />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="start" className="start" data-chapter="start" aria-labelledby="start-title">
          <div className="start__copy" data-step="start">
            <h2 id="start-title" className="display">
              <Rolling text={START.title} />
            </h2>
            <p className="lead lead--ink">{START.send}</p>
            <div className="well">
              <Message />
              <CopyButton size="lg" />
            </div>
            <p className="note start__caption">
              <Following text={HERO.caption} />
            </p>
            <AppSwitch label={HERO.runsInside} />
            <ul className="body trust">
              {START.trust.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="slot start__phone" data-slot="phone" role="img" aria-label={ALT.connector}>
            <SlotStill state={CONNECT_SCREEN} />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__row">
          <p className="label">{FOOTER.pool}</p>
          <p className="label">{FOOTER.rights}</p>
        </div>
        <p className="footer__mark" aria-hidden="true">
          {PRODUCT.name}
        </p>
      </footer>

      <Sheet advantages={ALL} pictures={ALL.map((advantage, i) => <Still key={advantage.id} state={SCREENS[i]} alt={ALTS[i]} />)} />
    </>
  );
}
