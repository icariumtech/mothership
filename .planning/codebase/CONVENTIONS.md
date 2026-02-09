# Coding Conventions

**Analysis Date:** 2026-02-09

## Naming Patterns

### Files

**TypeScript/React:**
- Components: PascalCase with .tsx extension (e.g., `BridgeView.tsx`, `GalaxyScene.tsx`)
- Utilities and services: camelCase with .ts extension (e.g., `transitionCoordinator.ts`, `messageApi.ts`)
- Hooks: camelCase with 'use' prefix (e.g., `useDebounce.ts`, `useSceneStore.ts`)
- Type files: camelCase for specific domains (e.g., `starMap.ts`, `systemMap.ts`, `orbitMap.ts`)
- Store files: camelCase (e.g., `sceneStore.ts`)

**Python:**
- Modules: snake_case (e.g., `data_loader.py`, `models.py`)
- Classes: PascalCase (e.g., `DataLoader`, `ActiveView`)

**CSS:**
- Files: camelCase or kebab-case with .css extension (e.g., `BridgeView.css`, `TabBar.css`)

### Functions

**TypeScript/React:**
- Regular functions: camelCase (e.g., `getMessages()`, `extractTextContent()`)
- React components: PascalCase (e.g., `BridgeView()`, `GalaxyScene()`)
- Helper utilities: camelCase with descriptive verb (e.g., `buildSystemInfoHTML()`, `waitForTypewriter()`, `computeTypewriterContent()`)
- Event handlers: camelCase with 'handle' prefix (e.g., `handleClick()`, `handleNavigation()`)
- API methods: camelCase with 'get'/'fetch'/'load' prefix (e.g., `getMessages()`, `loadStarMap()`)

**Python:**
- Methods: snake_case (e.g., `load_all_locations()`, `load_location_recursive()`)
- Private methods: Leading underscore (e.g., `_get_location_path()`)
- Class methods: snake_case (e.g., `get_current()` on Django model)

### Variables

**TypeScript/React:**
- State variables: camelCase (e.g., `selectedSystem`, `starMapData`, `activeView`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `TRANSITION_TIMING`, `CAMERA_MOVE_TIME`)
- Boolean variables: Often prefixed with 'is' or 'has' (e.g., `isActive`, `hasSystemMap`, `charonDialogOpen`)
- Refs: Suffix with 'Ref' (e.g., `lastCallTimeRef`, `timeoutRef`, `meshRef`)
- Map/Set variables: Describe collection content (e.g., `starPositions`, `encounterRoomVisibility`)

**Python:**
- Variables: snake_case (e.g., `location_data`, `location_slug`, `manifest_file`)
- Constants: UPPER_SNAKE_CASE (e.g., `VIEW_TYPE_CHOICES`)

### Types and Interfaces

**TypeScript:**
- Interfaces: PascalCase (e.g., `StarSystem`, `BridgeViewProps`, `SceneState`)
- Type aliases: PascalCase (e.g., `MapViewMode`, `TransitionState`, `ViewType`)
- Discriminated union types: Describe variants clearly (e.g., `type DoorStatus = 'OPEN' | 'CLOSED' | 'LOCKED'`)
- Props interfaces: Component name + 'Props' suffix (e.g., `BridgeViewProps`, `StarMapPanelProps`)
- Callback interface fields: 'on' + event name (e.g., `onSystemClick`, `onTabChange`, `onHeaderClick`)

## Code Style

### Formatting

**Formatter:** TypeScript files use implicit formatting (strict tsconfig enforces type checking)

