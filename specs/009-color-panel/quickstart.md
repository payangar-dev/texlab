# Quickstart: Color Panel (HSV Picker + Hex Input)

**Feature Branch**: `009-color-panel`
**Date**: 2026-03-31

## Prerequisites

- Node.js ≥ 20 LTS
- Rust ≥ 1.77
- Tauri CLI v2

## Run the App

```bash
cd apps/texture-lab
npm install
npm run tauri dev
```

## Manual Test Plan

### Test 1: HSV Gradient Color Selection (US-1)

1. Open the app — the Color panel should appear in the right dock area
2. Click anywhere on the 2D gradient area
3. **Verify**: A circular cursor appears at the click position
4. **Verify**: The hex input field updates to show the color at that position
5. **Verify**: The active color indicator (fg square) matches the selected color
6. Click and drag across the gradient
7. **Verify**: The cursor follows the pointer in real-time
8. **Verify**: The hex input and active color indicator update continuously during drag
9. Drag the pointer outside the gradient area boundaries
10. **Verify**: The cursor clamps to the gradient edges (does not leave the area)

### Test 2: Hex Input Color Entry (US-2)

1. Click on the hex input field
2. Type `#FF5500`
3. **Verify**: The active color indicator (fg square) shows orange
4. **Verify**: The gradient cursor repositions to the orange region
5. Clear the field and type `ABC` (3-digit shorthand)
6. **Verify**: The color is interpreted as `#AABBCC`
7. Type invalid characters (e.g., `XYZ`, `!!!`)
8. **Verify**: Invalid characters are rejected; the last valid color persists
9. Press the X key while the hex input has focus
10. **Verify**: The character "x" is typed into the field (NOT a color swap)

### Test 3: Primary/Secondary Color Swap (US-3)

1. Select a red color via the gradient (primary slot should be active by default)
2. Click the secondary color indicator
3. **Verify**: The secondary slot is now highlighted as active
4. Select a blue color via the gradient
5. **Verify**: The secondary slot shows blue, primary still shows red
6. Click the swap control (or press X when hex input is NOT focused)
7. **Verify**: Primary is now blue, secondary is now red
8. **Verify**: The gradient and hex input reflect the new active color
9. Click the primary color indicator
10. **Verify**: The primary slot becomes the active editing target again

### Test 4: Panel Integration

1. Drag the Color panel tab to a different dock position
2. **Verify**: The panel docks correctly and remains fully functional
3. Select a color, then use the brush tool to draw on a texture
4. **Verify**: The brush paints with the selected primary color
5. Swap colors and draw again
6. **Verify**: The brush now paints with the swapped color
7. Use the eyedropper tool to pick a color from the canvas
8. **Verify**: The Color panel updates to show the picked color (gradient cursor + hex + swatch)

### Test 5: Edge Cases

1. Open the app with no texture loaded
2. **Verify**: The Color panel is fully functional (color state is global)
3. Select a pure white color, then swap — verify both slots update correctly
4. Select a pure black color — verify the gradient cursor is at the bottom
5. Rapidly click different positions on the gradient
6. **Verify**: No lag or flickering in cursor/hex/swatch updates

## Unit Tests

```bash
# Run color conversion utility tests
npx vitest run src/utils/color.test.ts

# Run all frontend tests
npx vitest run
```

### Expected Test Coverage

- `color.ts`: HSV↔RGB round-trip accuracy, hex parsing (valid/invalid/shorthand), hex formatting
- `toolStore.ts`: activeSlot switching, setActiveColor routing, swapColors behavior

### Design Reference

The UI design file (`ui-design`, component `Panel-Color` / `NytLZ`) shows the final layout:
- Gradient area + single input row with fg/bg squares, swap icon, HEX label, and hex input field
- No separate preview swatch — the fg/bg color indicators serve as live preview
