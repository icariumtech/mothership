/**
 * gridProjection — coordinate transform between grid space and SVG space.
 *
 * INVARIANT: this module must NOT import from `src/types/encounterMap.ts`
 * (or any other domain module). Like `polygon2d`, it stays domain-free so
 * tokens, hulls, POIs, terminals — anything anchored to a grid coordinate —
 * can reuse it without coupling.
 *
 * `Projection` is the seam. Today only `topDownProjection({ unitSize })` is
 * implemented; tomorrow `isoProjection({ unitSize, tilt, rotation })` lands
 * here without breaking any caller. The renderer asks the projection for
 * SVG coordinates; the projection is the ONLY producer of SVG-space numbers
 * (interface invariant 2 of the four-module geometry stack).
 */

// ---- Coordinate spaces -------------------------------------------

/** A point in grid space. `gx` / `gy` are fractional cell coordinates. */
export interface GridPoint {
  gx: number;
  gy: number;
}

/** A point in SVG (pixel) space, the renderer's output coordinate frame. */
export interface SvgPoint {
  x: number;
  y: number;
}

// ---- Projection interface ----------------------------------------

/**
 * Bidirectional transform between grid space and SVG space.
 *
 * `unproject(project(p))` is identity within floating-point epsilon for any
 * `GridPoint`; the inverse round-trip is also identity for `SvgPoint`.
 */
export interface Projection {
  /** Map a grid coordinate to an SVG-space point (in pixels). */
  project(p: GridPoint): SvgPoint;
  /** Map an SVG-space point back to grid coordinates. */
  unproject(p: SvgPoint): GridPoint;
}

// ---- topDownProjection -------------------------------------------

/** Options for the top-down projection. */
export interface TopDownProjectionOptions {
  /** Pixels per grid cell. Must be > 0. */
  unitSize: number;
}

/**
 * Build a top-down (orthographic) projection where one grid cell maps to
 * `unitSize` pixels along each axis. Origin is preserved: grid (0,0) maps
 * to SVG (0, 0).
 *
 * @example
 *   const proj = topDownProjection({ unitSize: 40 });
 *   proj.project({ gx: 1.5, gy: 2 });   // → { x: 60, y: 80 }
 *   proj.unproject({ x: 60, y: 80 });   // → { gx: 1.5, gy: 2 }
 *
 * @example future iso swap (lands later, in the same shape)
 *   const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
 *   const view = makeMapView(proj);     // every other module is unaffected
 */
export function topDownProjection(opts: TopDownProjectionOptions): Projection {
  const us = opts.unitSize;
  if (!(us > 0) || !Number.isFinite(us)) {
    throw new Error(`topDownProjection: unitSize must be a positive finite number, got ${us}`);
  }
  return {
    project({ gx, gy }) {
      return { x: gx * us, y: gy * us };
    },
    unproject({ x, y }) {
      return { gx: x / us, gy: y / us };
    },
  };
}
