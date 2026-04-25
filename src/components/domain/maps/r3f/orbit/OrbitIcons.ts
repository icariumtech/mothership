/**
 * OrbitIcons — loads SVG icon files for use in Three.js canvas textures.
 * Maps station icon_type strings to full SVG strings with amber coloring.
 *
 * Icons: Mothership RPG Map Icons by László Varga (MIT License)
 * See: THIRD_PARTY_LICENSES, src/assets/icons/LICENSE
 */

const _raw = import.meta.glob('../../../../../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function extractName(filePath: string): string {
  const filename = filePath.split('/').pop() ?? '';
  return filename.replace(/ - Light - 64x64\.svg$/i, '').toLowerCase();
}

const _svgByName: Record<string, string> = Object.fromEntries(
  Object.entries(_raw).map(([path, raw]) => [extractName(path), raw])
);

/** Map icon_type / marker_type values to asset names */
const ICON_TYPE_MAP: Record<string, string> = {
  ship: 'space ship',
  station: 'space station',
  refinery: 'refinery',
  factory: 'factory',
  colony: 'space colony',
};

/**
 * Returns an SVG string for the given icon_type with colors replaced for
 * canvas rendering (white → amber), or null if the type is unknown.
 */
export function getOrbitIconSvg(iconType: string): string | null {
  const name = ICON_TYPE_MAP[iconType.toLowerCase()];
  if (!name) return null;
  const svg = _svgByName[name];
  if (!svg) return null;
  return svg
    .replace(/fill="white"/g, 'fill="#8b7355"')
    .replace(/stroke="white"/g, 'stroke="#8b7355"');
}
