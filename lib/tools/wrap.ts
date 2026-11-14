import { z } from "zod";
import { assertNoPiiCui, PiiCuiError } from "@/lib/guard/pii";
import { UpstreamApiError } from "@/lib/tools/upstream-error";
import { logServerError } from "@/lib/log";
import { findIgnoredInputKeys } from "@/lib/tools/ignored-keys";
import { PipelineError } from "@/lib/pipeline/errors";
import type { Principal, TokenProblem } from "@/lib/pipeline/actor";
import type { Side } from "@/lib/pipeline/vocab";
import type { WorkOrder } from "@/lib/workorder/schema";

/** Every tool output that cites a fact includes `sources`; this is the one
 * shape used everywhere so SOURCES.md / link-check tests can walk every tool
 * output uniformly. */
export const SourceRefSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  lastVerified: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

/**
 * Who may call a tool. "public" needs no credential and is the
 * default, so every existing tool is public without saying so. A pipeline
 * tool names the side its token must be for and whether it writes; "any"
 * is for the two tools both sides call (get_updates, get_application),
 * which answer each side with its own projection.
 */
export type ToolAccess = "public" | { side: Side | "any"; write: boolean };

/**
 * What the transport knows about the caller. Both routes
 * call `callTool(def, input)` today; slice S2 passes the bearer token's
 * principal (or the reason there is none) as this third argument.
 */
export interface ToolCallContext {
  principal?: Principal | null;
  /** Why there is no principal, for the `unauthenticated` message. Default "missing". */
  tokenProblem?: TokenProblem;
  requestId?: string;
}

/** Today's global limit, now the default of a per-tool `maxInputBytes`. */
export const DEFAULT_MAX_INPUT_BYTES = 20_000;

export interface ToolDef<TInput = unknown, TOutput = unknown> {
  name: string;
  title: string;
  description: string;
  /** MCP tool annotations. Omitted = read-only (every tool but one).
   *  contribute_anonymous_signal writes to a shared store, and some clients
   *  (Muse Code) run any tool declared read-only without asking first. */
  annotations?: { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  /** Omitted = "public". */
  access?: ToolAccess;
  /** Omitted = DEFAULT_MAX_INPUT_BYTES. */
  maxInputBytes?: number;
  /** `false` keeps a built-but-unfinished tool out of the registry (the pipeline stubs from slice S1). Omitted = true. */
  enabled?: boolean;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  /** Public tools ignore `ctx`; pipeline tools read the caller's principal from it. */
  handler: (input: TInput, ctx?: ToolCallContext) => Promise<TOutput>;
  /**
   * Optional, per-tool extra PII/CUI check beyond the standard per-field scan
   * every tool already gets. Runs after zod validation, before the handler,
   * inside the same error handling as the main guard (throw PiiCuiError to
   * reject). No tool uses it today. It was for a tool that echoes raw
   * user-approved text verbatim (`prepare_consented_card` did, before it
   * switched to returning a template with no values): only there is PII
   * fragmented across sibling fields (e.g. half an SSN in `headline`, the
   * other half in `notes`) worth the false-positive cost of also scanning
   * fields joined together — a cost that is NOT worth paying globally
   * (demonstrated false positive: `search_defense_roles({query: "software
   * engineer 123-45", location: "6789 Main St"})` is two completely
   * ordinary values that happen to concatenate into an SSN shape).
   */
  extraGuard?: (input: TInput) => void;
}

export type ToolErrorCode =
  | "pii_cui_rejected"
  | "invalid_input"
  | "upstream_error"
  | "not_found"
  | "internal_error"
  // Pipeline codes. No public tool returns these.
  | "unauthenticated"
  | "forbidden"
  | "conflict"
  | "gate_blocked"
  | "rate_limited";

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  /** Pipeline errors say what to do next. Absent on public tools' errors. */
  workOrder?: WorkOrder;
}

/** The access a tool declares, with the default applied. */
export function resolveAccess(def: Pick<ToolDef, "access">): ToolAccess {
  return def.access ?? "public";
}

