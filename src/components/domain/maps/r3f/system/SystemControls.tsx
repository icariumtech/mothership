/**
 * SystemControls - Camera controls for system view
 *
 * Implements drag-to-rotate and scroll-to-zoom without using OrbitControls.
 * Can orbit around either the star (origin) or a selected planet.
 *
 * Features:
 * - Spherical rotation around target point
 * - Smooth zoom with dynamic limits based on selection
 * - Touch support for mobile
 * - Ignores interactions on UI panels
 */

import { useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../hooks/useSceneStore';

// Zoom limits
const MIN_ZOOM_DEFAULT = 60;
const MAX_ZOOM_DEFAULT = 300;
const MIN_ZOOM_SELECTED = 5;
const MAX_ZOOM_SELECTED = 100;
const ZOOM_SPEED = 0.05;
const ROTATE_SPEED = 0.003;

interface SystemControlsProps {
  /** Whether controls are enabled */
  enabled?: boolean;
  /** Static target position (star or selected planet position) - used if getTarget not provided */
  target?: THREE.Vector3;
  /** Dynamic target getter - called to get current position for moving objects */
  getTarget?: () => THREE.Vector3 | null;
  /** Whether a planet is currently selected */
  hasSelection?: boolean;
  /** Callback when camera position changes */
  onCameraChange?: (position: THREE.Vector3, target: THREE.Vector3) => void;
}

export function SystemControls({
  enabled = true,
  target,
  getTarget,
  hasSelection = false,
  onCameraChange,
}: SystemControlsProps) {
  const { camera, gl } = useThree();
  const domElement = gl.domElement;

  const recordInteraction = useSceneStore((state) => state.recordInteraction);
  const updateCamera = useSceneStore((state) => state.updateCamera);

  // Control state refs
  const isDragging = useRef(false);
  const isTouching = useRef(false);
  const previousPosition = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef(0);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const getTargetRef = useRef(getTarget);

  // Keep getTarget ref updated
  useEffect(() => {
    getTargetRef.current = getTarget;
  }, [getTarget]);

  // Update target ref when prop changes (fallback for static target)
  useEffect(() => {
    if (target) {
      targetRef.current.copy(target);
    } else {
      targetRef.current.set(0, 0, 0);
    }
  }, [target]);

  // Get current target position (dynamic or static)
  const getCurrentTarget = useCallback((): THREE.Vector3 => {
    if (getTargetRef.current) {
      const dynamicTarget = getTargetRef.current();
      if (dynamicTarget) {
        targetRef.current.copy(dynamicTarget);
        return targetRef.current;
      }
      // If getTarget exists but returns null (deselected), reset to origin
      targetRef.current.set(0, 0, 0);
    }
    return targetRef.current;
  }, []);

  // Check if event target is a UI panel
  const isPanelEvent = useCallback((eventTarget: EventTarget | null): boolean => {
    if (!eventTarget || !(eventTarget instanceof HTMLElement)) return false;
    return !!eventTarget.closest(
      '.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .system-info-panel, .star-system-row'
    );
  }, []);

  // Check if event target is a button
  const isButtonEvent = useCallback((eventTarget: EventTarget | null): boolean => {
    if (!eventTarget || !(eventTarget instanceof HTMLElement)) return false;
    return !!eventTarget.closest('button, .system-map-btn-container');
  }, []);

  // Rotate camera around target
  const rotateCamera = useCallback(
    (deltaX: number, deltaY: number) => {
      const currentTarget = getCurrentTarget();
      const offset = camera.position.clone().sub(currentTarget);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(offset.y / radius);

      theta -= deltaX * ROTATE_SPEED;
      phi -= deltaY * ROTATE_SPEED;

      // Clamp phi to avoid flipping
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      camera.position.copy(currentTarget).add(offset);
      camera.lookAt(currentTarget);

      updateCamera(
        [camera.position.x, camera.position.y, camera.position.z],
        [currentTarget.x, currentTarget.y, currentTarget.z]
      );

      onCameraChange?.(camera.position, currentTarget);
    },
    [camera, getCurrentTarget, updateCamera, onCameraChange]
  );

  // Zoom camera
  const zoomCamera = useCallback(
    (delta: number) => {
      const minDistance = hasSelection ? MIN_ZOOM_SELECTED : MIN_ZOOM_DEFAULT;
      const maxDistance = hasSelection ? MAX_ZOOM_SELECTED : MAX_ZOOM_DEFAULT;

      const currentTarget = getCurrentTarget();
      const offset = camera.position.clone().sub(currentTarget);
      let distance = offset.length();

      if (delta > 0) {
        distance *= (1 + ZOOM_SPEED);
      } else {
        distance *= (1 - ZOOM_SPEED);
      }

      distance = Math.max(minDistance, Math.min(maxDistance, distance));
      offset.normalize().multiplyScalar(distance);
      camera.position.copy(currentTarget).add(offset);

      updateCamera(
        [camera.position.x, camera.position.y, camera.position.z],
        [currentTarget.x, currentTarget.y, currentTarget.z]
      );

      onCameraChange?.(camera.position, currentTarget);
    },
    [camera, getCurrentTarget, hasSelection, updateCamera, onCameraChange]
  );

  // Mouse wheel handler
  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (event: WheelEvent) => {
      if (isPanelEvent(event.target)) return;

      event.preventDefault();
      recordInteraction();
      zoomCamera(event.deltaY);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [enabled, isPanelEvent, recordInteraction, zoomCamera]);

  // Mouse drag handlers
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (isPanelEvent(event.target) || isButtonEvent(event.target)) return;

      isDragging.current = true;
      recordInteraction();
      previousPosition.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = event.clientX - previousPosition.current.x;
      const deltaY = event.clientY - previousPosition.current.y;

      rotateCamera(deltaX, deltaY);

      previousPosition.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseLeave = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled, domElement, isPanelEvent, isButtonEvent, recordInteraction, rotateCamera]);

  // Touch handlers
  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touchTarget = event.touches[0].target;
        if (isPanelEvent(touchTarget) || isButtonEvent(touchTarget)) return;

        isTouching.current = true;
        recordInteraction();
        previousPosition.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      } else if (event.touches.length === 2) {
        if (isPanelEvent(event.touches[0].target)) return;

        lastTouchDistance.current = Math.hypot(
          event.touches[1].clientX - event.touches[0].clientX,
          event.touches[1].clientY - event.touches[0].clientY
        );
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isTouching.current && event.touches.length === 1) {
        const touchTarget = event.touches[0].target;
        if (isPanelEvent(touchTarget)) {
          isTouching.current = false;
          return;
        }

        event.preventDefault();

        const touch = event.touches[0];
        const deltaX = touch.clientX - previousPosition.current.x;
        const deltaY = touch.clientY - previousPosition.current.y;

        rotateCamera(deltaX, deltaY);

        previousPosition.current = { x: touch.clientX, y: touch.clientY };
      } else if (event.touches.length === 2) {
        if (isPanelEvent(event.touches[0].target)) return;

        event.preventDefault();
        recordInteraction();

        const distance = Math.hypot(
          event.touches[1].clientX - event.touches[0].clientX,
          event.touches[1].clientY - event.touches[0].clientY
        );

        const delta = lastTouchDistance.current - distance;
        lastTouchDistance.current = distance;

        zoomCamera(delta);
      }
    };

    const handleTouchEnd = () => {
      isTouching.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isPanelEvent, isButtonEvent, recordInteraction, rotateCamera, zoomCamera]);

  // This component doesn't render anything
  return null;
}
