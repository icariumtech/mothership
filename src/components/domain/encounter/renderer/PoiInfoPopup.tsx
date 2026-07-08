/**
 * PoiInfoPopup - Hover/click info card for a POI (name, status, description).
 * Extracted from EncounterMapRenderer's inline poi-popover JSX block.
 */
import { PoiData } from '../../../../types/encounterMap';
import { COLORS } from './mapColors';

interface PoiInfoPopupProps {
  poi: PoiData;
  x: number;
  y: number;
}

export function PoiInfoPopup({ poi, x, y }: PoiInfoPopupProps) {
  const borderColor =
    poi.type === 'hazard'    ? COLORS.hazard :
    poi.type === 'objective' ? COLORS.amber :
    poi.type === 'item'      ? COLORS.tealBright :
    COLORS.teal;

  return (
    <div
      style={{
        position: 'absolute',
        left: x + 14,
        top: y - 10,
        background: 'rgba(10, 10, 10, 0.97)',
        border: `1px solid ${borderColor}`,
        padding: '8px 12px',
        fontFamily: "'Cascadia Code', 'Courier New', monospace",
        fontSize: '11px',
        letterSpacing: '1px',
        pointerEvents: 'none',
        zIndex: 10,
        maxWidth: '220px',
        lineHeight: '1.5',
      }}
    >
      <div style={{ color: COLORS.textPrimary, marginBottom: 2, fontWeight: 'bold' }}>
        {poi.name}
      </div>
      {poi.status && (
        <div style={{ color: poi.type === 'hazard' ? COLORS.hazard : COLORS.amber, fontSize: '10px' }}>
          {poi.status}
        </div>
      )}
      {poi.description && (
        <div style={{ color: COLORS.textMuted, fontSize: '10px', marginTop: 4 }}>
          {poi.description}
        </div>
      )}
    </div>
  );
}
