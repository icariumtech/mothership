/**
 * Shared color palette + wall thickness for EncounterMapRenderer and its
 * extracted layer components (RoomsLayer, DoorsLayer, DoorSymbol, PoiLayer).
 * Moved out of EncounterMapRenderer.tsx so layer files can import it without
 * a circular dependency back on the renderer.
 */

// V2-1 Color palette
export const COLORS = {
  bgPrimary: '#0a0a0a',
  bgRoom: '#0a1010',
  borderMain: '#4a6b6b',
  borderSubtle: '#2a3a3a',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  amberBright: '#9a8065',
  textPrimary: '#9a9a9a',
  textMuted: '#5a5a5a',
  hazard: '#8b5555',
  warning: '#8b7355',
  pathLine: '#3a5a5a',
  hullFill: '#142020',
  vent: '#2d7a5a',
  ventHidden: '#1a4a35',
};

// Connection/door type styles
export const CONNECTION_STYLES: Record<string, { stroke: string; doorFill: string }> = {
  standard: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
  airlock: { stroke: COLORS.pathLine, doorFill: COLORS.amber },
  blast_door: { stroke: COLORS.pathLine, doorFill: COLORS.tealBright },
  emergency: { stroke: COLORS.pathLine, doorFill: COLORS.hazard },
  open: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
};

// Wall stroke thickness in pixels (creates the heavy-wall aesthetic)
export const WALL_THICKNESS = 5;
