# Tasks: Color Panel (HSV Picker + Hex Input)

**Input**: Design documents from `/specs/009-color-panel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — project already exists. No new dependencies required.

*(No tasks — project structure and dependencies are already in place.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that ALL user stories depend on — color conversion utilities and store extension.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Implement color conversion utilities (hsvToRgb, rgbToHsv, hexToRgb, rgbToHex, colorToGradientPos) and HsvColor interface in src/utils/color.ts. Accept 3/6 digit hex with/without `#`. rgbToHex outputs uppercase `#RRGGBB`. colorToGradientPos maps color to gradient cursor position via HSV approximation: x = (h/360) * width, y = (1 - v) * height. All functions must be pure with zero side effects.
- [x] T002 [P] Extend toolStore with activeSlot support in src/store/toolStore.ts. Add `ColorSlot` type (`"primary" | "secondary"`), `activeSlot` state field (default: `"primary"`), and `setActiveSlot` action. Modify `setActiveColor` to write to `activeColor` when slot is `"primary"` or `secondaryColor` when slot is `"secondary"`. Default is `"primary"`, so existing callers (e.g., eyedropper in `useViewportControls.ts`) keep their current behavior when no slot switch has occurred. **INTENTIONAL BEHAVIOR CHANGE**: when `activeSlot` is `"secondary"`, `setActiveColor` writes to `secondaryColor` instead of `activeColor` — this is correct per FR-012 ("update the currently active color slot"). T012 validates eyedropper integration post-implementation.
- [x] T003 [P] Add unit tests for color conversion utilities in src/utils/color.test.ts. Cover: HSV→RGB→HSV round-trip accuracy for primary colors and edge cases (black, white, grays), hexToRgb with valid 6-digit, valid 3-digit, with/without `#`, invalid input returns null, rgbToHex formatting. Cover colorToGradientPos for known positions (pure red = left edge, pure black = bottom).
- [x] T004 [P] Add unit tests for activeSlot behavior in src/store/toolStore.test.ts. Cover: default activeSlot is `"primary"`, setActiveSlot switches slot, setActiveColor routes to activeColor when primary, setActiveColor routes to secondaryColor when secondary, swapColors does not change activeSlot.

**Checkpoint**: Color utilities tested and store extended — user story implementation can begin.

---

## Phase 3: User Story 1 — Pick a Color via HSV Gradient (Priority: P1) MVP

**Goal**: User can visually select any color by clicking/dragging on a 2D gradient area. The selected color becomes the active drawing color.

**Independent Test**: Open the Color panel, click/drag on the gradient area, verify the cursor follows the pointer and the active color updates.

### Implementation for User Story 1

- [x] T005 [US1] Implement HsvGradient component in src/components/color/HsvGradient.tsx. Render a `<canvas>` element with 3 composited gradient layers: (1) horizontal hue spectrum (red→yellow→green→cyan→blue→magenta→red), (2) horizontal white-to-transparent overlay (left=white, right=transparent), (3) vertical transparent-to-black overlay (top=transparent, bottom=black). Canvas must have 6px corner radius (via container clip). Use `getImageData(x, y, 1, 1)` to sample pixel color on click/drag. Implement pointer events with `setPointerCapture` for smooth dragging. Clamp cursor to canvas bounds (FR-005). Render a 10px circular cursor (white 2px stroke, transparent fill) at the current position. Accept `color: ColorDto` prop and compute cursor position via `colorToGradientPos()`. Call `onChange(color: ColorDto)` on pick. Re-render gradient only on mount or resize, not on every color change.
- [x] T006 [US1] Replace ColorPanel placeholder with real panel composition in src/components/panels/ColorPanel.tsx. Import and render HsvGradient as the panel body content. Subscribe to toolStore for `editingColor` (derived: `activeSlot === "primary" ? activeColor : secondaryColor`). Wire HsvGradient's `onChange` to `setActiveColor`. Apply panel styling from UI design: background `#252525`, vertical flex layout, 6px padding, 6px gap. The panel must fill its dockview container (width/height 100%).

**Checkpoint**: User Story 1 is fully functional — gradient selection works, color updates on click/drag, cursor follows pointer.

---

## Phase 4: User Story 2 — Enter a Color via Hex Input (Priority: P2)

**Goal**: User can type a hex color code to set a precise color. The active color indicator updates live. Gradient cursor repositions to match.

**Independent Test**: Type a valid hex code in the input field, verify the active color indicator, gradient cursor, and active color all update.

### Implementation for User Story 2

