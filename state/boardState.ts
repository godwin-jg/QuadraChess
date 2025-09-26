// Initial board state - exact same 14x14 array from Board.tsx
//
// PROMOTION RULE: Pawns promote when reaching:
// 1. OPPOSING player's first rank (new universal rule):
//    - Yellow's first rank (row 0, cols 3-10): ✨ Red, Blue, Green pawns promote here (NOT Yellow)
//    - Red's first rank (row 13, cols 3-10): ✨ Yellow, Blue, Green pawns promote here (NOT Red)
//    - Blue's first rank (col 0, rows 3-10): ✨ Red, Yellow, Green pawns promote here (NOT Blue)
//    - Green's first rank (col 13, rows 3-10): ✨ Red, Yellow, Blue pawns promote here (NOT Green)
// 2. Traditional promotion ranks (old rule):
//    - Red pawns promote on row 6
//    - Yellow pawns promote on row 7
//    - Blue pawns promote on col 7
//    - Green pawns promote on col 6
//
// VISUAL REFERENCE - Promotion ranks marked with ✨:
// [
//   [null, null, null, "✨", "✨", "✨", "✨", "✨", "✨", "✨", "✨", null, null, null], // 0 - Yellow's back rank
//   [null, null, null, "yP", "yP", "yP", "yP", "yP", "yP", "yP", "yP", null, null, null], // 1
//   [null, null, null, null, null, null, null, null, null, null, null, null, null, null], // 2
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 3
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 4
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 5
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 6
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 7
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 8
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 9
//   ["✨", "bP", null, null, null, null, null, null, null, null, null, null, "gP", "✨"], // 10
//   [null, null, null, null, null, null, null, null, null, null, null, null, null, null], // 11
//   [null, null, null, "rP", "rP", "rP", "rP", "rP", "rP", "rP", "rP", null, null, null], // 12
//   [null, null, null, "✨", "✨", "✨", "✨", "✨", "✨", "✨", "✨", null, null, null], // 13 - Red's back rank
// ]
//
export const initialBoardState = [
  // 0    1     2     3     4     5     6     7     8     9     10    11    12    13
  [
    null,
    null,
    null,
    "yR",
    "yN",
    "yB",
    "yK",
    "yQ",
    "yB",
    "yN",
    "yR",
    null,
    null,
    null,
  ], // 0
  [
    null,
    null,
    null,
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    null,
    null,
    null,
  ], // 1
  [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ], // 2 - Empty Buffer Row
  [
    "bR",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gR",
  ], // 3
  [
    "bN",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gN",
  ], // 4
  [
    "bB",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gB",
  ], // 5
  [
    "bQ",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gK",
  ], // 6 - Kings/Queens corrected for Blue/Green
  [
    "bK",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gQ",
  ], // 7
  [
    "bB",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gB",
  ], // 8
  [
    "bN",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gN",
  ], // 9
  [
    "bR",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gR",
  ], // 10
  [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ], // 11 - Empty Buffer Row
  [
    null,
    null,
    null,
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    null,
    null,
    null,
  ], // 12
  [
    null,
    null,
    null,
    "rR",
    "rN",
    "rB",
    "rQ",
    "rK",
    "rB",
    "rN",
    "rR",
    null,
    null,
    null,
  ], // 13
];