const TOKEN_PROBLEM_MESSAGE: Record<TokenProblem, string> = {
  missing: "This tool needs the person's own access token, sent as the header Authorization: Bearer clp_… — none was sent.",
  revoked: "The access token sent with this call has been revoked.",
  expired: "The access token sent with this call has expired.",
  unknown: "The access token sent with this call is not recognised.",
};

const SIGN_IN_WORK_ORDER: WorkOrder = {
  summary: "Not signed in: pipeline tools act for one person and need that person's own token.",
  steps: [
    {
      who: "the_person",
      do: "Create a personal access token for the right side (candidate or employer) at /account/tokens, then add it to this connector as the header Authorization: Bearer followed by the token. Never paste the token into the chat.",
      url: "/account/tokens",
    },
    { who: "you_the_agent", do: "Once the token is in the connector, call this tool again." },
  ],
};

/** Decides `unauthenticated` / `forbidden` before a non-public tool's handler runs. */
function accessError(access: ToolAccess, ctx: ToolCallContext | undefined): ToolError | null {
  if (access === "public") return null;
  const principal = ctx?.principal;
  if (!principal) {
    return { code: "unauthenticated", message: TOKEN_PROBLEM_MESSAGE[ctx?.tokenProblem ?? "missing"], workOrder: SIGN_IN_WORK_ORDER };
  }
  if (access.side !== "any" && principal.side !== access.side) {
    return {
      code: "forbidden",
      message: `This tool is for the ${access.side} side, and this token is for the ${principal.side} side.`,
      workOrder: {
        summary: "Wrong kind of token for this tool.",
        steps: [{ who: "the_person", do: `Create a ${access.side} token at /account/tokens and use it for this connector.`, url: "/account/tokens" }],
      },
    };
  }
  const allowed = access.write ? principal.scopes.includes("pipeline:write") : principal.scopes.some((s) => s === "pipeline:read" || s === "pipeline:write");
  if (!allowed) {
    return {
      code: "forbidden",
      message: access.write ? "This token is read-only, and this tool makes changes." : "This token has no pipeline scope.",
      workOrder: {
        summary: "The token's scope does not cover this tool.",
        steps: [{ who: "the_person", do: "Create a read-write token at /account/tokens if your agent should make changes.", url: "/account/tokens" }],
      },
    };
  }
  return null;
}

/** Every successful result lists the input keys the tool did not
 *  take and dropped unused — names only, after the guard scanned them. */
export const IgnoredInputKeysSchema = z
  .array(z.string())
  .describe(
    "Input keys this tool does not take, which were dropped unused and not stored (nested keys as a.b, array items as a[0]). Empty when every key was used. If a key you meant to send is here, this tool cannot do what you sent it for.",
  );
export type WithIgnoredInputKeys<TOutput> = TOutput & { ignoredInputKeys: string[] };

/** The output schema a client is shown: the tool's own, plus ignoredInputKeys. */
export function advertisedOutputSchema(outputSchema: z.ZodType): z.ZodType {
  return outputSchema instanceof z.ZodObject ? outputSchema.extend({ ignoredInputKeys: IgnoredInputKeysSchema }) : outputSchema;
}

/** Keys the parse dropped, plus — for a schema that passes unknown keys
 *  through (prepare_consented_card keeps them to refuse its old contract) —
 *  top-level keys the schema doesn't declare, which the handler never reads. */
function ignoredInputKeys(inputSchema: z.ZodType, raw: unknown, parsed: unknown): string[] {
  const ignored = findIgnoredInputKeys(raw, parsed);
  if (inputSchema instanceof z.ZodObject && raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const key of Object.keys(raw)) {
      if (!(key in inputSchema.shape) && !ignored.includes(key)) ignored.push(key);
    }
  }
  return ignored;
}

export type ToolCallResult<TOutput> = { ok: true; data: TOutput } | { ok: false; error: ToolError };