- [x] T007 [US2] Implement HexInput component in src/components/color/HexInput.tsx. Render a fragment with two elements (to be placed as siblings in a parent flex row): (1) "HEX" label (Geist Mono 8px, color `#888888`), (2) text `<input>` showing current hex value (Geist Mono 9px, `#CCCCCC` on `#333333`, corner radius 4, flex-grow 1, height 20px, 6px horizontal padding). No preview swatch — the fg/bg squares from ColorSlots serve as live preview (FR-009). Accept `color: ColorDto` prop and display its hex via `rgbToHex`. On input change: validate with `hexToRgb`, if valid call `onChange(color: ColorDto)`, if invalid keep the last valid color (do not update store).
- [x] T008 [US2] Add HexInput to the color input row in src/components/panels/ColorPanel.tsx. Create a horizontal flex row below HsvGradient (gap: 5px, align-items: center, width: 100%). Render HexInput inside this row. Wire the same `editingColor` and `setActiveColor` to HexInput. Bidirectional sync: gradient changes update hex display, hex input changes update gradient cursor. This row will also host ColorSlots in Phase 5 (T010).

**Checkpoint**: User Stories 1 AND 2 work — gradient and hex input are bidirectionally synchronized.

---

## Phase 5: User Story 3 — Swap Primary and Secondary Colors (Priority: P3)

**Goal**: User can see both primary and secondary colors, click to switch the active editing target, and swap colors via a control or the X keyboard shortcut.

**Independent Test**: Set two different colors as primary and secondary, click the swap control or press X, verify the colors exchange positions.

### Implementation for User Story 3

- [x] T009 [US3] Implement ColorSlots component in src/components/color/ColorSlots.tsx. Render a fragment with three inline elements (to be placed as siblings in the color input row, BEFORE the HexInput elements). Layout from UI design (`pcFg`, `pcSwap`, `pcBg` nodes): (1) Primary color square — 20×20, corner-radius 3, filled with primary color from store. Active state: 1.5px inside border `#4A9FD8`. Inactive state: 1px inside border `#444444`. Clickable → `setActiveSlot('primary')`. (2) Swap icon — lucide-react `ArrowLeftRight`, size 10×10, color `#666666`, hover `#CCCCCC`, clickable → `swapColors()`. (3) Secondary color square — 20×20, corner-radius 3, filled with secondary color from store. Same active/inactive border logic as primary. Clickable → `setActiveSlot('secondary')`. Subscribe to toolStore for `activeColor`, `secondaryColor`, and `activeSlot`. The active slot indicator (fg or bg square) doubles as live color preview (FR-009). The X keyboard shortcut is already handled globally in useKeyboardShortcuts.ts — no changes needed.
- [x] T010 [US3] Add ColorSlots to the color input row in src/components/panels/ColorPanel.tsx. Import ColorSlots and render it as the **first children** of the existing horizontal color input row (created in T008), before the HexInput elements. The row becomes: `[fg] [↔] [bg] [HEX] [input]`. No panel height change needed — everything fits in the existing row. When the user switches the active slot, the gradient and hex input must reflect the newly active color.

**Checkpoint**: All three user stories are functional — gradient, hex input, and color slots/swap work together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and refinements across all stories

- [x] T011 Validate all acceptance scenarios from quickstart.md manually (Test 1–5). Verify: gradient click/drag, hex input formats, swap behavior, panel docking, edge cases (no texture, rapid clicks). Fix any issues found.
- [x] T012 Verify eyedropper tool integration — picking a color via the eyedropper tool on the canvas must update the Color panel (gradient cursor + hex input + active color indicator). If `useViewportControls.ts` calls `setActiveColor` on color_picked result, no changes needed. Otherwise wire the integration.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — no setup tasks
- **Foundational (Phase 2)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on T001, T002 completion
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (ColorPanel layout established in T006)
- **User Story 3 (Phase 5)**: Depends on Phase 4 completion (ColorPanel layout extended in T008)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — independent
- **User Story 2 (P2)**: Depends on US1 (T006 establishes ColorPanel layout that T008 extends)
- **User Story 3 (P3)**: Depends on US2 (T008 establishes full layout that T010 extends)

### Within Each User Story

- Component implementation before panel composition
- Panel composition completes the story

### Parallel Opportunities (Phase 2)

- T001 (color.ts) and T002 (toolStore.ts) are in different files — can run in parallel
- T003 (color.test.ts) and T004 (toolStore.test.ts) are in different files — can run in parallel
- T001+T003 can run as one unit, T002+T004 as another

---

## Parallel Example: Phase 2 (Foundational)

```
# These 4 tasks touch different files — all can run in parallel:
T001: src/utils/color.ts
T002: src/store/toolStore.ts
T003: src/utils/color.test.ts
T004: src/store/toolStore.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T004)
2. Complete Phase 3: User Story 1 (T005–T006)
3. **STOP and VALIDATE**: Click/drag on gradient, verify cursor + color updates
4. This delivers a usable color picker — artists can select colors visually

### Incremental Delivery

1. Foundational → Color utils + store ready
2. Add US1 (gradient) → Test → Basic color picking works (MVP)
3. Add US2 (hex input) → Test → Precision color entry works
4. Add US3 (swap slots) → Test → Full color workflow works
5. Polish → Validate all integration points

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Keyboard shortcut (X to swap) is already implemented — no task needed
- No Rust backend changes required — this is a frontend-only feature
- Commit after each completed phase
- All colors use `a: 255` (alpha out of scope per spec)
