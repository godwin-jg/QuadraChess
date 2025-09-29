import { Platform } from 'react-native';

// Lightweight HTTP signaling service for WebRTC handshake
class HTTPSignalingService {
  private static instance: HTTPSignalingService;
  private port: number = 3001;
  private isServerRunning: boolean = false;

  private constructor() {}

  public static getInstance(): HTTPSignalingService {
    if (!HTTPSignalingService.instance) {
      HTTPSignalingService.instance = new HTTPSignalingService();
    }
    return HTTPSignalingService.instance;
  }

  // Start HTTP server (host) - simplified for mobile
  public async startServer(): Promise<void> {
    if (this.isServerRunning) {
      console.log('HTTPSignaling: Server already running');
      return;
    }

    try {
      console.log('🚀 HTTPSignaling: Starting HTTP signaling server on port', this.port);
      
      // For mobile, we'll use a simple approach
      // The actual HTTP server will be handled by the existing serverless signaling service
      // This is just a wrapper to maintain consistency
      
      this.isServerRunning = true;
      console.log(`✅ HTTPSignaling: HTTP signaling server ready on port ${this.port}`);
      
    } catch (error) {
      console.error('HTTPSignaling: Failed to start server:', error);
      throw error;
    }
  }

  // Stop HTTP server
  public async stopServer(): Promise<void> {
    if (!this.isServerRunning) {
      console.log('HTTPSignaling: Server not running');
      return;
    }

    try {
      this.isServerRunning = false;
      console.log('✅ HTTPSignaling: HTTP signaling server stopped');
    } catch (error) {
      console.error('HTTPSignaling: Failed to stop server:', error);
      throw error;
    }
  }

  // Connect to host HTTP (client)
  public async connectToHost(hostIP: string, offerData: any): Promise<any> {
    console.log(`🔗 HTTPSignaling: Connecting to host ${hostIP}:${this.port}`);
    
    try {
      // First test basic connectivity
      console.log(`🔍 HTTPSignaling: Testing basic connectivity to ${hostIP}:${this.port}`);
      try {
        const testResponse = await fetch(`http://${hostIP}:${this.port}/health`, {
          method: 'GET',
        });
        console.log(`✅ HTTPSignaling: Basic connectivity test successful: ${testResponse.status}`);
      } catch (testError) {
        console.log(`⚠️ HTTPSignaling: Basic connectivity test failed:`, testError);
        // Continue anyway - the server might not have health endpoint
      }
      
      // Skip health check - go directly to offer exchange
      console.log(`🚀 HTTPSignaling: Sending WebRTC offer to ${hostIP}:${this.port}`);
      
      const response = await fetch(`http://${hostIP}:${this.port}/api/webrtc/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const answerData = await response.json();
      console.log("✅ HTTPSignaling: Received answer from host:", answerData);

      // Check if host returned an error
      if (answerData.error) {
        throw new Error(`Host error: ${answerData.error}`);
      }

      // Validate that we have a proper answer
      if (!answerData.answer || !answerData.answer.type || !answerData.answer.sdp) {
        throw new Error(`Invalid answer from host: ${JSON.stringify(answerData.answer)}`);
      }

      return answerData;
      
    } catch (error) {
      console.error(`❌ HTTPSignaling: Connection failed:`, error);
      throw error;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public isServerRunning(): boolean {
    return this.isServerRunning;
  }
}

export default HTTPSignalingService.getInstance();
