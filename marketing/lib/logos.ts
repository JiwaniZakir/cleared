/**
 * The companies' own marks, for the pool's logo wall.
 *
 * Each file is the company's own, copied byte for byte from `brand/companies/` (where `SOURCES.md` says
 * where each came from) into `public/brand/companies/`, and served from this site. A mark is shown with its
 * shapes unaltered: never cropped, redrawn or stretched, only scaled as a whole and rendered in the page's
 * one ink (an SVG's own fill and a PNG's own colours are replaced by the ink, through its alpha). A company
 * with no mark here is shown as its name in type, matched to sit with the marks.
 *
 * Draper is the exception on purpose: its brand guide says its logo may not be used without its written
 * approval, so it stays as its name in type until that approval arrives.
 */

export type Mark = {
  src: string;
  /** The file's own width over its height (its viewBox, or its pixels). */
  ratio: number;
  /** Where the mark's ink is inside the file, as fractions of its width and height: x, y, w, h. Measured once with ImageMagick. */
  ink: readonly [number, number, number, number];
  /**
   * A whole-mark scale for optical balance on the wall (1: equal area with every other mark). Set from how tall
   * the mark's letters are in its ink (a symbol beside short letters needs more room than a wordmark of capitals
   * the full height of its ink): the square root of the middle mark's letter height over this one's.
   */
  optical: number;
  /**
   * How much the file's own alpha is raised so that every part of the mark is the one ink: a part the company
   * sets in a second, lighter tone (Observable Space's "SPACE", white at 30%) is shown solid, as the rest is.
   */
  solid: number;
  /**
   * For a mark of hair-thin strokes (Observable Space's): a little more of the tile's width than the others may
   * take, and its alpha raised a little more in the stage's wall, where a texture seen small thins fine lines
   * that the browser draws crisply on the page without the stage. Never lighter than the other marks.
   */
  allowance: number;
  weight: number;
};

const mark = (file: string, ratio: number, ink: Mark["ink"], letters: number, solid = 1, allowance = 1, weight = 1): Mark => ({ src: `/brand/companies/${file}`, ratio, ink, optical: Math.sqrt(0.5 / letters), solid, allowance, weight });

/**
 * By the company's name as the listing gives it (data/pool.json). The fourth number is the height of the
 * mark's letters (capitals, or the x-height of a lower-case wordmark) as a share of its ink's height.
 */
export const MARKS: Record<string, Mark | null> = {
  "Anduril Industries": mark("anduril.svg", 136 / 25, [0, 0, 1, 1], 0.7),
  "Saronic Technologies": mark("saronic.svg", 140 / 28, [0, 0, 1, 1], 0.45),
  Astranis: mark("astranis.svg", 213 / 37, [0.0039, 0.015, 0.9957, 0.975], 0.44),
  Hadrian: mark("hadrian.svg", 174 / 29, [0, 0, 0.998, 0.9725], 1),
  "Apex Space": mark("apex.svg", 404 / 77, [0, 0, 1, 1], 0.9),
  Leonardo: mark("leonardo.svg", 237 / 42, [0, 0, 0.9956, 0.9925], 0.51),
  Amentum: mark("amentum.png", 2560 / 658, [0.0699, 0.272, 0.8602, 0.4559], 0.5),
  // Its brand guide: "Our logo may not be used without written approval of Draper." Its name, in type, until then.
  Draper: null,
  "Observable Space": mark("observable.png", 996 / 168, [0, 0, 1, 1], 0.36, 255 / 77, 1.12, 1.9),
};

export const markOf = (name: string): Mark | null => MARKS[name] ?? null;

/** The ink's own width over its height. */
const inkRatio = (m: Mark) => (m.ratio * m.ink[2]) / m.ink[3];

/**
 * How large each mark is drawn in a tile whose inside is `w` by `h`: every mark at the same area, balanced by
 * its `optical` scale (so no company stands larger than another), as large as lets all but the two hardest to
 * fit stand in that room; those two (the longest marks) are drawn as large as the room allows. Returns the size
 * of each mark's ink, and the box the whole file is drawn in so that its ink is centred: x and y from the
 * centre of the tile.
 */
export function fitMarks(names: readonly string[], w: number, h: number) {
  const marks = names.map(markOf);
  /** The largest area at which a mark still fits the room. */
  const room = (m: Mark) => Math.min((w * m.allowance) ** 2 / inkRatio(m), h * h * inkRatio(m)) / (m.optical * m.optical);
  const rooms = marks.flatMap((m) => (m ? [room(m)] : [])).sort((a, b) => a - b);
  const area = rooms[Math.min(rooms.length - 1, 2)] ?? 0;
  return marks.map((m) => {
    if (!m) return null;
    const r = inkRatio(m);
    const inkH = Math.sqrt(Math.min(area, room(m)) / r) * m.optical;
    const inkW = inkH * r;
    const fileW = inkW / m.ink[2];
    const fileH = inkH / m.ink[3];
    return { mark: m, inkW, inkH, file: { x: -inkW / 2 - m.ink[0] * fileW, y: -inkH / 2 - m.ink[1] * fileH, w: fileW, h: fileH } };
  });
}

/**
 * A name shown in type in place of a mark: its size, so that it sits with the marks (its capitals about as tall
 * as the marks' letters), and a weight between the page's text and its headlines, as heavy as the marks look.
 */
export const typeFor = (inkH: number) => ({ size: Math.round(inkH * 0.92), weight: 600 });
