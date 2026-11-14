/**
 * A candidate-request kind: how the hiring team sends it (send_request) and
 * how the candidate answers it (respond_to_request).
 */
import type { z } from "zod";
import type { SendRequestKindSchema } from "@/lib/tools/pipeline/send-request";
import type { RespondAnswerSchema } from "@/lib/tools/pipeline/respond-to-request";

export type SendRequestKind = z.infer<typeof SendRequestKindSchema>;
export type RespondAnswer = z.infer<typeof RespondAnswerSchema>;
