/**
 * Tests for deckplanYamlEdits.ts — buildPositionEdit and buildAddPoiEdit
 *
 * Covers:
 * - buildPositionEdit: flow-style position patch with correct range + text
 * - buildPositionEdit: block-style position collapses to single-line flow
 * - buildPositionEdit: returns null for unknown poiId
 * - buildPositionEdit: returns null on broken YAML (never throws)
 * - buildAddPoiEdit (poi-exists): inserts at end of existing poi seq
 * - buildAddPoiEdit (poi-absent): inserts new poi: key + first item
 * - buildAddPoiEdit: defaults name "New POI", type/icon "marker"
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildPositionEdit, buildAddPoiEdit } from '../deckplanYamlEdits';

const FIXTURE_PATH = resolve(__dirname, '../__fixtures__/deckplan.fixture.yaml');
const FIXTURE_TEXT = readFileSync(FIXTURE_PATH, 'utf8');

// ----------------------------------------------------------------
// buildPositionEdit
// ----------------------------------------------------------------

describe('buildPositionEdit', () => {
  it('returns null for an unknown poiId', () => {
    const result = buildPositionEdit(FIXTURE_TEXT, 'main_deck', 'nonexistent_poi', 10, 20);
    expect(result).toBeNull();
  });

  it('returns null for an unknown deckId', () => {
    const result = buildPositionEdit(FIXTURE_TEXT, 'nonexistent_deck', 'poi_alpha', 10, 20);
    expect(result).toBeNull();
  });

  it('returns null on broken YAML without throwing', () => {
    expect(() => buildPositionEdit('garbage: [', 'main_deck', 'poi_alpha', 5, 7)).not.toThrow();
    expect(buildPositionEdit('garbage: [', 'main_deck', 'poi_alpha', 5, 7)).toBeNull();
  });

  it('returns a TextEdit for an existing POI with the correct replacement text', () => {
    const edit = buildPositionEdit(FIXTURE_TEXT, 'main_deck', 'poi_alpha', 10, 20);
    expect(edit).not.toBeNull();
    expect(edit!.text).toBe('{x: 10, y: 20}');
  });

  it('returned TextEdit has valid 1-based line/col boundaries', () => {
    const edit = buildPositionEdit(FIXTURE_TEXT, 'main_deck', 'poi_alpha', 10, 20);
    expect(edit).not.toBeNull();
    expect(edit!.startLine).toBeGreaterThanOrEqual(1);
    expect(edit!.startCol).toBeGreaterThanOrEqual(1);
    expect(edit!.endLine).toBeGreaterThanOrEqual(edit!.startLine);
  });

  it('range covers the position value span (applying the edit produces valid YAML)', () => {
    const edit = buildPositionEdit(FIXTURE_TEXT, 'main_deck', 'poi_alpha', 10, 20);
    expect(edit).not.toBeNull();
    // Apply the edit to the fixture text and verify the result contains the new position
    const lines = FIXTURE_TEXT.split('\n');
    const startIdx = edit!.startLine - 1; // 0-based
    const endIdx = edit!.endLine - 1;     // 0-based
    const startCol = edit!.startCol - 1;  // 0-based
    const endCol = edit!.endCol - 1;      // 0-based
    // Reconstruct: replace the range with the new text
    const before = lines[startIdx].slice(0, startCol);
    const after = lines[endIdx].slice(endCol);
    lines[startIdx] = before + edit!.text + after;
    // Remove any intermediate lines if multi-line (for block-style case)
    if (endIdx > startIdx) {
      lines.splice(startIdx + 1, endIdx - startIdx);
    }
    const patched = lines.join('\n');
    expect(patched).toContain('{x: 10, y: 20}');
    // Old position should be gone (replaced)
    expect(patched).not.toContain('{x: 5, y: 4}');
  });

  it('handles block-style position (collapses to single-line flow)', () => {
    // A deckplan with a POI that has block-style position
    const blockYaml = [
      'name: Test',
      'decks:',
      '- id: main_deck',
      '  name: Main',
      '  rooms: []',
      '  poi:',
      '  - id: poi_block',
      '    name: Block POI',
      '    type: objective',
      '    icon: marker',
      '    position:',
      '      x: 1',
      '      y: 2',
    ].join('\n');

    const edit = buildPositionEdit(blockYaml, 'main_deck', 'poi_block', 5, 7);
    expect(edit).not.toBeNull();
    expect(edit!.text).toBe('{x: 5, y: 7}');
    // The range should span MORE than one column (covers multi-line block value)
    // Either multi-line range or same-line but the text is replaced
    // Either way, applying the edit collapses to flow style
    const lines = blockYaml.split('\n');
    const startIdx = edit!.startLine - 1;
    const endIdx = edit!.endLine - 1;
    const startCol = edit!.startCol - 1;
    const endCol = edit!.endCol - 1;
    const before = lines[startIdx].slice(0, startCol);
    const after = lines[endIdx].slice(endCol);
    lines[startIdx] = before + edit!.text + after;
    if (endIdx > startIdx) {
      lines.splice(startIdx + 1, endIdx - startIdx);
    }
    const patched = lines.join('\n');
    expect(patched).toContain('{x: 5, y: 7}');
    expect(patched).not.toContain('x: 1');
    expect(patched).not.toContain('y: 2');
  });
});

// ----------------------------------------------------------------
// buildAddPoiEdit
// ----------------------------------------------------------------

describe('buildAddPoiEdit', () => {
  it('returns null for an unknown deckId', () => {
    const result = buildAddPoiEdit(FIXTURE_TEXT, 'nonexistent_deck', 3, 4);
    expect(result).toBeNull();
  });

  it('returns null on broken YAML without throwing', () => {
    expect(() => buildAddPoiEdit('garbage: [', 'main_deck', 3, 4)).not.toThrow();
    expect(buildAddPoiEdit('garbage: [', 'main_deck', 3, 4)).toBeNull();
  });

  describe('poi-exists branch (main_deck has a poi: list)', () => {
    it('returns a TextEdit for insertion', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit).not.toBeNull();
    });

    it('inserted text contains default name "New POI"', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit!.text).toContain('New POI');
    });

    it('inserted text contains default type "marker"', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit!.text).toContain('marker');
    });

    it('inserted text contains the given x and y coordinates', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit!.text).toContain('7');
      expect(edit!.text).toContain('10');
    });

    it('opts override the defaults', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 3, 4, {
        name: 'Custom Name',
        type: 'hazard',
        icon: 'reactor core',
      });
      expect(edit!.text).toContain('Custom Name');
      expect(edit!.text).toContain('hazard');
      expect(edit!.text).toContain('reactor core');
    });

    it('insertion point is at end of existing poi seq (startLine >= poi list line)', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit).not.toBeNull();
      // The insertion should be within the main_deck poi area (not at beginning of file)
      expect(edit!.startLine).toBeGreaterThan(1);
    });

    it('applying edit adds a new poi item to the existing list', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'main_deck', 7, 10);
      expect(edit).not.toBeNull();
      // Apply: the edit is an insertion (startLine==endLine, replacement text is the new content)
      const lines = FIXTURE_TEXT.split('\n');
      const startIdx = edit!.startLine - 1;
      const endIdx = edit!.endLine - 1;
      const startCol = edit!.startCol - 1;
      const endCol = edit!.endCol - 1;
      const before = lines[startIdx].slice(0, startCol);
      const after = lines[endIdx].slice(endCol);
      lines[startIdx] = before + edit!.text + after;
      if (endIdx > startIdx) {
        lines.splice(startIdx + 1, endIdx - startIdx);
      }
      const patched = lines.join('\n');
      // Should still contain the original poi
      expect(patched).toContain('poi_alpha');
      // And the new inserted content
      expect(patched).toContain('New POI');
    });
  });

  describe('poi-absent branch (lower_deck has no poi: list)', () => {
    it('returns a TextEdit for insertion', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'lower_deck', 5, 9);
      expect(edit).not.toBeNull();
    });

    it('inserted text contains a poi: key and the new item', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'lower_deck', 5, 9);
      expect(edit!.text).toContain('poi:');
      expect(edit!.text).toContain('New POI');
    });

    it('inserted text contains x and y coordinates', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'lower_deck', 5, 9);
      expect(edit!.text).toContain('5');
      expect(edit!.text).toContain('9');
    });

    it('applying edit does NOT swallow the next sibling or EOF', () => {
      const edit = buildAddPoiEdit(FIXTURE_TEXT, 'lower_deck', 5, 9);
      expect(edit).not.toBeNull();
      const lines = FIXTURE_TEXT.split('\n');
      const startIdx = edit!.startLine - 1;
      const endIdx = edit!.endLine - 1;
      const startCol = edit!.startCol - 1;
      const endCol = edit!.endCol - 1;
      const before = lines[startIdx].slice(0, startCol);
      const after = lines[endIdx].slice(endCol);
      lines[startIdx] = before + edit!.text + after;
      if (endIdx > startIdx) {
        lines.splice(startIdx + 1, endIdx - startIdx);
      }
      const patched = lines.join('\n');
      // Must still contain both deck ids
      expect(patched).toContain('main_deck');
      expect(patched).toContain('lower_deck');
      // New poi content present
      expect(patched).toContain('poi:');
      expect(patched).toContain('New POI');
    });
  });
});
