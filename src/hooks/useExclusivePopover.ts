import { useState, useCallback } from 'react';

/**
 * Manages an exclusive single-popover state for components that display
 * mutually-exclusive overlay slots (tooltips, context menus, status panels, etc.).
 *
 * At most one popover is open at a time. Opening any value replaces the prior
 * one — exclusivity is structural, enforced by a single `useState<T | null>`.
 * The caller defines its own discriminated union as the type parameter `T`;
 * this hook owns no domain knowledge and imports no encounter or UI types.
 *
 * Returns `{ popover, open, close }`. Consumers can derive `isOpen` from
 * `popover !== null` — no separate boolean is provided.
 *
 * @example
 *   type MyPopover =
 *     | { type: 'tooltip'; payload: { id: string } }
 *     | { type: 'menu';    payload: { x: number; y: number } }
 *   const { popover, open: openPopover, close: closePopover } =
 *     useExclusivePopover<MyPopover>();
 */
export function useExclusivePopover<T>() {
  const [popover, setPopover] = useState<T | null>(null);

  const open = useCallback((value: T) => {
    setPopover(value);
  }, []);

  const close = useCallback(() => {
    setPopover(null);
  }, []);

  return { popover, open, close };
}
