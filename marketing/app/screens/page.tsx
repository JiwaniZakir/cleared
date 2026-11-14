import type { Metadata } from "next";
import { Still } from "@/components/Still";
import { ALL_SCREENS } from "@/components/stage/states";
import { APPS, type AppId } from "@/lib/app";

export const metadata: Metadata = { title: "Phone screens, for review", robots: { index: false, follow: false } };

/**
 * Every state of the phone's screen, in both apps, flat and at full size: for checking them against the two
 * apps' real interfaces, and for review before launch. Not linked
 * from the page and not indexed.
 */
export default function Screens() {
  return (
    <main className="screens">
      {ALL_SCREENS.map((screen) => (
        <section key={screen.id} className="screens__row" data-screen={screen.id}>
          <h2 className="label">{screen.name}</h2>
          {(Object.keys(APPS) as AppId[]).map((app) => (
            <figure key={app} data-app={app}>
              <Still state={screen.state} app={app} alt={`${APPS[app].name}: ${screen.name}`} />
              <figcaption className="label">{APPS[app].name}</figcaption>
            </figure>
          ))}
        </section>
      ))}
    </main>
  );
}
