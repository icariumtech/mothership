/**
 * SVG Coordinate Transform Utilities
 *
 * Provides functions for converting between screen coordinates (mouse/touch events)
 * and SVG coordinate space, accounting for viewBox scaling, pan, and zoom.
 */

/**
 * Convert screen coordinates (clientX, clientY) to SVG coordinate space.
 *
 * Handles SVG viewBox transformations, scaling, panning, and zoom correctly
 * by using the SVG element's screen CTM (Current Transformation Matrix).
 *
 * @param svgElement - The SVG element to get the transformation from
 * @param screenX - Screen X coordinate (e.g., from mouse event clientX)
 * @param screenY - Screen Y coordinate (e.g., from mouse event clientY)
 * @returns SVG coordinates { x, y } in the SVG's coordinate space
 */
export function screenToSVG(
  svgElement: SVGSVGElement,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  // Create a DOMPoint from screen coordinates
  const point = svgElement.createSVGPoint();
  point.x = screenX;
  point.y = screenY;

  // Get the SVG element's screen CTM (Current Transformation Matrix)
  const ctm = svgElement.getScreenCTM();

  // If CTM is null (rare edge case), fall back to getBoundingClientRect
  if (!ctm) {
    const rect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox.baseVal;

    // Calculate scale factors
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    // Convert to SVG coordinates
    return {
      x: (screenX - rect.left) * scaleX + viewBox.x,
      y: (screenY - rect.top) * scaleY + viewBox.y,
    };
  }

  // Invert the CTM and apply to the point to get SVG coordinates
  const svgPoint = point.matrixTransform(ctm.inverse());

  return {
    x: svgPoint.x,
    y: svgPoint.y,
  };
}

/**
 * Snap continuous SVG coordinates to discrete grid cell indices.
 *
 * Converts floating-point SVG coordinates to integer grid cell coordinates.
 *
 * @param svgX - SVG X coordinate (continuous)
 * @param svgY - SVG Y coordinate (continuous)
 * @param unitSize - Size of each grid cell (e.g., 40)
 * @returns Grid cell indices { gridX, gridY }
 */
export function snapToGrid(
  svgX: number,
  svgY: number,
  unitSize: number
): { gridX: number; gridY: number } {
  return {
    gridX: Math.floor(svgX / unitSize),
    gridY: Math.floor(svgY / unitSize),
  };
}

/**
 * Rotate a point around a center by angleDeg degrees.
 * Used to convert original grid-space SVG coords into the rotated viewBox space
 * when the map has a fixed authored rotation (e.g. for popup positioning).
 */
export function rotatePoint(
  x: number, y: number,
  angleDeg: number,
  cx: number, cy: number
): { x: number; y: number } {
  if (angleDeg === 0) return { x, y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Inverse-rotate a point around a center by -angleDeg degrees.
 * Used to convert rotated-viewBox SVG coords back to original grid space
 * when the map has a fixed authored rotation (mapData.rotation).
 */
export function inverseRotatePoint(
  x: number, y: number,
  angleDeg: number,
  cx: number, cy: number
): { x: number; y: number } {
  if (angleDeg === 0) return { x, y };
  const rad = (-angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Convenience function: Convert screen coordinates to grid cell indices.
 *
 * Combines screenToSVG and snapToGrid in one call.
 * Pass mapRotation/mapCenterX/mapCenterY when the map has a fixed authored rotation
 * (mapData.rotation) so that the inner <g> rotation is undone before grid-snapping.
 *
 * @param svgElement - The SVG element to get the transformation from
 * @param screenX - Screen X coordinate (e.g., from mouse event clientX)
 * @param screenY - Screen Y coordinate (e.g., from mouse event clientY)
 * @param unitSize - Size of each grid cell (e.g., 40)
 * @param mapRotation - Fixed map rotation in degrees (default 0)
 * @param mapCenterX - SVG-space X of map center (used for inverse rotation)
 * @param mapCenterY - SVG-space Y of map center
 * @returns Grid cell indices { gridX, gridY }
 */
export function getGridCell(
  svgElement: SVGSVGElement,
  screenX: number,
  screenY: number,
  unitSize: number,
  mapRotation = 0,
  mapCenterX = 0,
  mapCenterY = 0,
): { gridX: number; gridY: number } {
  const svgCoords = screenToSVG(svgElement, screenX, screenY);
  const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
  return snapToGrid(unrotated.x, unrotated.y, unitSize);
}
