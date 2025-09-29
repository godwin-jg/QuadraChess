import { Platform } from 'react-native';

// Simple signaling service using network discovery for WebRTC handshake
class SimpleSignalingService {
  private static instance: SimpleSignalingService;
  private pendingOffers: Map<string, any> = new Map();
  private pendingAnswers: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): SimpleSignalingService {
    if (!SimpleSignalingService.instance) {
      SimpleSignalingService.instance = new SimpleSignalingService();
    }
    return SimpleSignalingService.instance;
  }

  // Store WebRTC offer for a game (host side)
  public storeOffer(gameId: string, offer: any, playerId: string, playerName: string): void {
    console.log(`📤 SimpleSignaling: Storing offer for game ${gameId} from ${playerName}`);
    
    this.pendingOffers.set(gameId, {
      offer: offer,
      playerId: playerId,
      playerName: playerName,
      timestamp: Date.now()
    });
  }

  // Get WebRTC offer for a game (host side)
  public getOffer(gameId: string): any {
    const offerData = this.pendingOffers.get(gameId);
    if (offerData) {
      console.log(`📥 SimpleSignaling: Retrieved offer for game ${gameId}`);
      this.pendingOffers.delete(gameId);
      return offerData;
    }
    return null;
  }

  // Store WebRTC answer for a game (client side)
  public storeAnswer(gameId: string, answer: any, playerId: string): void {
    console.log(`📤 SimpleSignaling: Storing answer for game ${gameId} from ${playerId}`);
    
    this.pendingAnswers.set(gameId, {
      answer: answer,
      playerId: playerId,
      timestamp: Date.now()
    });
  }

  // Get WebRTC answer for a game (client side)
  public getAnswer(gameId: string): any {
    const answerData = this.pendingAnswers.get(gameId);
    if (answerData) {
      console.log(`📥 SimpleSignaling: Retrieved answer for game ${gameId}`);
      this.pendingAnswers.delete(gameId);
      return answerData;
    }
    return null;
  }

  // Wait for offer (host side)
  public async waitForOffer(gameId: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForOffer = () => {
        const offerData = this.pendingOffers.get(gameId);
        if (offerData) {
          console.log(`✅ SimpleSignaling: Offer received for game ${gameId}`);
          this.pendingOffers.delete(gameId);
          resolve(offerData);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log(`⏰ SimpleSignaling: Timeout waiting for offer for game ${gameId}`);
          reject(new Error('Timeout waiting for offer'));
          return;
        }
        
        // Check again in 100ms
        setTimeout(checkForOffer, 100);
      };
      
      checkForOffer();
    });
  }

  // Wait for answer (client side)
  public async waitForAnswer(gameId: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForAnswer = () => {
        const answerData = this.pendingAnswers.get(gameId);
        if (answerData) {
          console.log(`✅ SimpleSignaling: Answer received for game ${gameId}`);
          this.pendingAnswers.delete(gameId);
          resolve(answerData);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log(`⏰ SimpleSignaling: Timeout waiting for answer for game ${gameId}`);
          reject(new Error('Timeout waiting for answer'));
          return;
        }
        
        // Check again in 100ms
        setTimeout(checkForAnswer, 100);
      };
      
      checkForAnswer();
    });
  }

  // Clean up old pending offers/answers
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    // Clean up old offers
    for (const [gameId, offerData] of this.pendingOffers.entries()) {
      if (now - offerData.timestamp > maxAge) {
        console.log(`🧹 SimpleSignaling: Cleaning up old offer for game ${gameId}`);
        this.pendingOffers.delete(gameId);
      }
    }
    
    // Clean up old answers
    for (const [gameId, answerData] of this.pendingAnswers.entries()) {
      if (now - answerData.timestamp > maxAge) {
        console.log(`🧹 SimpleSignaling: Cleaning up old answer for game ${gameId}`);
        this.pendingAnswers.delete(gameId);
      }
    }
  }
}

export default SimpleSignalingService.getInstance();