**Key tsconfig settings:**
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "jsx": "react-jsx"
}
```

**Style practices:**
- Line length: Not enforced, but keep reasonable (~100-120 characters is typical)
- Indentation: 2 spaces for JavaScript/TypeScript
- Semicolons: Preferred (enforced by TypeScript strict mode)
- Quotes: Single quotes in strings, double quotes where needed
- Trailing commas: Used in multi-line objects/arrays

### Python Formatting

**Linter:** Ruff (configured via Django project)

**Style practices:**
- Line length: Follow PEP 8 (88 characters with Ruff/Black compatible settings)
- Indentation: 4 spaces per PEP 8
- Docstrings: Triple-quoted descriptions at module/class/function level

## Import Organization

### TypeScript Import Order

1. **React/external libraries** - Standard libraries first
   ```tsx
   import { useState, useEffect } from 'react';
   import ReactDOM from 'react-dom/client';
   import gsap from 'gsap';
   ```

2. **Component imports** - Local component imports using path aliases
   ```tsx
   import { BridgeView } from '@components/domain/dashboard/BridgeView';
   import { StarMapPanel } from '@components/domain/dashboard/StarMapPanel';
   ```

3. **Service/API imports** - Services and API clients
   ```tsx
   import { charonApi } from '@/services/charonApi';
   import { useSceneStore } from '@/stores/sceneStore';
   ```

4. **Utility/Hook imports** - Utilities and custom hooks
   ```tsx
   import { useTransitionGuard } from '@hooks/useDebounce';
   import { TRANSITION_TIMING, waitForTypewriter } from '@/utils/transitionCoordinator';
   ```

5. **Type imports** - TypeScript types (use `import type` for types-only imports)
   ```tsx
   import type { StarMapData } from '../types/starMap';
   import type { SystemMapData, BodyData } from '../types/systemMap';
   ```

6. **Style imports** - CSS files last
   ```tsx
   import '../styles/global.css';
   import './SharedConsole.css';
   ```

**Path Aliases** (configured in tsconfig.json and vite.config.ts):
- `@/*` → `src/*` (generic imports)
- `@components/*` → `src/components/*` (component imports)
- `@hooks/*` → `src/hooks/*` (hook imports)
- `@services/*` → `src/services/*` (service imports)

**Important:** Always use absolute path aliases (`@/`, `@components/`) instead of relative imports (`../../../`)

### Python Import Order

1. **Standard library** - Built-in modules
   ```python
   import os
   import yaml
   from pathlib import Path
   from typing import Dict, List, Any
   ```

2. **Django imports** - Django framework
   ```python
   from django.db import models
   from django.shortcuts import render
   from django.http import JsonResponse
   ```

3. **Local imports** - Application modules
   ```python
   from terminal.data_loader import DataLoader
   from terminal.models import ActiveView
   ```

## Error Handling

### TypeScript/React Pattern

**API Calls:**
```typescript
try {
  const response = await api.get<DataType>('/endpoint/');
  return response.data;
} catch (error) {
  console.error('Clear description of what failed:', error);
  // Re-throw or return fallback value depending on context
  throw error;
}
```

**React Component Error Handling:**
```typescript
try {
  await someAsyncOperation();
  setData(result);
} catch (err) {
  console.error('Context: Error during operation:', err);
  showStatus('User-friendly error message', 'error');
  // Don't silently fail - always inform user
}
```

**Key Pattern:**
- Use `console.error()` with descriptive prefix for debugging
- Always catch errors in async operations
- Show user-friendly error messages via UI (not raw error objects)
- Use TypeScript's `unknown` type for caught errors (don't assume error shape)
- Log errors before state updates to avoid losing context

### Python Error Handling

**Data Loader Pattern:**
```python
def load_location(self, location_slug: str) -> Dict[str, Any]:
    location_dir = self.locations_dir / location_slug
    if not location_dir.exists():
        return None  # Silent failure on missing data

    try:
        with open(location_file, 'r') as f:
            return yaml.safe_load(f)
    except (FileNotFoundError, yaml.YAMLError):
        return None  # Fallback to None for missing/invalid files
```

**View Error Handling:**
```python
try:
    data = loader.load_star_map()
    return JsonResponse(data)
except (FileNotFoundError, Exception) as e:
    logger.error(f'Failed to load star map: {e}')
    return JsonResponse({'error': 'Failed to load data'}, status=500)
```

**Key Pattern:**
- Return `None` or empty collections for missing data (don't raise)
- Use bare `except` or catch multiple exception types for robustness
- Log errors server-side but return generic messages to clients
- Use try/except for file operations (paths may not exist)

## Logging

### Framework
**TypeScript:** `console.log()`, `console.warn()`, `console.error()` (no structured logging library)

**Python:** Django's logging module (not currently used, falls back to print/log())

### Logging Patterns

**Prefixed Debugging:**
```typescript
console.warn('[Transition] Typewriter timeout - proceeding anyway');
console.error('[Transition] Error during transition:', error);
console.warn('Transition already in progress, ignoring call');
```

**Patterns:**
- Use bracket prefixes `[ContextName]` for structured debugging
- Use `console.warn()` for recoverable issues
- Use `console.error()` for exceptions that affect functionality
- Include context in messages (what operation, why it failed)
- Avoid logging sensitive data or verbose dumps

### No Comments Needed
- Code is self-documenting where possible
- Comments explain *why*, not *what* (code shows what)
- JSDoc/TSDoc used for public functions and complex types

## Comments

### When to Comment

**JSDoc for public functions:**
```typescript
/**
 * Wait for a camera animation to complete
 *
 * @param duration - Duration to wait in milliseconds
 * @returns Promise that resolves after the duration
 */
