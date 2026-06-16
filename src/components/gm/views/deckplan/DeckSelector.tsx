/**
 * DeckSelector — horizontal tab strip for switching which deck is previewed.
 *
 * Design tokens (per 29-UI-SPEC.md):
 *  - Strip height: 32px, background #0d1616, bottom border #1e3333
 *  - Active tab:   #c9a050 (amber) text + 2px amber bottom-border indicator
 *  - Inactive tab: #4a7070 text; hover → #7ab8b8
 *  - Typography:   11px / 600 / uppercase / 1px letter-spacing (Label role)
 */

import React, { useCallback } from 'react';

const FONT_FAMILY = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";

export interface DeckSelectorDeck {
  id: string;
  name?: string;
}

interface DeckSelectorProps {
  decks: DeckSelectorDeck[];
  selectedDeckId: string | null;
  onSelect: (deckId: string) => void;
}

export function DeckSelector({ decks, selectedDeckId, onSelect }: DeckSelectorProps) {
  const handleClick = useCallback((deckId: string) => {
    onSelect(deckId);
  }, [onSelect]);

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        background: '#0d1616',
        borderBottom: '1px solid #1e3333',
        flexShrink: 0,
        overflow: 'hidden',
        fontFamily: FONT_FAMILY,
      }}
      role="tablist"
      aria-label="Deck selector"
    >
      {decks.map((deck) => {
        const isActive = deck.id === selectedDeckId;
        const label = deck.name ? deck.name.toUpperCase() : deck.id.toUpperCase();
        return (
          <DeckTab
            key={deck.id}
            label={label}
            isActive={isActive}
            onClick={() => handleClick(deck.id)}
          />
        );
      })}
    </div>
  );
}

interface DeckTabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function DeckTab({ label, isActive, onClick }: DeckTabProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const color = isActive
    ? '#c9a050'
    : isHovered
    ? '#7ab8b8'
    : '#4a7070';

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace",
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color,
        cursor: 'pointer',
        boxSizing: 'border-box',
        borderBottom: isActive ? '2px solid #c9a050' : '2px solid transparent',
        transition: 'color 0.1s, border-color 0.1s',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  );
}
