import { Alert } from "react-native";
import onlineGameService from "./onlineGameService";
import networkService from "../app/services/networkService";

export interface ModeSwitchOptions {
  currentMode: "online" | "local" | "solo";
  targetMode: "online" | "local" | "solo";
  onConfirm: () => void;
  onCancel: () => void;
}

class ModeSwitchService {
  private isCurrentlyInGame(): boolean {
    // Check if currently in an online game
    if (onlineGameService.isConnected && onlineGameService.currentGameId) {
      return true;
    }

    // Check if currently in a local network game
    if (networkService.connected && networkService.roomId) {
      return true;
    }

    return false;
  }

  private getCurrentMode(): "online" | "local" | "solo" {
    if (onlineGameService.isConnected && onlineGameService.currentGameId) {
      return "online";
    }
    if (networkService.connected && networkService.roomId) {
      return "local";
    }
    return "solo";
  }

  async handleModeSwitch(
    targetMode: "online" | "local" | "solo",
    onConfirm: () => void,
    onCancel: () => void
  ): Promise<void> {
    const currentMode = this.getCurrentMode();

    // If already in the target mode, no need to switch
    if (currentMode === targetMode) {
      onConfirm();
      return;
    }

    // If not currently in a game, allow switch without warning
    if (!this.isCurrentlyInGame()) {
      onConfirm();
      return;
    }

    // Show warning for any mode switch that will lose current game
    if (this.isCurrentlyInGame()) {
      Alert.alert(
        `Switch to ${this.getModeDisplayName(targetMode)}?`,
        this.getWarningMessage(currentMode, targetMode),
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: onCancel,
          },
          {
            text: "Switch Anyway",
            style: "destructive",
            onPress: async () => {
              // Disconnect FIRST, then confirm
              await this.disconnectFromCurrentGame();
              // Add a small delay to ensure disconnection is complete
              setTimeout(() => {
                onConfirm();
              }, 100);
            },
          },
        ]
      );
    } else {
      onConfirm();
    }
  }

  private getModeDisplayName(mode: string): string {
    switch (mode) {
      case "online":
        return "Online Multiplayer";
      case "local":
        return "Local Multiplayer";
      case "solo":
        return "Solo Play";
      default:
        return mode;
    }
  }

  private getWarningMessage(currentMode: string, targetMode: string): string {
    const currentModeName = this.getModeDisplayName(currentMode);
    const targetModeName = this.getModeDisplayName(targetMode);

    if (currentMode === "online") {
      return `You are currently in an online multiplayer game. Switching to ${targetModeName} will disconnect you from the online game and you will lose your current progress.`;
    } else if (currentMode === "local") {
      return `You are currently in a local multiplayer game. Switching to ${targetModeName} will disconnect you from the local game and you will lose your current progress.`;
    } else if (currentMode === "solo") {
      return `You are currently in a solo game. Switching to ${targetModeName} will reset your current game and you will lose your progress.`;
    }
    return `Switching from ${currentModeName} to ${targetModeName} will reset your current game.`;
  }

  private async disconnectFromCurrentGame(): Promise<void> {
    try {
      // Disconnect from online game if connected
      if (onlineGameService.isConnected && onlineGameService.currentGameId) {
        console.log("Disconnecting from online game due to mode switch");
        await onlineGameService.disconnect();
      }

      // Disconnect from local network game if connected
      if (networkService.connected && networkService.roomId) {
        console.log("Disconnecting from local game due to mode switch");
        networkService.leaveGame();
        networkService.disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting from current game:", error);
      // Continue with mode switch even if disconnection fails
    }
  }
}

export default new ModeSwitchService();
