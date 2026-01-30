import { useRef, useCallback } from 'react';

/**
 * Hook to debounce function calls
 * Prevents rapid-fire execution by enforcing minimum time between calls
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T {
  const lastCallTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  return useCallback(
    ((...args: unknown[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTimeRef.current;

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // If enough time has passed, execute immediately
      if (timeSinceLastCall >= delay) {
        lastCallTimeRef.current = now;
        return func(...args);
      }

      // Otherwise, schedule for later
      return new Promise((resolve) => {
        timeoutRef.current = window.setTimeout(() => {
          lastCallTimeRef.current = Date.now();
          resolve(func(...args));
        }, delay - timeSinceLastCall);
      });
    }) as T,
    [func, delay]
  );
}

/**
 * Hook to prevent rapid-fire calls with a guard flag
 * Returns [guardedFunc, isActive] where isActive prevents concurrent calls
 */
export function useTransitionGuard<T extends (...args: any[]) => Promise<any>>(
  func: T,
  minDelay: number = 300
): [T, () => boolean] {
  const isActiveRef = useRef(false);
  const lastCompleteTimeRef = useRef<number>(0);

  const guardedFunc = useCallback(
    (async (...args: any[]) => {
      const now = Date.now();
      const timeSinceLastComplete = now - lastCompleteTimeRef.current;

      // Reject if another transition is in progress
      if (isActiveRef.current) {
        console.warn('Transition already in progress, ignoring call');
        return;
      }

      // Reject if called too soon after last completion
      if (timeSinceLastComplete < minDelay) {
        console.warn(`Transition called too soon (${timeSinceLastComplete}ms < ${minDelay}ms), ignoring`);
        return;
      }

      isActiveRef.current = true;
      try {
        return await func(...args);
      } finally {
        isActiveRef.current = false;
        lastCompleteTimeRef.current = Date.now();
      }
    }) as T,
    [func, minDelay]
  );

  const isActive = useCallback(() => isActiveRef.current, []);

  return [guardedFunc, isActive];
}
