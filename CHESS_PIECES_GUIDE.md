# Chess Pieces Integration Guide

This guide explains how to integrate your custom SVG chess pieces into the Four Player Chess game.

## 📁 Folder Structure

```
assets/chess-pieces/
├── dark/              # Dark pieces (Red, Blue players)
│   ├── king.svg
│   ├── queen.svg
│   ├── rook.svg
│   ├── bishop.svg
│   ├── knight.svg
│   └── pawn.svg
├── light/             # Light pieces (Yellow, Green players)
│   ├── king.svg
│   ├── queen.svg
│   ├── rook.svg
│   ├── bishop.svg
│   ├── knight.svg
│   └── pawn.svg
└── README.md
```

## 🎨 SVG Requirements

### File Format

- **Format**: SVG files
- **Size**: 48x48px viewBox recommended
- **Naming**: Use exact names (king.svg, queen.svg, etc.)

### Design Guidelines

- Use `currentColor` for fill/stroke to allow dynamic coloring
- Keep designs simple and clean for mobile display
- Ensure pieces are centered in the viewBox
- Use consistent styling across all pieces

### Example SVG Structure

```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <g fill="currentColor">
    <!-- Your piece design here -->
    <path d="M24 8 L20 16 L16 12..."/>
  </g>
</svg>
```

## 🚀 Integration Steps

### 1. Add Your SVG Files

Place your SVG files in the appropriate folders:

- **Dark pieces** → `assets/chess-pieces/dark/`
- **Light pieces** → `assets/chess-pieces/light/`

### 2. Extract SVG Paths (Optional)

Run the extraction script to automatically generate the TypeScript file:

```bash
node scripts/extract-svg-paths.js
```

This will:

- Read all SVG files
- Extract path data
- Generate `PieceAssets.ts` with your SVG paths

### 3. Enable SVG Mode

In your game component, set the `useSVG` prop to `true`:

```tsx
<Piece
  piece="rK"
  size={50}
  useSVG={true} // Enable SVG mode
/>
```

### 4. Global Configuration

To enable SVG mode globally, update `PieceConfig.ts`:

```typescript
export const PIECE_CONFIG = {
  USE_SVG_PIECES: true, // Set to true
  // ... other config
};
```

## 🎯 Color Mapping

The pieces are automatically colored based on player colors:

| Player     | Color   | Uses         | Folder   |
| ---------- | ------- | ------------ | -------- |
| Red (r)    | #DC2626 | Dark pieces  | `dark/`  |
| Blue (b)   | #2563EB | Dark pieces  | `dark/`  |
| Yellow (y) | #EAB308 | Light pieces | `light/` |
| Green (g)  | #16A34A | Light pieces | `light/` |

## 🔧 Customization

### Piece Colors

Modify colors in `PieceConfig.ts`:

```typescript
COLORS: {
  red: "#DC2626",      // Red pieces
  blue: "#2563EB",     // Blue pieces
  yellow: "#EAB308",   // Yellow pieces
  green: "#16A34A",    // Green pieces
  eliminated: "#9CA3AF", // Greyed out pieces
}
```

### SVG Settings

Adjust SVG display settings:

```typescript
SVG: {
  SIZE_MULTIPLIER: 0.8,    // Size relative to square
  VIEW_BOX: "0 0 48 48",   // SVG viewBox
}
```

## 📱 Usage Examples

### Basic Usage

```tsx
import Piece from './components/board/Piece';

// Unicode symbols (default)
<Piece piece="rK" size={50} />

// SVG pieces
<Piece piece="rK" size={50} useSVG={true} />
```

### With Elimination State

```tsx
<Piece
  piece="rK"
  size={50}
  useSVG={true}
  isEliminated={true} // Greyed out
/>
```

### Dynamic Mode

```tsx
const useSVGMode = true; // From settings or state

<Piece piece={pieceCode} size={squareSize} useSVG={useSVGMode} />;
```

## 🐛 Troubleshooting

### SVG Not Displaying

1. Check file names match exactly (king.svg, queen.svg, etc.)
2. Ensure SVG uses `currentColor` for fill/stroke
3. Verify viewBox is set correctly (0 0 48 48)
4. Check console for errors

### Colors Not Applied

1. Ensure SVG uses `currentColor` instead of hardcoded colors
2. Check `getPieceColor` function in PieceConfig.ts
3. Verify piece codes are correct (rK, bQ, yR, gP, etc.)

### Performance Issues

1. Use simple SVG designs
2. Avoid complex gradients or filters
3. Consider using Unicode symbols for better performance

## 📝 Notes

- **Fallback**: If SVG files are missing, the component falls back to Unicode symbols
- **Performance**: SVG pieces may be slightly slower than Unicode symbols
- **Compatibility**: Works with React Native SVG library
- **Scaling**: Pieces automatically scale with the board size

## 🎉 Ready to Go!

Once you've added your SVG files, your chess pieces will be beautifully rendered with proper colors and scaling. The system is designed to be flexible and easy to customize.

Happy coding! 🚀

