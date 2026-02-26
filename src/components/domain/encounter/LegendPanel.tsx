/**
 * LegendPanel - Shows door types and POI icons for encounter maps
 *
 * Rendered entirely with inline styles to remain immune to Ant Design
 * CSS overrides in the GM console context.
 */

import type { CSSProperties } from 'react';

// V2-1 Color palette (must match EncounterMapRenderer)
const COLORS = {
  bgPrimary: '#0a0a0a',
  bgPanel: '#1a2525',
  borderMain: '#4a6b6b',
  borderSubtle: '#2a3a3a',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  amberBright: '#9a8065',
  textMuted: '#7a7a7a',
  hazard: '#8b5555',
};

const FONT = "'Cascadia Code', 'Courier New', monospace";

const styles = {
  wrapper: {
    position: 'relative',
    background: COLORS.bgPanel,
    boxShadow: [
      `inset 0 2px 0 0 ${COLORS.borderMain}`,
      `inset -2px 0 0 0 ${COLORS.borderMain}`,
      `inset 0 -2px 0 0 ${COLORS.borderMain}`,
      `inset 2px 0 0 0 ${COLORS.borderMain}`,
    ].join(', '),
    clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: '140px',
  } satisfies CSSProperties,

  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '12px',
    height: '12px',
    background: `linear-gradient(to bottom right, transparent calc(50% - 2px), ${COLORS.borderMain} calc(50% - 2px), ${COLORS.borderMain} calc(50% + 2px), transparent calc(50% + 2px))`,
    pointerEvents: 'none',
    zIndex: 1,
  } satisfies CSSProperties,

  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '12px',
    height: '12px',
    background: `linear-gradient(to bottom right, transparent calc(50% - 2px), ${COLORS.borderMain} calc(50% - 2px), ${COLORS.borderMain} calc(50% + 2px), transparent calc(50% + 2px))`,
    pointerEvents: 'none',
    zIndex: 1,
  } satisfies CSSProperties,

  headerRow: {
    padding: '8px 2px 0 2px',
    flexShrink: 0,
  } satisfies CSSProperties,

  headerText: {
    fontFamily: FONT,
    fontSize: '11px',
    letterSpacing: '2px',
    color: COLORS.teal,
    textTransform: 'uppercase' as const,
    padding: '0 8px 4px 8px',
    borderBottom: `1px solid ${COLORS.borderSubtle}`,
    margin: 0,
    display: 'block',
  } satisfies CSSProperties,

  content: {
    padding: '8px',
    fontFamily: FONT,
    fontSize: '11px',
    lineHeight: '1.4',
  } satisfies CSSProperties,

  section: {
    marginBottom: '10px',
  } satisfies CSSProperties,

  sectionLast: {
    marginBottom: 0,
  } satisfies CSSProperties,

  sectionHeader: {
    color: COLORS.tealBright,
    fontSize: '10px',
    letterSpacing: '1px',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    fontFamily: FONT,
    display: 'block',
  } satisfies CSSProperties,

  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  } satisfies CSSProperties,

  itemLast: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: 0,
  } satisfies CSSProperties,

  label: {
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontSize: '11px',
    fontFamily: FONT,
  } satisfies CSSProperties,
};

export function LegendPanel() {
  return (
    <div style={styles.wrapper}>
      {/* Chamfer corner lines — inside clip-path scope, gradient straddles the cut edge */}
      <div style={styles.cornerTL} />
      <div style={styles.cornerBR} />

      {/* Header */}
      <div style={styles.headerRow}>
        <span style={styles.headerText}>LEGEND</span>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Doors section */}
        <div style={styles.section}>
          <span style={styles.sectionHeader}>DOORS</span>

          <div style={styles.item}>
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.teal} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span style={styles.label}>Standard</span>
          </div>

          <div style={styles.item}>
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.amber} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <rect x="5" y="5" width="14" height="6" fill="none" stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span style={styles.label}>Airlock</span>
          </div>

          <div style={styles.item}>
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.tealBright} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <line x1="5" y1="4" x2="19" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
              <line x1="19" y1="4" x2="5" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
            </svg>
            <span style={styles.label}>Blast Door</span>
          </div>

          <div style={styles.itemLast}>
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.hazard} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span style={styles.label}>Emergency</span>
          </div>
        </div>

        {/* POI section */}
        <div style={styles.sectionLast}>
          <span style={styles.sectionHeader}>POINTS OF INTEREST</span>

          <div style={styles.item}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L15,10 L5,10 Z" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span style={styles.label}>Objective</span>
          </div>

          <div style={styles.item}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="6" y="3" width="8" height="8" fill={COLORS.teal} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span style={styles.label}>Item</span>
          </div>

          <div style={styles.item}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L16,10 L4,10 Z" fill={COLORS.hazard} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span style={styles.label}>Hazard</span>
          </div>

          <div style={styles.itemLast}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="4" y="2" width="12" height="10" rx="1" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
              <rect x="6" y="4" width="8" height="6" fill={COLORS.bgPrimary} />
            </svg>
            <span style={styles.label}>Terminal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
