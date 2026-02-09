# Testing Patterns

**Analysis Date:** 2026-02-09

## Test Framework

### Current State

**Frontend (TypeScript/React):**
- Framework: Not implemented
- Config: `package.json` contains placeholder: `"test": "echo \"Error: no test specified\" && exit 1"`
- Assertion library: Not installed
- Run command: Not available

**Backend (Python/Django):**
- Framework: Django test framework (built-in)
- Config: `terminal/tests.py` exists but is empty (only imports `from django.test import TestCase`)
- Run command: `python manage.py test`
- Assertion library: Django's `TestCase` assertions

### Testing Gap

**Critical Issue:** Frontend has zero test coverage with no framework configured. Only backend has framework available but no tests written.

**Recommended setup** (not yet implemented):
- Frontend: Vitest (lightweight, Vite-native) or Jest
- Backend: pytest (more flexible than Django's built-in test framework)

## Test File Organization

### Current Structure

**Backend:**
- Location: `terminal/tests.py`
- Status: File exists but is empty scaffold
- Pattern: Co-located with app (Django convention)

**Frontend:**
- Location: Not present
- Pattern: Would follow `src/**/*.test.tsx` or `src/**/*.spec.ts` pattern

### Recommended Structure

**If tests were implemented:**

Backend (Django):
```
terminal/
├── tests/
│   ├── __init__.py
│   ├── test_models.py       # Model tests
│   ├── test_views.py        # View/API endpoint tests
│   ├── test_data_loader.py  # DataLoader tests
│   └── fixtures/            # Test data
```

Frontend (if implemented):
```
src/
├── services/__tests__/
│   ├── messageApi.test.ts
│   └── charonApi.test.ts
├── hooks/__tests__/
│   └── useDebounce.test.ts
├── components/domain/
│   └── dashboard/__tests__/
│       └── BridgeView.test.tsx
└── utils/__tests__/
    └── transitionCoordinator.test.ts
```

## Test Structure

### Django Test Pattern (Reference)

If tests were written, they would follow Django conventions:

```python
from django.test import TestCase, TransactionTestCase
from django.test.client import Client
from terminal.models import ActiveView, Message
from terminal.data_loader import DataLoader

class ActiveViewTestCase(TestCase):
    """Tests for ActiveView model."""

    def setUp(self):
        """Set up test fixtures before each test."""
        self.view = ActiveView.objects.create(
            location_slug='test_location',
            view_type='STANDBY'
        )

    def tearDown(self):
        """Clean up after each test."""
        ActiveView.objects.all().delete()

    def test_get_current_returns_singleton(self):
        """ActiveView.get_current() should return the singleton instance."""
        current = ActiveView.get_current()
        self.assertEqual(current.id, self.view.id)

    def test_view_type_choices(self):
        """VIEW_TYPE_CHOICES should contain all valid view types."""
        valid_types = [choice[0] for choice in ActiveView.VIEW_TYPE_CHOICES]
        self.assertIn('STANDBY', valid_types)
        self.assertIn('BRIDGE', valid_types)
```

### Recommended React/TypeScript Pattern (if implemented)

If frontend tests were added (e.g., with Vitest):

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  let currentTime: number;

  beforeEach(() => {
    currentTime = Date.now();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce function calls', async () => {
    const mockFn = vi.fn();
    const { result } = renderHook(() => useDebounce(mockFn, 300));

    // Call debounced function immediately
    await act(async () => {
      await result.current('test');
    });

    // Function should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();

    // Advance time past debounce delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now function should have been called
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});
```

## Mocking

### Current Approach (Observed)

**Frontend:** No mocking infrastructure (no tests exist)

**Backend:** Manual mocking in tests (not implemented)

### Recommended Mocking Patterns

**API Mocking** (if implemented with Vitest):
```typescript
import { vi } from 'vitest';
import * as messageApi from '@/services/messageApi';

// Mock entire module
vi.mock('@/services/messageApi', () => ({
  getMessages: vi.fn(() => Promise.resolve({
    messages: [{ id: 1, sender: 'TEST', content: 'Test message' }],
    count: 1
  }))
}));
```

**Zustand Store Mocking** (if implemented):
```typescript
import { useSceneStore } from '@/stores/sceneStore';

beforeEach(() => {
  // Reset store to initial state
  useSceneStore.setState({
    mapViewMode: 'galaxy',
    selectedSystem: null,
    starMapData: null,
  });
});
```

**What to Mock:**
- External API calls (API clients)
- Browser APIs (localStorage, setTimeout when testing timing)
- Zustand stores for testing components in isolation
- GSAP animations (timing in tests)

**What NOT to Mock:**
- React hooks (useState, useEffect) - test actual behavior
- TypeScript types - never mock types
- Pure utility functions - test actual implementations
- DOM APIs unless testing error handling

## Fixtures and Factories

### Current State

No test fixtures or factories exist in codebase.

### Recommended Pattern (if implemented)

**Data Fixtures** (`terminal/tests/fixtures/`):
```python
# test_data.py
MOCK_ACTIVE_VIEW = {
    'location_slug': 'test_location',
    'view_type': 'STANDBY',
    'view_slug': '',
    'encounter_level': 1,
}

MOCK_STAR_MAP_DATA = {
    'systems': [
        {
            'name': 'Sol',
            'position': [0, 0, 0],
            'color': 0xFFFF00,
            'size': 10,
            'type': 'star',
        }
    ],
    'routes': [],
    'nebulae': [],
}
```

**React Test Fixtures** (if implemented):
```typescript
// src/types/__tests__/fixtures.ts
export const mockStarMapData: StarMapData = {
  systems: [
    {
      name: 'Sol',
      position: [0, 0, 0],
      color: 0xFFFF00,
      size: 10,
      type: 'star',
      has_system_map: false,
    }
  ],
  routes: [],
  nebulae: [],
};

export const mockBridgeViewProps: BridgeViewProps = {
  activeTab: 'map',
  onTabChange: vi.fn(),
  tabTransitionActive: false,
  charonHasMessages: false,
};
```

## Coverage

### Current Requirements

**Target:** Not enforced (no testing infrastructure)

**Recommendations:**
- Frontend: Aim for 70%+ coverage on critical paths (API calls, state management)
- Backend: Aim for 80%+ coverage on models, views, data_loader
- Required for: API endpoints, data transformations, error conditions

### View Coverage (if implemented)

```bash
# View coverage report
pytest --cov=terminal --cov-report=html

# Frontend coverage (if using Vitest)
vitest --coverage
```

## Test Types

### Unit Tests

**What they test:** Individual functions, hooks, utilities in isolation

**Backend example** (not written, reference):
```python
class DataLoaderTestCase(TestCase):
    def test_load_all_locations_returns_list(self):
        """load_all_locations should return a list of location dicts."""
        loader = DataLoader()
        locations = loader.load_all_locations()
        self.assertIsInstance(locations, list)

    def test_load_location_recursive_handles_missing_files(self):
        """load_location_recursive should handle missing location.yaml gracefully."""
        loader = DataLoader()
        # Test loading location without metadata file
        # Should create default location dict
```

**Frontend example** (not written, reference):
```typescript
describe('computeTypewriterContent', () => {
  it('should reveal text progressively based on progress', () => {
    const content = 'Hello World';
    const at50Percent = computeTypewriterContent({
      content,
      progress: 0.5,
    });
    expect(at50Percent).toContain('Hello');
  });

  it('should preserve HTML tags while animating text', () => {
    const content = '<strong>Bold</strong> text';
    const result = computeTypewriterContent({
      content,
      progress: 0.5,
    });
    expect(result).toContain('<strong>');
  });
});
```

### Integration Tests

**What they test:** Multiple components/systems working together

**Backend example** (not written, reference):
```python
class ActiveViewAPITestCase(TransactionTestCase):
    def setUp(self):
        self.client = Client()
        self.view = ActiveView.objects.create(view_type='STANDBY')

    def test_api_endpoint_returns_active_view(self):
        """GET /api/active-view/ should return current view."""
        response = self.client.get('/api/active-view/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['view_type'], 'STANDBY')
```

**Frontend example** (not written, reference):
```typescript
describe('SharedConsole integration', () => {
  it('should load and display star map on mount', async () => {
    const { getByText } = render(<SharedConsole />);

    // Wait for data to load
    await waitFor(() => {
      expect(getByText(/Sol/i)).toBeInTheDocument();
    });
  });

  it('should switch views when activeView API updates', async () => {
    vi.mocked(terminalApi.getActiveView).mockResolvedValueOnce({
      view_type: 'BRIDGE',
      location_slug: 'research_base',
    });

    const { getByText } = render(<SharedConsole />);

    // Component should poll and update
    await waitFor(() => {
      expect(getByText(/MAP|CREW|NOTES/i)).toBeInTheDocument();
    });
  });
});
```

### E2E Tests

**Current state:** Not implemented

**Tools:** Would use Playwright or Cypress if added

**Example flow** (reference):
```typescript
// e2e/terminal-navigation.spec.ts
import { test, expect } from '@playwright/test';

test('GM can navigate from galaxy to system to orbit', async ({ page }) => {
  // Navigate to terminal
  await page.goto('http://localhost:8000/terminal/');

  // Verify galaxy view is loaded
  await expect(page.locator('text=Sol')).toBeVisible();

  // Click on a system
  await page.click('text=Tau Ceti');

  // Wait for zoom animation
  await page.waitForTimeout(2000);

  // Verify system view is loaded
  await expect(page.locator('text=Tau Ceti f')).toBeVisible();

  // Navigate back
  await page.click('text=BACK TO GALAXY');

  // Verify galaxy view restored
  await expect(page.locator('text=Sol')).toBeVisible();
});
```

## Common Patterns

### Async Testing

**Backend (Django):**
```python
from django.test import TestCase
from django.test.utils import override_settings

class AsyncViewTestCase(TestCase):
    @override_settings(CELERY_ALWAYS_EAGER=True)
    def test_async_operation(self):
        """Test async operation with CELERY_ALWAYS_EAGER."""
        # Celery tasks execute immediately in tests
        result = some_async_task.delay()
        self.assertEqual(result.get(), expected_value)
```

**Frontend (if using Vitest):**
```typescript
it('should handle async state updates', async () => {
  const { result } = renderHook(() => useAsyncData());

  // Initial state
  expect(result.current.loading).toBe(true);

  // Wait for data to load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.data).toBeDefined();
});
```

### Error Testing

**Backend:**
```python
def test_data_loader_returns_none_for_missing_location(self):
    """DataLoader should return None for missing locations gracefully."""
    loader = DataLoader()
    result = loader.load_location('nonexistent_location')
    self.assertIsNone(result)
```

**Frontend:**
```typescript
it('should handle API errors gracefully', async () => {
  vi.mocked(messageApi.getMessages).mockRejectedValueOnce(
    new Error('Network error')
  );

  const { getByText } = render(<MessagePanel />);

  // Wait for error message
  await waitFor(() => {
    expect(getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

### Testing Zustand Store

**Pattern** (reference if implemented):
```typescript
import { renderHook, act } from '@testing-library/react';
import { useSceneStore } from '@/stores/sceneStore';

describe('sceneStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSceneStore.setState(useSceneStore.getInitialState?.());
  });

  it('should update selected system', () => {
    const { result } = renderHook(() => useSceneStore());

    act(() => {
      result.current.setSelectedSystem('Sol');
    });

    expect(result.current.selectedSystem).toBe('Sol');
  });

  it('should support selector to avoid re-renders', () => {
    const renderCount = vi.fn();

    const { result } = renderHook(() => {
      const selectedSystem = useSceneStore(state => state.selectedSystem);
      renderCount();
      return selectedSystem;
    });

    // Should only render when selectedSystem changes
    act(() => {
      useSceneStore.setState({ mapViewMode: 'system' }); // Doesn't affect selector
    });

    // renderCount should not increase
    expect(renderCount).toHaveBeenCalledTimes(1);
  });
});
```

## Testing Gaps and Recommendations

### Critical Gaps

**Frontend:**
- No test framework configured
- Zero test coverage
- No test for critical paths (map navigation, state transitions)
- No React component tests

**Backend:**
- `terminal/tests.py` is empty scaffold
- No model tests
- No API endpoint tests
- No DataLoader tests

### Priority Recommendations

1. **High Priority:**
   - Add Vitest for frontend (lightweight, Vite-native)
   - Add tests for API services (messageApi, charonApi, terminalApi)
   - Add tests for custom hooks (useDebounce, useTransitionGuard)
   - Add tests for utility functions (transitionCoordinator, typewriterUtils)

2. **Medium Priority:**
   - Add pytest to backend (more flexible than Django's test framework)
   - Test DataLoader with actual YAML files
   - Test ActiveView model and API endpoints
   - Test error conditions and edge cases

3. **Lower Priority:**
   - E2E tests (Playwright/Cypress) for critical user flows
   - Visual regression testing (if UI changes frequently)
   - Performance benchmarks (heavy 3D scenes)

### No Current Configuration

- No `.eslintrc` or explicit linting rules (TypeScript strict mode provides some checks)
- No Prettier config (implicit formatting via tsconfig)
- No test coverage threshold enforcement
- No pre-commit hooks for testing

---

*Testing analysis: 2026-02-09*
