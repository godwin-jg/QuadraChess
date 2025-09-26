# Four-Player Chess: Universal Pawn Promotion Rule

## Overview

**ANY pawn of any color is immediately promoted upon reaching any square on the first rank (the back row where pieces start) of any opposing player.** The player can choose to promote the pawn to a Queen, Rook, Bishop, or Knight.

## Promotion Ranks

### Board Layout

```
    0  1  2  3  4  5  6  7  8  9 10 11 12 13
 0 [✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨] ← Yellow's back rank
 1 [   Y Y Y Y Y Y Y Y Y Y Y   ] ← Yellow pawns
 2 [                           ]
 3 [✨ B   G G G G G G G G G G ✨] ← Blue/Green sides
 4 [✨ B   G G G G G G G G G G ✨]
 5 [✨ B   G G G G G G G G G G ✨]
 6 [✨ B   G G G G G G G G G G ✨]
 7 [✨ B   G G G G G G G G G G ✨]
 8 [✨ B   G G G G G G G G G G ✨]
 9 [✨ B   G G G G G G G G G G ✨]
10 [✨ B   G G G G G G G G G G ✨]
11 [                           ]
12 [   R R R R R R R R R R R   ] ← Red pawns
13 [✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨] ← Red's back rank
```

### Promotion Zones (marked with ✨)

- **Row 0, Cols 3-10** (Yellow's back rank): ✨ ANY pawn promotes here
- **Row 13, Cols 3-10** (Red's back rank): ✨ ANY pawn promotes here
- **Col 0, Rows 3-10** (Blue's back rank): ✨ ANY pawn promotes here
- **Col 13, Rows 3-10** (Green's back rank): ✨ ANY pawn promotes here

## Example Scenarios

### Scenario 1: ANY Pawn Reaching Yellow's Back Rank

- **Player**: Any color (Red, Blue, Yellow, or Green)
- **Piece**: Any pawn
- **Action**: Move to position (0, 6) - Yellow's back rank
- **Result**: ✅ **Promotion triggered** - Player chooses Queen, Rook, Bishop, or Knight

### Scenario 2: ANY Pawn Reaching Red's Back Rank

- **Player**: Any color (Red, Blue, Yellow, or Green)
- **Piece**: Any pawn
- **Action**: Move to position (13, 7) - Red's back rank
- **Result**: ✅ **Promotion triggered** - Player chooses promotion piece

### Scenario 3: ANY Pawn Reaching Blue's Back Rank

- **Player**: Any color (Red, Blue, Yellow, or Green)
- **Piece**: Any pawn
- **Action**: Move to position (5, 0) - Blue's back rank
- **Result**: ✅ **Promotion triggered** - Player chooses promotion piece

### Scenario 4: ANY Pawn Reaching Green's Back Rank

- **Player**: Any color (Red, Blue, Yellow, or Green)
- **Piece**: Any pawn
- **Action**: Move to position (8, 13) - Green's back rank
- **Result**: ✅ **Promotion triggered** - Player chooses promotion piece

## Implementation Details

### Code Changes

The promotion logic was updated in `functions/src/logic/pieceMoves.ts`:

```typescript
// OLD LOGIC (removed)
if (pieceColor === "r" && move.row === 6) {
  isPromotion = true; // Red promotes on row 6
} else if (pieceColor === "y" && move.row === 7) {
  isPromotion = true; // Yellow promotes on row 7
} else if (pieceColor === "b" && move.col === 7) {
  isPromotion = true; // Blue promotes on col 7
} else if (pieceColor === "g" && move.col === 6) {
  isPromotion = true; // Green promotes on col 6
}

// NEW LOGIC (implemented)
if (move.row === 0 && move.col >= 3 && move.col <= 10) {
  isPromotion = true; // Yellow's first rank (cols 3-10)
} else if (move.row === 13 && move.col >= 3 && move.col <= 10) {
  isPromotion = true; // Red's first rank (cols 3-10)
} else if (move.col === 0 && move.row >= 3 && move.row <= 10) {
  isPromotion = true; // Blue's first rank (rows 3-10)
} else if (move.col === 13 && move.row >= 3 && move.row <= 10) {
  isPromotion = true; // Green's first rank (rows 3-10)
}
```

### Integration

- ✅ **Promotion Modal**: Uses existing `PromotionModal` component
- ✅ **Game State**: Integrates with existing `promotionState` management
- ✅ **All Game Modes**: Works in solo, local, online, and P2P games
- ✅ **Move Validation**: Maintains all existing chess rules and validations

## Strategic Impact

### Benefits

1. **Increased Aggression**: Encourages pawn advancement toward opposing territories
2. **Tactical Depth**: Creates more opportunities for pawn promotion
3. **Game Balance**: Allows promotion on any opposing back rank
4. **Dynamic Play**: Adds new strategic considerations for pawn play

### Considerations

- Pawns can now promote much earlier in the game
- Defensive strategies need to account for opposing pawn advances
- Center control becomes more important for pawn advancement
- Endgame scenarios become more complex with multiple promotion opportunities

## Testing

The new promotion rule has been tested and verified to work correctly with:

- ✅ All four player colors (Red, Blue, Yellow, Green)
- ✅ Both capture and non-capture moves
- ✅ Existing promotion modal and piece selection
- ✅ Game state management and turn progression
- ✅ All game modes (solo, local, online, P2P)

## Visual Reference

The ✨ symbols in the board layout above indicate all possible promotion squares. Any pawn reaching these squares will trigger the promotion modal, allowing the player to choose their promoted piece.
