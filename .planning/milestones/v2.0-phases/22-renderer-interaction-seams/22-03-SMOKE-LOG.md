# Phase 22 Smoke Verification — 2026-05-14

| # | Behavior | Result | Notes |
|---|----------|--------|-------|
| 1 | Right-click Room A → context menu appears | PASS | |
| 2 | Right-click Room B (menu open) → Room B menu, Room A disappears | PASS | |
| 3 | Left-click token (menu open) → token popup, context menu disappears | PASS | |
| 4 | Click door → door status popup, any open popover disappears | PASS | |
| 5 | Hover POI marker → POI popup, any other popover disappears | PASS | |
| 6 | Close door popup → gone, no other popover reappears | PASS | |
| 7 | GM drags token onto empty in-room cell → placed, no error | PASS | |
| 8 | GM drags token onto occupied cell → silent snap-back | PASS | Toasts replaced with snap-back per user request |
| 9 | GM drags token onto corridor/wall → silent snap-back | PASS | Toasts replaced with snap-back per user request |
| 10 | Non-GM user tries to drag token → silently rejected | PASS | |
