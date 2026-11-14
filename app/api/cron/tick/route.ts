import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runTick } from "@/lib/jobs/tick";

/**
 * The daily cron (vercel.json): the backstop for work that
 * normally runs in `after()`. Vercel calls it with
 * `Authorization: Bearer ${CRON_SECRET}` (vercel.com/docs/cron-jobs/manage-cron-jobs);
 * anything else, including a missing CRON_SECRET, is 401 and runs nothing.
 * The response and the logs carry job names, statuses and counts only.
 */

// Up to Hobby's limit; the jobs themselves keep to small batches.
export const maxDuration = 60;

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  // Constant-time comparison of equal-length digests.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Unauthorized." } }, { status: 401 });
  }
  const jobs = await runTick({ now: new Date() });
  return NextResponse.json({ ok: true, jobs });
}
