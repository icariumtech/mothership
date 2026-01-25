/**
 * GalaxyControls - Custom camera controls for galaxy view
 *
 * Implements drag-to-rotate and scroll-to-zoom without using OrbitControls.
 * Integrates with Zustand store for auto-rotate and interaction tracking.
 *
 * Features:
 * - Spherical rotation around target point
 * - Smooth zoom with min/max limits
 * - Auto-rotate resume after idle
 * - Touch support for mobile
 * - Ignores interactions on UI panels
 */

import { useCallback, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, useAnimationState } from '../hooks/useSceneStore';

interface GalaxyControlsProps {
  /** Whether controls are enabled */
  enabled?: boolean;
  /** Rotation speed multiplier */
  rotateSpeed?: number;
  /** Zoom speed */
  zoomSpeed?: number;
  /** Minimum zoom distance */
  minDistance?: number;
  /** Maximum zoom distance */
  maxDistance?: number;
  /** Auto-rotation speed (radians per frame) */
  autoRotateSpeed?: number;
  /** Time to wait before resuming auto-rotate (ms) */
  autoRotateResumeDelay?: number;
}

export function GalaxyControls({
  enabled = true,
  rotateSpeed = 0.003,
  zoomSpeed = 4,
  minDistance = 20,
  maxDistance = 300,
  autoRotateSpeed = 0.002,
  autoRotateResumeDelay = 5000,
}: GalaxyControlsProps) {
  const { camera, gl } = useThree();
  const domElement = gl.domElement;

  const animations = useAnimationState();
  const recordInteraction = useSceneStore((state) => state.recordInteraction);
  const setAutoRotate = useSceneStore((state) => state.setAutoRotate);
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const lastInteractionTime = useSceneStore((state) => state.lastInteractionTime);
  // Read the animated target from store (updated by useGalaxyCamera during animation)
  const cameraTarget = useSceneStore((state) => state.camera.target);

  // Control state refs
  const isDragging = useRef(false);
  const isTouching = useRef(false);
  const previousPosition = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef(0);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  // Sync target from store (animated value) each frame
  useFrame(() => {
    targetRef.current.set(cameraTarget[0], cameraTarget[1], cameraTarget[2]);
  });

  // Check if event target is a UI panel
  const isPanelEvent = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return !!target.closest(
      '.panel-base, .panel-wrapper, .panel-content, .dashboard-panel-content, .info-panel, .star-system-row'
    );
  }, []);

  // Check if event target is a button
  const isButtonEvent = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return !!target.closest('button, .system-map-btn-container');
  }, []);

  // Rotate camera around target
  const rotateCamera = useCallback(
    (deltaX: number, deltaY: number) => {
      const offset = camera.position.clone().sub(targetRef.current);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(offset.y / radius);

      theta -= deltaX * rotateSpeed;
      phi -= deltaY * rotateSpeed;

      // Clamp phi to avoid flipping
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      camera.position.copy(targetRef.current).add(offset);
      camera.lookAt(targetRef.current);

      updateCamera(
        [camera.position.x, camera.position.y, camera.position.z],
        [targetRef.current.x, targetRef.current.y, targetRef.current.z]
      );
    },
    [camera, rotateSpeed, updateCamera]
  );

  // Zoom camera
  const zoomCamera = useCallback(
    (delta: number) => {
      const direction = targetRef.current.clone().sub(camera.position).normalize();
      const currentDistance = camera.position.distanceTo(targetRef.current);

      if (delta < 0) {
        // Zoom in
        if (currentDistance - zoomSpeed >= minDistance) {
          camera.position.add(direction.multiplyScalar(zoomSpeed));
        }
      } else {
        // Zoom out
        if (currentDistance + zoomSpeed <= maxDistance) {
          camera.position.add(direction.multiplyScalar(-zoomSpeed));
        }
      }

      updateCamera(
        [camera.position.x, camera.position.y, camera.position.z],
        [targetRef.current.x, targetRef.current.y, targetRef.current.z]
      );
    },
    [camera, zoomSpeed, minDistance, maxDistance, updateCamera]
  );

  // Mouse wheel handler
  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (event: WheelEvent) => {
      if (isPanelEvent(event.target)) return;

      event.preventDefault();
      setAutoRotate(false);
      recordInteraction();

      zoomCamera(event.deltaY);
    };

    domElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => domElement.removeEventListener('wheel', handleWheel);
  }, [enabled, domElement, isPanelEvent, setAutoRotate, recordInteraction, zoomCamera]);

  // Mouse drag handlers
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (isPanelEvent(event.target)) return;

      isDragging.current = true;
      setAutoRotate(false);
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

    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled, domElement, isPanelEvent, setAutoRotate, recordInteraction, rotateCamera]);

  // Touch handlers
  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const target = event.touches[0].target;
        if (isPanelEvent(target) || isButtonEvent(target)) return;

        isTouching.current = true;
        setAutoRotate(false);
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
        const target = event.touches[0].target;
        if (isPanelEvent(target)) {
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
        setAutoRotate(false);
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

    domElement.addEventListener('touchstart', handleTouchStart);
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handleTouchEnd);

    return () => {
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    enabled,
    domElement,
    isPanelEvent,
    isButtonEvent,
    setAutoRotate,
    recordInteraction,
    rotateCamera,
    zoomCamera,
  ]);

  // Auto-rotate animation
  useFrame(() => {
    if (!enabled || animations.paused) return;

    // Check for auto-rotate resume
    if (!animations.autoRotate && lastInteractionTime) {
      const timeSinceInteraction = Date.now() - lastInteractionTime;
      if (timeSinceInteraction >= autoRotateResumeDelay) {
        setAutoRotate(true);
      }
    }

    // Perform auto-rotation
    if (animations.autoRotate && !isDragging.current && !isTouching.current) {
      const offset = camera.position.clone().sub(targetRef.current);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      theta += autoRotateSpeed;

      const phi = Math.acos(offset.y / radius);
      const sinPhi = Math.sin(phi);

      camera.position.x = targetRef.current.x + radius * sinPhi * Math.sin(theta);
      camera.position.y = targetRef.current.y + radius * Math.cos(phi);
      camera.position.z = targetRef.current.z + radius * sinPhi * Math.cos(theta);

      camera.lookAt(targetRef.current);
    }
  });

  // This component doesn't render anything
  return null;
}
