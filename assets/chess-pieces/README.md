# Chess Pieces SVGs

This folder contains SVG files for chess pieces used in the Four Player Chess game.

## Folder Structure

```
chess-pieces/
├── dark/          # Dark pieces (black, red, blue)
├── light/         # Light pieces (white, yellow, green)
└── README.md      # This file
```

## Expected File Names

### Dark Pieces (dark/ folder)

- `king.svg` - King piece
- `queen.svg` - Queen piece
- `rook.svg` - Rook piece
- `bishop.svg` - Bishop piece
- `knight.svg` - Knight piece
- `pawn.svg` - Pawn piece

### Light Pieces (light/ folder)

- `king.svg` - King piece
- `queen.svg` - Queen piece
- `rook.svg` - Rook piece
- `bishop.svg` - Bishop piece
- `knight.svg` - Knight piece
- `pawn.svg` - Pawn piece

## Color Mapping

The pieces will be colored based on the player colors:

- **Red (r)**: Uses dark pieces
- **Blue (b)**: Uses dark pieces
- **Yellow (y)**: Uses light pieces
- **Green (g)**: Uses light pieces

## SVG Requirements

- SVGs should be optimized for mobile display
- Recommended size: 64x64px or similar
- Use `currentColor` for fill/stroke to allow dynamic coloring
- Ensure pieces are centered in the SVG viewBox
- Use simple, clean designs that work well at small sizes

## Usage

The Piece component will automatically load the appropriate SVG based on:

1. Piece type (king, queen, rook, bishop, knight, pawn)
2. Player color (determines dark/light folder)
3. Dynamic coloring based on player color

