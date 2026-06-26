/**
 * DeckplanPreviewPane — live map preview for deckplan.yaml files.
 *
 * Parses the Monaco buffer text (debounced 200ms) and renders the
 * selected deck via MapPreview. Keeps the last-good parse so that a
 * mid-edit YAML error never blanks the preview (Pitfall 2 in RESEARCH).
 *
 * Selection persistence: keyed by deck id. If the previously-selected
 * id disappears after a re-parse, falls back to `default: true` deck
 * then `decks[0]` (Pitfall 1).
 *
 * Design tokens (per 29-UI-SPEC.md):
 *  - Pane background: #080e0e
 *  - Header label: #4a7070, 11px/600/1px letter-spacing (Label role)
 *  - Empty state copy: "NO PREVIEW AVAILABLE"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPreview } from '@/components/gm/MapPreview';
import { parseYamlSafe, deckToMapData } from './useDeckplanModel';
import { DeckSelector, type DeckSelectorDeck } from './DeckSelector';
import type { GridEncounterMapData } from '@/types/encounterMap';

const FONT_FAMILY = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";
const DEBOUNCE_MS = 200;

interface DeckplanPreviewPaneProps {
  /** Raw YAML text from the Monaco buffer. */
  yamlText: string;
  /** Currently selected deck id (controlled from parent). */
  selectedDeckId: string | null;
  /** Called when user switches decks in the selector. */
  onDeckSelect: (deckId: string) => void;
  // Editor-mode callbacks (Plan 29-04 wires these to Monaco)
  onRoomClick?: (roomId: string) => void;
  onPoiClick?: (poiId: string) => void;
  onPoiMove?: (poiId: string, x: number, y: number) => void;
  onEmptyCellClick?: (x: number, y: number) => void;
}

interface ParsedDeckplan {
  decks: Array<{ id: string; name?: string; default?: boolean }>;
  [key: string]: unknown;
}

/**
 * Extract the deck list from a parsed deckplan object.
 */
function extractDecks(parsed: unknown): Array<{ id: string; name?: string; default?: boolean }> {
  if (!parsed || typeof parsed !== 'object') return [];
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.decks)) return [];
  return p.decks.filter(
    (d: unknown): d is { id: string; name?: string; default?: boolean } =>
      d !== null && typeof d === 'object' && typeof (d as Record<string, unknown>).id === 'string',
  );
}

/**
 * Resolve which deck to show. Prefers the previously-selected id; falls back
 * to the `default: true` deck, then decks[0].
 */
function resolveSelectedDeckId(
  decks: Array<{ id: string; default?: boolean }>,
  currentId: string | null,
): string | null {
  if (decks.length === 0) return null;
  if (currentId && decks.some((d) => d.id === currentId)) return currentId;
  const defaultDeck = decks.find((d) => d.default === true);
  if (defaultDeck) return defaultDeck.id;
  return decks[0].id;
}

export function DeckplanPreviewPane({
  yamlText,
  selectedDeckId,
  onDeckSelect,
  onRoomClick,
  onPoiClick,
  onPoiMove,
  onEmptyCellClick,
}: DeckplanPreviewPaneProps) {
  // Last successfully parsed deckplan (kept on parse error — Pitfall 2)
  const lastGoodParsedRef = useRef<ParsedDeckplan | null>(null);
  // Track whether we've ever successfully parsed this file
  const hasEverParsedRef = useRef(false);

  const [decks, setDecks] = useState<DeckSelectorDeck[]>([]);
  const [mapData, setMapData] = useState<GridEncounterMapData | null>(null);
  const [parseError, setParseError] = useState(false);

  // Debounce ref for YAML re-parse
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doParse = useCallback((text: string, currentDeckId: string | null) => {
    const parsed = parseYamlSafe(text);
    if (!parsed) {
      setParseError(true);
      // Keep last-good state — only show empty if we never had a good parse
      if (lastGoodParsedRef.current && hasEverParsedRef.current) {
        // Stale preview is better than blanking (Pitfall 2) — leave state as-is
      }
      return;
    }

    // Successful parse
    lastGoodParsedRef.current = parsed as ParsedDeckplan;
    hasEverParsedRef.current = true;
    setParseError(false);

    const deckList = extractDecks(parsed);
    const resolvedId = resolveSelectedDeckId(deckList, currentDeckId);

    setDecks(deckList.map((d) => ({ id: d.id, name: d.name })));

    if (resolvedId) {
      // If the resolved id differs from current, notify parent
      if (resolvedId !== currentDeckId) {
        onDeckSelect(resolvedId);
      }
      const md = deckToMapData(parsed, resolvedId);
      setMapData(md);
    } else {
      setMapData(null);
    }
  }, [onDeckSelect]);

  // Re-parse whenever yamlText changes (debounced)
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      doParse(yamlText, selectedDeckId);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [yamlText, doParse]); // Note: selectedDeckId excluded intentionally — deck switches are immediate

  // When selectedDeckId changes (user clicked a tab), update map data immediately
  useEffect(() => {
    if (!lastGoodParsedRef.current || !selectedDeckId) return;
    const md = deckToMapData(lastGoodParsedRef.current, selectedDeckId);
    setMapData(md);
  }, [selectedDeckId]);

  // Empty state: show only if we have never successfully parsed this file
  const showEmptyState = !hasEverParsedRef.current || (parseError && !lastGoodParsedRef.current);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#080e0e',
        overflow: 'hidden',
      }}
    >
      {/* Preview pane header */}
      <div
        style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: FONT_FAMILY,
          letterSpacing: '1px',
          color: '#4a7070',
          textTransform: 'uppercase',
          background: '#0d1616',
          borderBottom: '1px solid #1e3333',
        }}
      >
        MAP PREVIEW
      </div>

      {/* Deck selector (only when decks are available) */}
      {decks.length > 0 && (
        <DeckSelector
          decks={decks}
          selectedDeckId={selectedDeckId}
          onSelect={onDeckSelect}
        />
      )}

      {/* Map preview or empty state */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {showEmptyState ? (
          <div
            className="gm-file-editor-view__empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#2a4a4a',
                letterSpacing: '1px',
                fontFamily: FONT_FAMILY,
                textTransform: 'uppercase',
              }}
            >
              NO PREVIEW AVAILABLE
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#2a4a4a',
                fontFamily: FONT_FAMILY,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              Fix the YAML syntax error above to restore the live map preview. Your edits are not lost.
            </div>
          </div>
        ) : mapData ? (
          <MapPreview
            mapData={mapData}
            roomVisibility={{}}
            fill
            isGM
            editable
            onRoomClick={onRoomClick}
            onPoiClick={onPoiClick}
            onPoiMove={onPoiMove}
            onEmptyCellClick={onEmptyCellClick}
          />
        ) : (
          // We have a good parse but deck has no renderable data — still better than empty state
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 11,
              color: '#2a4a4a',
              fontFamily: FONT_FAMILY,
              letterSpacing: '1px',
            }}
          >
            NO DECK DATA
          </div>
        )}
      </div>
    </div>
  );
}
