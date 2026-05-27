/**
 * ViewOffset - Shifts rendered scene content vertically without tilting
 *
 * Uses the perspective camera's view offset (the same mechanism three.js uses
 * for multi-monitor tiling) to slide the projection's principal point. A
 * positive `shiftY` slides the frustum down, which makes scene content appear
 * to move *up* on screen — keeping the full-bleed starfield while re-centering
 * the focal point between the top bar and the navigation bar.
 *
 * Drop this inside a <Canvas>. It re-applies on resize and clears on unmount.
 */

import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ViewOffsetProps {
  /** Pixels to shift scene content upward (0 = no shift). */
  shiftY?: number;
}

export function ViewOffset({ shiftY = 0 }: ViewOffsetProps) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;

    if (!shiftY || width === 0 || height === 0) {
      cam.clearViewOffset();
    } else {
      // full == actual size, window offset by shiftY → pixel-accurate vertical shift.
      cam.setViewOffset(width, height, 0, shiftY, width, height);
    }
    cam.updateProjectionMatrix();
    invalidate(); // re-render in case the frameloop is on demand

    return () => {
      if (cam.isPerspectiveCamera) {
        cam.clearViewOffset();
        cam.updateProjectionMatrix();
      }
    };
  }, [camera, width, height, shiftY, invalidate]);

  return null;
}