export async function waitForCameraAnimation(duration: number): Promise<void> {
```

**Inline comments for complex logic:**
```typescript
// Clear any pending timeout before setting new one
if (timeoutRef.current) {
  clearTimeout(timeoutRef.current);
}
```

**Comments for non-obvious decisions:**
```python
# Systems are directly under galaxy/ (no intermediate dirs)
self.systems_dir = self.galaxy_dir
```

### When NOT to Comment

- Don't comment obvious code: `const name = user.name; // Set the name` ❌
- Don't repeat function signatures: `// Gets the location by slug` ❌
- Don't document parameters obvious from names: `function setActive(bool) // Is active` ❌

## Function Design

### Size Guidelines

**Target:** 20-50 lines for utility functions, 30-100 lines for component bodies

**Examples:**
- `useDebounce()` hook: ~40 lines (utility function)
- `BridgeView()` component: ~30 lines (presentation)
- `SharedConsole()` component: ~1000 lines (complex container - refactoring target)

**Signal to refactor:** Functions exceeding 200 lines should extract helpers

### Parameters

**Pattern - Props interfaces for components:**
```typescript
interface BridgeViewProps {
  activeTab: BridgeTab;
  onTabChange: (tab: BridgeTab) => void;
  tabTransitionActive?: boolean;
  children?: ReactNode;
  charonHasMessages?: boolean;
}
```

**Pattern - Callback params:**
```typescript
// Event callbacks are single-argument with event context
onSystemClick?: (systemName: string) => void;
onTabChange: (tab: BridgeTab) => void;
```

**Pattern - Configuration objects:**
```typescript
interface SceneState {
  mapViewMode: MapViewMode;
  selectedSystem: string | null;
  animations: AnimationState;
  // ... more fields
}
```

### Return Values

**Patterns observed:**
- Async functions return `Promise<DataType>` or `Promise<void>`
- Data loaders return `null` on not found (not undefined, not error)
- API calls return typed data or throw on error
- React hooks return values directly (not wrapped in objects unless multiple related values)

## Module Design

### Exports

**Service modules:**
```typescript
// messageApi.ts - Single named export + named object export
export async function getMessages(sinceId?: number): Promise<MessageResponse> { }

export const messageApi = {
  getMessages,
};
```

**Hook modules:**
```typescript
// useDebounce.ts - Multiple named exports
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T { }

export function useTransitionGuard<T extends (...args: any[]) => Promise<any>>(
  func: T,
  minDelay?: number
): [T, () => boolean] { }
```

**Type modules:**
```typescript
// starMap.ts - Multiple interfaces + type aliases
export interface StarSystem { }
export interface TravelRoute { }
export type NebulaType = 'emission' | 'reflection' | 'planetary' | 'dark';
export interface StarMapData { }
```

**Component modules:**
```typescript
// BridgeView.tsx - Default export for component, named exports for helpers
export interface BridgeViewProps { }
export function BridgeView(props: BridgeViewProps) { }
```

### Barrel Files

**Usage:** Rare in this codebase. Not found in core structure.

**Current approach:** Components imported directly from their file paths:
```typescript
import { BridgeView } from '@components/domain/dashboard/BridgeView';
```

**Rather than:** Barrel imports (not used)
```typescript
// NOT USED: import { BridgeView } from '@components/domain/dashboard';
```

### File Organization

**Services** (`src/services/`):
- Each service file exports functions and a named object with all functions
- Base API setup in `api.ts` (axios instance with CSRF handling)
- Domain-specific APIs in separate files (messageApi.ts, charonApi.ts, etc.)

**Hooks** (`src/hooks/`):
- Pure React hooks (no component rendering)
- Named exports only
- Reusable across components

**Types** (`src/types/`):
- Interfaces and type aliases only
- Grouped by domain (starMap, systemMap, orbitMap, etc.)
- No implementations

**Components** (`src/components/`):
- Domain-organized structure (domain/, gm/, layout/, ui/)
- Each component in its own .tsx file
- Related CSS files co-located with component

**Stores** (`src/stores/`):
- Zustand stores with typed state
- Selector functions for derived state
- Action methods grouped logically

## React/TypeScript Specific Patterns

### Hook Usage

**Preferred hooks:**
- `useState` for component-local state
- `useCallback` for memoized callbacks (especially in render)
- `useEffect` for side effects with proper dependencies
- `useRef` for DOM refs and mutable values
- `useMemo` for expensive computations

**Custom hooks:**
- Extract reusable logic into custom hooks in `src/hooks/`
- Prefix with 'use' following React conventions
- Return values directly (not wrapped in objects)

### State Management

**Zustand store** (`useSceneStore`) for:
- 3D scene state (mapViewMode, selectedSystem, animations)
- Data shared across multiple components
- State that persists across tab switches

**React local state** (`useState`) for:
- Component-specific UI state (isOpen, error messages)
- Temporary values that don't need global access
- Form inputs and transient selections

**SessionStorage/LocalStorage** for:
- Tab state persistence (key: `activeTab`)
- GM console tree expansion state (key: `expandedNodes`)

### Type Patterns

**Props interfaces:**
```typescript
interface ComponentProps {
  // Required props first
  requiredProp: string;
  onEvent: (value: string) => void;
  // Optional props with defaults in function signature
  optionalProp?: boolean;
  className?: string;
}

function Component({ requiredProp, optionalProp = false }: ComponentProps) { }
```

**Discriminated unions for variants:**
```typescript
type MapViewMode = 'galaxy' | 'system' | 'orbit';
type TransitionState = 'idle' | 'diving' | 'zooming-out' | 'fading-in' | 'fading-out';
```

**Callback types:**
```typescript
// Describe callback intent in interface
interface GalaxySceneCallbacks {
  onSystemClick?: (systemName: string) => void;
  onSystemHover?: (systemName: string | null) => void;
}
```

## Django/Python Specific Patterns

### Model Patterns

**Django Models:**
```python
class ActiveView(models.Model):
    """Docstring explaining the model's purpose."""

    VIEW_TYPE_CHOICES = [
        ('STANDBY', 'Standby Screen'),
        ('BRIDGE', 'Bridge'),
    ]

    field_name = models.CharField(
        max_length=200,
        help_text='Description of field'
    )

    def __str__(self):
        return f'{self.name}'

    @classmethod
    def get_current(cls):
        """Class method for common queries."""
        pass
```

### View Patterns

**Function-based views:**
```python
@login_required
def some_view(request):
    """View docstring."""
    try:
        data = load_data()
        return JsonResponse(data)
    except Exception as e:
        logger.error(f'Error: {e}')
        return JsonResponse({'error': 'Failed'}, status=500)
```

### Data Loader Pattern

**File-based data access:**
```python
loader = DataLoader()
locations = loader.load_all_locations()
location = loader.find_location_by_slug('some_slug')
```

**Key characteristics:**
- Returns `None` or empty collections for missing data
- Handles YAML parsing robustly
- Uses `pathlib.Path` for cross-platform file operations

---

*Convention analysis: 2026-02-09*
