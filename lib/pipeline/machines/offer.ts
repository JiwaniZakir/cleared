/**
 * Offer states. Stub: slice S11 writes the table.
 */
import type { OFFER_STATUSES } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type OfferEvent =
  | "confirmed_make_offer"
  | "offer_details"
  | "offer_extended"
  | "candidate_accepts"
  | "candidate_declines"
  | "expires"
  | "offer_esign_completed"
  | "confirmed_offer_rescind";

export const OFFER_MACHINE: MachineTable<OfferStatus, OfferEvent> = [];
