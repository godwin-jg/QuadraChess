// Game cleanup service for abandoned games
import realtimeDatabaseService from "./realtimeDatabaseService";

class GameCleanupService {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;

    console.log("Starting game cleanup service...");
    this.isRunning = true;

    // Run cleanup every 10 minutes
    this.cleanupInterval = setInterval(
      async () => {
        try {
          await this.cleanupAllGames();
        } catch (error) {
          console.error("Error in periodic game cleanup:", error);
        }
      },
      10 * 60 * 1000
    ); // 10 minutes

    // Run initial cleanup after 1 minute
    setTimeout(async () => {
      try {
        await this.cleanupAllGames();
      } catch (error) {
        console.error("Error in initial game cleanup:", error);
      }
    }, 60 * 1000); // 1 minute
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log("Game cleanup service stopped");
  }

  private async cleanupAllGames(): Promise<void> {
    try {
      console.log("Running periodic game cleanup...");

      // Clean up Realtime Database games
      await realtimeDatabaseService.cleanupAbandonedGames();

      console.log("Periodic game cleanup completed");
    } catch (error) {
      console.error("Error in game cleanup:", error);
    }
  }

  // Manual cleanup trigger
  async cleanupNow(): Promise<void> {
    await this.cleanupAllGames();
  }
}

const cleanupService = new GameCleanupService();
cleanupService.start();

export default cleanupService;
