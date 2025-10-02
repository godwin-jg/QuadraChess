/**
 * Capture Animation Service
 * 
 * This service allows bot moves to trigger capture animations
 * by providing a way to communicate with the UI layer.
 * 
 * Reuses the exact same logic as human player captures in Board.tsx
 */

import { Dimensions } from 'react-native';

interface CaptureAnimationCallback {
  (points: number, boardX: number, boardY: number, playerColor: string): void;
}

class CaptureAnimationService {
  private captureCallback: CaptureAnimationCallback | null = null;

  /**
   * Register a callback function to trigger capture animations
   * This should be called from the GameScreen component
   */
  setCaptureCallback(callback: CaptureAnimationCallback) {
    this.captureCallback = callback;
  }

  /**
   * Calculate points for a captured piece
   * Extracted from Board.tsx lines 260-282
   */
  private calculateCapturePoints(capturedPiece: string): number {
    const capturedPieceType = capturedPiece[1];
    let points = 0;
    switch (capturedPieceType) {
      case "P": // Pawn
        points = 1;
        break;
      case "N": // Knight
        points = 3;
        break;
      case "B": // Bishop
      case "R": // Rook
        points = 5;
        break;
      case "Q": // Queen
        points = 9;
        break;
      case "K": // King
        points = 0; // Kings cannot be captured - should be checkmated instead
        break;
      default:
        points = 0;
    }
    return points;
  }

  /**
   * Calculate screen coordinates for capture animation
   * Extracted from Board.tsx lines 285-286
   */
  private calculateCaptureCoordinates(row: number, col: number): { boardX: number, boardY: number } {
    const { width } = Dimensions.get('window');
    const boardSize = Math.min(width * 0.98, 600);
    const squareSize = boardSize / 14;
    
    const boardX = (col * squareSize) + (squareSize / 2);
    const boardY = (row * squareSize) + (squareSize / 2);
    
    return { boardX, boardY };
  }

  /**
   * Trigger a capture animation for bot moves
   * Reuses the exact same logic as human player captures in Board.tsx
   */
  triggerCaptureAnimation(
    capturedPiece: string, 
    row: number, 
    col: number, 
    playerColor: string
  ) {
    if (this.captureCallback) {
      // Use the exact same logic as Board.tsx lines 260-290
      const points = this.calculateCapturePoints(capturedPiece);
      const { boardX, boardY } = this.calculateCaptureCoordinates(row, col);
      
      this.captureCallback(points, boardX, boardY, playerColor);
    } else {
      console.warn('Capture animation callback not set. Animation will not be displayed.');
    }
  }

  /**
   * Clear the capture callback (for cleanup)
   */
  clearCallback() {
    this.captureCallback = null;
  }

  /**
   * Check if capture animations are available
   */
  isAvailable(): boolean {
    return this.captureCallback !== null;
  }
}

// Export singleton instance
export const captureAnimationService = new CaptureAnimationService();
export default captureAnimationService;
