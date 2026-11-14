import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import {
  PIPELINE_GATES,
  PIPELINE_SOURCES,
  PIPELINE_STAGES,
  PIPELINE_STEPS_CHECKED,
  PIPELINE_TERMS,
  STEP_CLASS_INFO,
  WHY_PERSON,
  stepsInStage,
  type PipelineGate,
  type PipelineStepEntry,
  type StepClass,
} from "@/lib/pipeline-steps-data";
import { NOT_BUILT_BANNER, NOT_BUILT_LABEL, isBuilt } from "@/lib/pipeline-availability";

/**
 * The recruiter's guide to the pipeline (/docs/recruiter),
 * generated from data/pipeline-steps.json so it cannot drift from the data
 * the tools use. A Server Component with no client code. Every legal claim
 * links to its source with the date it was checked; every part that is not
 * built yet says so, driven by lib/pipeline-availability.ts alone.
 */

const CLASS_LABEL = Object.fromEntries(STEP_CLASS_INFO.map((c) => [c.id, c.label])) as Record<StepClass, string>;
const CLASS_TONE: Record<StepClass, "neutral" | "accent" | "caution"> = {
  AGENT: "accent",
  "PREP+SIGN": "neutral",
  "NAMED ROLE": "caution",
  "GOV ONLY": "neutral",
};

const H2 = "text-[1.5rem] leading-[1.3] font-semibold tracking-[-0.005em] text-neutral-12";
const H3 = "text-[1.0625rem] leading-[1.4] font-semibold text-neutral-12";
const BODY = "text-base leading-[1.6] text-neutral-11";
const LINK = "text-accent-11 underline underline-offset-2 hover:text-accent-10";

function SourceLink({ id, cite }: { id: string; cite?: string }) {
  const source = PIPELINE_SOURCES[id];
  return (
    <span>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK} title={source.title}>
        {cite ?? source.title}
      </a>
      <span className="text-neutral-10"> (checked {source.checked})</span>
    </span>
  );
}

function SourceList({ basis }: { basis: { source: string; cite: string }[] }) {
  return (
    <>
      {basis.map((b, i) => (
        <span key={`${b.source}-${i}`}>
          {i > 0 && "; "}
          <SourceLink id={b.source} cite={b.cite} />
        </span>
      ))}
    </>
  );
}

function NotBuilt({ slices }: { slices: string[] }) {
  if (isBuilt(slices)) return null;
  return (
    <Badge tone="neutral" appearance="subtle" className="ml-2 align-middle">
      {NOT_BUILT_LABEL}
    </Badge>
  );
}

function stepRange(first: number, last: number): string {
  return first === last ? `step ${first}` : `steps ${first}\u2013${last}`;
}

function stageSources(steps: PipelineStepEntry[]): string[] {
  return [...new Set(steps.flatMap((s) => s.basis.map((b) => b.source)))];
}

function stepLabel(step: PipelineStepEntry) {
  return `Step ${step.n}`;
}

function gatesForStage(stageSteps: PipelineStepEntry[]): PipelineGate[] {
  const ns = new Set(stageSteps.map((s) => s.n));
  return PIPELINE_GATES.filter((g) => g.steps.some((n) => ns.has(n)));
}

function stepTitle(n: number): string {
  for (const stage of PIPELINE_STAGES) {
    const step = stepsInStage(stage.id).find((s) => s.n === n);
    if (step) return `step ${n}, ${step.title.charAt(0).toLowerCase()}${step.title.slice(1)}`;
  }
  return `step ${n}`;
}

