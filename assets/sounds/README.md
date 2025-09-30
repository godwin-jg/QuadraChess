# QuadChess Sound Effects

This folder contains sound effects for the QuadChess game. Add the following sound files with these exact names:

## Required Sound Files:

### Game Events:
- **`game-start.mp3`** - Sound when the game starts
- **`game-end.mp3`** - Sound when the game ends (checkmate)
- **`move.mp3`** - Sound when moving a piece (gentle, short)
- **`capture.mp3`** - Sound when capturing an opponent's piece
- **`castle.mp3`** - Sound when castling
- **`check.mp3`** - Sound when putting opponent in check (warning tone)
- **`stalemate.mp3`** - Sound when a player is stalemated (neutral ending sound)
- **`promote.mp3`** - Sound when promoting a piece
- **`illegal.mp3`** - Sound for illegal moves
- **`notify.mp3`** - General notification sound
- **`tenseconds.mp3`** - Sound when 10 seconds left on clock (for future implementation)

### UI Interactions:
- **`button.mp3`** - Sound when pressing general buttons
- **`button-button-only-homescreen.mp3`** - Sound for home screen buttons only
- **`toggle-toggle.mp3`** - Sound when toggling switches
- **`error.mp3`** - Sound for errors (warning/error tone)
- **`success-notify.mp3`** - Sound for successful actions (positive confirmation)

## File Format Requirements:
- **Format**: MP3 (preferred) or WAV
- **Duration**: Keep sounds short (0.1-0.5 seconds)
- **Volume**: Normalized volume levels
- **Quality**: 44.1kHz sample rate recommended

## Sound Characteristics:

### Game Events:
- **Move**: Gentle, subtle tone (~150ms)
- **Capture**: More pronounced than move (~200ms)
- **Castle**: Special sound for castling (~200ms)
- **Check**: Warning-like tone (~300ms)
- **Game End/Checkmate**: Victory/elimination sound (~500ms)
- **Promote**: Special sound for promotion (~200ms)
- **Illegal**: Error/warning sound (~250ms)

### UI Events:
- **Button**: Short click/tap (~100ms)
- **Toggle**: Soft click (~80ms)
- **Error**: Warning tone (~250ms)
- **Success**: Positive confirmation (~300ms)

## After Adding Files:
Once you add the sound files, the sound service will automatically detect and use them instead of haptic feedback.