// The default (DEFAULT_MAX_INPUT_BYTES, 20,000) is generous for free-text
// fields (e.g. a bio in prepare_consented_card), far below anything that
// looks like an abuse/DoS attempt against a per-request handler. A tool that
// takes a long submission declares its own `maxInputBytes`.

class ToolInputTooLargeError extends Error {
  constructor(size: number, limit: number) {
    super(`Input is too large (${size} bytes; limit is ${limit} bytes).`);
    this.name = "ToolInputTooLargeError";
  }
}

function assertInputSize(raw: unknown, limit: number): void {
  const size = Buffer.byteLength(JSON.stringify(raw ?? {}), "utf8");
  if (size > limit) {
    throw new ToolInputTooLargeError(size, limit);
  }
}

function formatZodError(error: z.ZodError): string {
  const issues = error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return `Invalid input — ${issues.join("; ")}`;
}

/**
 * The single entry point every tool call goes through, from both the MCP
 * route and the /api/tools/* playground route: one shared lib/tools/* used
 * by both, with no duplicated logic. Order matters:
 * size limit → PII/CUI guard → zod input validation → access check →
 * handler → zod output validation. The PII guard runs on the RAW input, before
 * zod even looks at it — zod only checks shape/type, so without this step a
 * string field would happily accept an SSN. A successful result carries
 * `ignoredInputKeys`.
 *
 * `ctx` is optional: a public tool called with two arguments behaves exactly
 * as before (tests/unit/wrap-compat.test.ts). A non-public tool without a
 * principal in `ctx` returns `unauthenticated` before its handler runs.
 */
export async function callTool<TInput, TOutput>(
  def: ToolDef<TInput, TOutput>,
  rawInput: unknown,
  ctx?: ToolCallContext,
): Promise<ToolCallResult<WithIgnoredInputKeys<TOutput>>> {
  try {
    assertInputSize(rawInput, def.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES);
    assertNoPiiCui(rawInput);
  } catch (err) {
    if (err instanceof PiiCuiError) {
      return { ok: false, error: { code: "pii_cui_rejected", message: err.message } };
    }
    if (err instanceof ToolInputTooLargeError) {
      return { ok: false, error: { code: "invalid_input", message: err.message } };
    }
    throw err;
  }

  const parsed = def.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "invalid_input", message: formatZodError(parsed.error) } };
  }

  if (def.extraGuard) {
    try {
      def.extraGuard(parsed.data);
    } catch (err) {
      if (err instanceof PiiCuiError) {
        return { ok: false, error: { code: "pii_cui_rejected", message: err.message } };
      }
      throw err;
    }
  }

  const denied = accessError(resolveAccess(def), ctx);
  if (denied) return { ok: false, error: denied };

  let result: TOutput;
  try {
    result = ctx === undefined ? await def.handler(parsed.data) : await def.handler(parsed.data, ctx);
  } catch (err) {
    if (err instanceof PipelineError) {
      return {
        ok: false,
        error: { code: err.code, message: err.message, ...(err.workOrder ? { workOrder: err.workOrder } : {}) },
      };
    }
    if (err instanceof UpstreamApiError) {
      logServerError("upstream_error", def.name, `${err.name}:${err.status}`);
      return {
        ok: false,
        error: {
          code: err.status === 404 ? "not_found" : "upstream_error",
          message:
            err.status === 404
              ? err.userMessage ?? "We couldn't find that — it may have been filled or removed since you last searched."
              : "A data source this tool depends on is temporarily unavailable. Please try again shortly.",
        },
      };
    }
    logServerError("handler_threw", def.name, err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: "Something went wrong generating this response. Please try again.",
      },
    };
  }

  const validatedOutput = def.outputSchema.safeParse(result);
  if (!validatedOutput.success) {
    logServerError("output_schema_mismatch", def.name, formatZodError(validatedOutput.error));
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: "Something went wrong generating this response. Please try again.",
      },
    };
  }

  return {
    ok: true,
    data: { ...validatedOutput.data, ignoredInputKeys: ignoredInputKeys(def.inputSchema, rawInput, parsed.data) },
  };
}