export function RecruiterGuide() {
  const anyUnbuilt =
    PIPELINE_STAGES.some((st) => stepsInStage(st.id).some((s) => !isBuilt(s.slices))) || PIPELINE_GATES.some((g) => !isBuilt(g.slices));

  return (
    <article>
      <h1 className="text-[1.875rem] leading-[1.25] font-semibold tracking-[-0.005em] text-neutral-12">Recruiter guide</h1>
      <p className="mt-3 text-[1.125rem] leading-[1.6] text-neutral-11">
        Every step from opening a role to a new hire&rsquo;s first day: what happens, what cleared does for you,
        what you or a named colleague must do yourselves and why, and what must never happen before what.
      </p>

      <DisclaimerBanner className="mt-6">
        {`This is general information, not legal advice. Laws differ by state and city and change; have counsel confirm your own process. Sources were checked on ${PIPELINE_STEPS_CHECKED} unless a link says otherwise.`}
      </DisclaimerBanner>

      {anyUnbuilt && <p className={`mt-4 ${BODY}`}>{NOT_BUILT_BANNER}</p>}

      <nav aria-label="Stages" className="mt-8">
        <h2 className={H3}>Stages</h2>
        <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <li key={stage.id} className="text-sm leading-[1.6]">
              <a href={`#${stage.id}`} className={LINK}>
                {i + 1}. {stage.title}
              </a>
              <span className="text-neutral-10"> ({stepRange(stage.firstStep, stage.lastStep)})</span>
            </li>
          ))}
        </ol>
      </nav>

      <section className="mt-10" aria-labelledby="who-does-what">
        <h2 id="who-does-what" className={H2}>
          Who does what
        </h2>
        <p className={`mt-3 ${BODY}`}>
          Each step has one of four labels, from the step table this guide is built on. Your agent can take a step off
          your hands only where the label says so; elsewhere a person decides, signs or acts, and the reason is given.
        </p>
        <dl className="mt-4 grid gap-3">
          {STEP_CLASS_INFO.map((c) => (
            <div key={c.id} className="flex flex-col gap-1">
              <dt>
                <Badge tone={CLASS_TONE[c.id]} appearance="subtle">
                  {c.label}
                </Badge>
              </dt>
              <dd className="text-sm leading-[1.6] text-neutral-11">{c.means}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="terms">
        <h2 id="terms" className={H2}>
          Terms used here
        </h2>
        <dl className="mt-4 grid gap-3">
          {PIPELINE_TERMS.map((t) => (
            <div key={t.term}>
              <dt className="text-sm font-semibold text-neutral-12">{t.term}</dt>
              <dd className="text-sm leading-[1.6] text-neutral-11">
                {t.means}
                {t.source && (
                  <>
                    {" "}
                    <SourceLink id={t.source} cite="Source" />
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {PIPELINE_STAGES.map((stage, index) => {
        const steps = stepsInStage(stage.id);
        const personSteps = steps.filter((s) => s.class !== "AGENT" || s.namedRole);
        const gates = gatesForStage(steps);
        return (
          <section key={stage.id} id={stage.id} className="mt-14 scroll-mt-20" aria-labelledby={`${stage.id}-title`}>
            <p className="font-mono text-[0.8125rem] text-neutral-10">
              Stage {index + 1} · {stepRange(stage.firstStep, stage.lastStep)} · {stage.appliesTo}
            </p>
            <h2 id={`${stage.id}-title`} className={`mt-1 ${H2}`}>
              {stage.title}
            </h2>

            <h3 className={`mt-5 ${H3}`}>What happens</h3>
            <p className={`mt-2 ${BODY}`}>{stage.whatHappens}</p>
            {stageSources(steps).length > 0 && (
              <p className="mt-2 text-sm leading-[1.6] text-neutral-11">
                <span className="font-semibold text-neutral-12">Sources: </span>
                {stageSources(steps).map((id, i) => (
                  <span key={id}>
                    {i > 0 && "; "}
                    <SourceLink id={id} />
                  </span>
                ))}
              </p>
            )}

            <h3 className={`mt-6 ${H3}`}>What cleared does</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {steps.map((s) => (
                <li key={s.id} className={BODY}>
                  <span className="font-medium text-neutral-12">
                    {stepLabel(s)}, {s.title}:
                  </span>{" "}
                  {s.productDoes}
                  <NotBuilt slices={s.slices} />
                </li>
              ))}
            </ul>

            {personSteps.length > 0 && (
              <>
                <h3 className={`mt-6 ${H3}`}>What you or a named colleague must do</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {personSteps.map((s) => (
                    <li key={s.id} className={BODY}>
                      <span className="font-medium text-neutral-12">
                        {stepLabel(s)}, {s.title}
                      </span>{" "}
                      <Badge tone={CLASS_TONE[s.class]} appearance="subtle" className="align-middle">
                        {CLASS_LABEL[s.class]}
                      </Badge>
                      <br />
                      <span>Who: {s.namedRole}.</span>
                      {s.whyPerson && <span> Why: {WHY_PERSON[s.whyPerson]}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {gates.length > 0 && (
              <>
                <h3 className={`mt-6 ${H3}`}>Never before</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {gates.map((g) => (
                    <li key={g.id} className={BODY}>
                      <span className="text-neutral-12">{g.rule}</span>
                      {g.notBefore !== null && (
                        <span className="text-neutral-10">
                          {" "}
                          (Not before {stepTitle(g.notBefore)}.)
                        </span>
                      )}
                      {g.basis.length > 0 && (
                        <span className="block text-sm">
                          Source: <SourceList basis={g.basis} />
                        </span>
                      )}
                      {!isBuilt(g.slices) && (
                        <span className="block text-sm text-neutral-10">
                          cleared will enforce this; until then, follow it yourself.
                          <NotBuilt slices={g.slices} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className={`mt-6 ${H3}`}>Step by step</h3>
            <ol className="mt-2 flex flex-col gap-2">
              {steps.map((s) => (
                <li key={s.id} id={s.id} className="rounded-md border border-neutral-6 bg-neutral-1">
                  <details>
                    <summary className="cursor-pointer px-4 py-3 text-base leading-[1.5] text-neutral-12">
                      <span className="font-mono text-[0.8125rem] text-neutral-10">{stepLabel(s)}</span>{" "}
                      <span className="font-medium">{s.title}</span>{" "}
                      <Badge tone={CLASS_TONE[s.class]} appearance="subtle" className="align-middle">
                        {CLASS_LABEL[s.class]}
                      </Badge>
                    </summary>
                    <div className="border-t border-neutral-6 px-4 py-3">
                      <p className={BODY}>{s.detail}</p>
                      <dl className="mt-3 grid gap-2 text-sm leading-[1.6]">
                        <div>
                          <dt className="inline font-semibold text-neutral-12">Who acts: </dt>
                          <dd className="inline text-neutral-11">{s.namedRole ?? "Your agent, within rules a person set."}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-neutral-12">Record it produces: </dt>
                          <dd className="inline text-neutral-11">{s.record}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-neutral-12">Law or rule: </dt>
                          <dd className="inline text-neutral-11">
                            {s.basis.length > 0 ? <SourceList basis={s.basis} /> : "None cited."}
                            {s.basisNote && <> {s.basisNote}</>}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-neutral-12">cleared: </dt>
                          <dd className="inline text-neutral-11">
                            {s.productDoes}
                            <NotBuilt slices={s.slices} />
                          </dd>
                        </div>
                        {s.ruleTopic && (
                          <div>
                            <dt className="inline font-semibold text-neutral-12">Ask your agent: </dt>
                            <dd className="inline text-neutral-11">
                              call <code className="rounded bg-neutral-3 px-1 py-0.5 font-mono text-[0.9em]">explain_rule</code> with
                              the topic <code className="rounded bg-neutral-3 px-1 py-0.5 font-mono text-[0.9em]">{s.ruleTopic}</code>{" "}
                              (works today, no sign-in).
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className="mt-14" aria-labelledby="where-from">
        <h2 id="where-from" className={H2}>
          Where this comes from
        </h2>
        <p className={`mt-3 ${BODY}`}>
          The 38 steps, who may do each and the law behind it come from a research review of the recruiting process
          dated {PIPELINE_STEPS_CHECKED}. Every source on this page is also listed, with its checked date, on{" "}
          <Link href="/sources" className={LINK}>
            Sources
          </Link>
          . To try the tools that work today, open{" "}
          <Link href="/try" className={LINK}>
            Try it
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
