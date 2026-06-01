/**
 * EncounterIcons — bulk-imports SVG icon files as raw strings at build time,
 * strips the <svg> wrapper, and replaces hardcoded white colors with currentColor
 * so icons can be colorized by setting `color` CSS property on the parent element.
 *
 * Icons: Mothership RPG Map Icons by László Varga (MIT License)
 * See: THIRD_PARTY_LICENSES, src/assets/icons/LICENSE
 */

// Bulk import all light-variant SVGs as raw strings (Vite built-in ?raw feature)
const _raw = import.meta.glob('../../../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Strip outer <svg> tag and replace white (any form) with currentColor */
function processIconSvg(raw: string): string {
  return raw
    .replace(/<svg[^>]*>/s, '')
    .replace(/<\/svg>/g, '')
    // Attribute form: fill/stroke="white" or fill/stroke="#fff[fff]"
    .replace(/fill="white"/g, 'fill="currentColor"')
    .replace(/stroke="white"/g, 'stroke="currentColor"')
    .replace(/fill="#[Ff]{3,6}"/g, 'fill="currentColor"')
    .replace(/stroke="#[Ff]{3,6}"/g, 'stroke="currentColor"')
    // Inline style form (Inkscape output): fill:#fff[fff] or stroke:#fff[fff]
    .replace(/fill:#[Ff]{3,6}/g, 'fill:currentColor')
    .replace(/stroke:#[Ff]{3,6}/g, 'stroke:currentColor')
    .trim();
}

/** Extract icon name from path: "…/Reactor core - Light - 64x64.svg" → "reactor core" */
function extractName(filePath: string): string {
  const filename = filePath.split('/').pop() ?? '';
  return filename.replace(/ - Light - 64x64\.svg$/i, '').toLowerCase();
}

/**
 * Map of icon name → processed SVG inner content (paths/rects, colors replaced with currentColor).
 * All icons use viewBox="0 0 64 64".
 *
 * Example names: "medbay", "reactor core", "cargo", "airlock", "emergency capsule", etc.
 */
export const ENCOUNTER_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(_raw).map(([path, raw]) => [extractName(path), processIconSvg(raw)])
);

/** Slugify an icon name for use as an SVG symbol ID: "reactor core" → "reactor-core" */
export function iconSlug(name: string): string {
  return name.replace(/\s+/g, '-');
}

/** Symbol ID used in <defs> for a given icon name */
export function iconSymbolId(name: string): string {
  return `map-icon-${iconSlug(name)}`;
}
