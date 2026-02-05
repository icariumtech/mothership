/**
 * Transition Coordinator Utility
 *
 * Provides helper functions and timing constants for coordinating
 * camera transitions, fade effects, and state management across
 * Galaxy, System, and Orbit map views.
 */

import { useSceneStore } from '@/stores/sceneStore';

/**
 * Timing constants for transitions (in milliseconds)
 */
export const TRANSITION_TIMING = {
  /** Duration for camera movement animations */
  CAMERA_MOVE_TIME: 2000,

  /** Maximum time to wait for typewriter completion */
  TYPEWRITER_MAX_WAIT: 3000,

  /** Duration for pre-transition zoom into element */
  ZOOM_INTO_TIME: 2000,

  /** Duration for fade out/in effects */
  FADE_TIME: 1200,

  /** Short delay to ensure React has rendered new view */
  VIEW_RENDER_DELAY: 100,

  /** Fade out duration before view switch */
  FADE_OUT_TIME: 500,
} as const;

/**
 * Wait for a camera animation to complete
 *
 * @param duration - Duration to wait in milliseconds
 * @returns Promise that resolves after the duration
 */
export async function waitForCameraAnimation(duration: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Wait for the typewriter animation to complete
 *
 * Polls the Zustand store to check if typewriter is active,
 * and resolves when it completes or timeout is reached.
 *
 * @param maxWaitTime - Maximum time to wait in milliseconds (default: 3000)
 * @returns Promise that resolves when typewriter completes or times out
 */
export async function waitForTypewriter(maxWaitTime: number = TRANSITION_TIMING.TYPEWRITER_MAX_WAIT): Promise<void> {
  const startTime = Date.now();

  return new Promise<void>((resolve) => {
    const checkTypewriter = () => {
      const state = useSceneStore.getState();
      const elapsed = Date.now() - startTime;

      if (!state.typewriter.active || elapsed >= maxWaitTime) {
        if (elapsed >= maxWaitTime && state.typewriter.active) {
          console.warn('[Transition] Typewriter timeout - proceeding anyway');
        }
        resolve();
      } else {
        requestAnimationFrame(checkTypewriter);
      }
    };

    // Start checking after a small delay to ensure typewriter has started
    setTimeout(() => requestAnimationFrame(checkTypewriter), 100);
  });
}

/**
 * Create a transition lock wrapper to prevent concurrent transitions
 *
 * @param lockRef - React ref to store lock state
 * @param fn - Async function to wrap with lock
 * @returns Wrapped function that checks lock before executing
 */
export function withTransitionLock(
  lockRef: React.MutableRefObject<boolean>,
  fn: () => Promise<void>
): () => Promise<void> {
  return async () => {
    if (lockRef.current) {
      console.warn('[Transition] Transition already in progress, ignoring');
      return;
    }

    lockRef.current = true;
    try {
      await fn();
    } catch (error) {
      console.error('[Transition] Error during transition:', error);
    } finally {
      lockRef.current = false;
    }
  };
}

/**
 * Wait for React to render the new view before proceeding
 *
 * @param delay - Delay in milliseconds (default: 100)
 * @returns Promise that resolves after the delay
 */
export async function waitForViewRender(delay: number = TRANSITION_TIMING.VIEW_RENDER_DELAY): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Sequence helper for drill down transitions
 *
 * This provides a standardized sequence for drilling down from one view to another:
 * 1. Ensure element is selected (with camera animation + typewriter)
 * 2. Zoom into element from current position (2 seconds)
 * 3. Fade out current view
 * 4. Switch to next view
 * 5. Fade in next view while zooming in from distance
 * 6. Reset transition states
 */
export interface DrillDownSequenceParams {
  /** Current selection state */
  currentSelection: string | null;

  /** Target element to drill into */
  targetElement: string;

  /** Function to select the element (triggers camera + typewriter) */
  selectElement: (element: string) => void;

  /** Function to zoom into element from current position */
  zoomIntoElement: () => Promise<void>;

  /** Function to set current view transition state */
  setCurrentTransition: (state: 'idle' | 'transitioning-out' | 'transitioning-in') => void;

  /** Function to set next view transition state */
  setNextTransition: (state: 'idle' | 'transitioning-out' | 'transitioning-in') => void;

  /** Function to switch view mode */
  switchView: () => void;

  /** Function to animate zoom in on new view */
  zoomInNewView: () => Promise<void>;
}

/**
 * Execute a standardized drill down sequence
 */
export async function executeDrillDownSequence(params: DrillDownSequenceParams): Promise<void> {
  const {
    currentSelection,
    targetElement,
    selectElement,
    zoomIntoElement,
    setCurrentTransition,
    setNextTransition,
    switchView,
    zoomInNewView,
  } = params;

  // Phase 1: Ensure element is selected
  if (currentSelection !== targetElement) {
    console.log('[Transition] Selecting element:', targetElement);
    selectElement(targetElement);

    // Wait for camera animation
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    await waitForCameraAnimation(TRANSITION_TIMING.CAMERA_MOVE_TIME);

    // Wait for typewriter
    await waitForTypewriter();
  }

  // Phase 2: Zoom into element from current position
  console.log('[Transition] Zooming into element');
  await zoomIntoElement();

  // Phase 3: Fade out current view
  console.log('[Transition] Fading out current view');
  setCurrentTransition('transitioning-out');
  await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_OUT_TIME));

  // Phase 4: Switch to next view
  console.log('[Transition] Switching to next view');
  switchView();
  setNextTransition('transitioning-in');

  // Phase 5: Zoom in on new view
  await zoomInNewView();

  // Phase 6: Reset transition states
  setCurrentTransition('idle');
  setNextTransition('idle');
  console.log('[Transition] Drill down complete');
}

/**
 * Sequence helper for back navigation transitions
 */
export interface BackNavigationSequenceParams {
  /** Function to zoom out from current view */
  zoomOutCurrent: () => Promise<void>;

  /** Function to set current view transition state */
  setCurrentTransition: (state: 'idle' | 'transitioning-out' | 'transitioning-in') => void;

  /** Function to set previous view transition state */
  setPreviousTransition: (state: 'idle' | 'transitioning-out' | 'transitioning-in') => void;

  /** Function to switch back to previous view */
  switchView: () => void;

  /** Function to position camera on previously selected element */
  positionCamera: () => void;

  /** Function to clean up state */
  cleanupState: () => void;
}

/**
 * Execute a standardized back navigation sequence
 */
export async function executeBackNavigationSequence(params: BackNavigationSequenceParams): Promise<void> {
  const {
    zoomOutCurrent,
    setCurrentTransition,
    setPreviousTransition,
    switchView,
    positionCamera,
    cleanupState,
  } = params;

  // Phase 1: Zoom out and fade out current view
  console.log('[Transition] Zooming out from current view');
  setCurrentTransition('transitioning-out');
  await zoomOutCurrent();

  // Phase 2: Switch to previous view
  console.log('[Transition] Switching to previous view');
  switchView();
  setPreviousTransition('transitioning-in');

  // Phase 3: Wait for React to render previous view
  await waitForViewRender();

  // Phase 4: Position camera on previously selected element
  console.log('[Transition] Positioning camera');
  positionCamera();

  // Phase 5: Wait for fade in
  await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_TIME));

  // Phase 6: Reset states and cleanup
  setCurrentTransition('idle');
  setPreviousTransition('idle');
  cleanupState();
  console.log('[Transition] Back navigation complete');
}
