/**
 * MapLabel - Camera-facing name label for map bodies
 *
 * A small billboarded text label used to annotate stars, planets, moons,
 * stations, and surface markers across the galaxy / system / orbit views.
 * Place it as a child of the body's moving group so the label tracks the
 * body's position. The label scales with zoom like the rest of the scene.
 */

import { Billboard, Text } from '@react-three/drei';

/** Amber theme color — matches the galaxy star-system labels. */
const DEFAULT_LABEL_COLOR = '#c9a050';

interface MapLabelProps {
  /** Text to display */
  text: string;
  /** Billboard offset from the parent's origin, in world units. */
  offset?: [number, number, number];
  /** Text color (defaults to amber). */
  color?: string;
  /** World-unit font size. */
  fontSize?: number;
  /** Horizontal text anchor relative to the offset point. */
  anchorX?: 'left' | 'center' | 'right';
  /** Vertical text anchor relative to the offset point. */
  anchorY?: 'top' | 'middle' | 'bottom';
}

export function MapLabel({
  text,
  offset = [0, 0, 0],
  color = DEFAULT_LABEL_COLOR,
  fontSize = 2.2,
  anchorX = 'left',
  anchorY = 'middle',
}: MapLabelProps) {
  return (
    <Billboard position={offset}>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX={anchorX}
        anchorY={anchorY}
        // Outline width as a percentage of fontSize so it scales with the label.
        outlineWidth="5%"
        outlineColor="#000000"
        outlineOpacity={0.7}
        // Render on top of additive sprites so it stays readable
        renderOrder={1}
      >
        {text}
      </Text>
    </Billboard>
  );
}
