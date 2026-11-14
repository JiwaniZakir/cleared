/**
 * The phone's proportions, with its height as 1. Shared by the model (phone.ts), the director, and the flat
 * still, so a screen is the same shape everywhere. Close to a current 6.1-inch phone: 70.6 x 146.6 x 8.4 mm.
 */
export const PHONE = {
  w: 0.4815,
  d: 0.0575,
  /** The body's corner radius, seen from the front. */
  corner: 0.071,
  /** The frame's chamfer: what shows of the metal from the front. */
  edge: 0.008,
  /** Black glass between the frame and the lit screen. */
  bezel: 0.01,
} as const;

/** The lit screen, in the same units. Its shape is 390 : 844. */
export const GLASS = { w: PHONE.w - 2 * PHONE.edge, h: 1 - 2 * PHONE.edge, corner: PHONE.corner - PHONE.edge } as const;
export const DISPLAY = { w: GLASS.w - 2 * PHONE.bezel, h: GLASS.h - 2 * PHONE.bezel, corner: GLASS.corner - PHONE.bezel } as const;
