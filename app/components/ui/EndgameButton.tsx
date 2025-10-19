import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, endGame } from "../../../state";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";
import onlineGameService from "../../../services/onlineGameService";

export default function EndgameButton() {
  const dispatch = useDispatch();
  const [showEndgameModal, setShowEndgameModal] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
  }>();
  const { currentPlayerTurn, gameStatus, viewingHistoryIndex, gameMode } = useSelector(
    (state: RootState) => state.game
  );
  
  const isViewingHistory = viewingHistoryIndex !== null;
  
  // ✅ CRITICAL FIX: Show endgame button for local games, even if gameMode is "online" but not actually connected
  const isActuallyOnline = gameMode === "online" && onlineGameService.isConnected && gameId;
  const isLocalGame = gameMode === "solo" || gameMode === "single" || !isActuallyOnline;
  
  
  const canEndGame =
    !isViewingHistory &&
    (gameStatus === "active" ||
      gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus) &&
    // Show for local games (including online mode without actual connection)
    isLocalGame;


  const handleEndgamePress = () => {
    setShowEndgameModal(true);
  };

  const handleConfirmEndgame = async () => {
    try {
      // Dispatch the endgame action
      dispatch(endGame());
      
      // 🔊 Play game-end sound for endgame
      try {
        soundService.playGameEndSound();
      } catch (error) {
      }
      
      setShowEndgameModal(false);
    } catch (error) {
      console.error("Error ending game:", error);
    }
  };

  const handleCancelEndgame = () => {
    setShowEndgameModal(false);
  };

  if (!canEndGame) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleEndgamePress}
        style={{
          backgroundColor: 'rgba(255, 165, 0, 0.2)',
          borderWidth: 1,
          borderColor: 'rgba(255, 165, 0, 0.5)',
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginVertical: 4,
          alignItems: 'center',
          minWidth: 100,
        }}
      >
        <Text style={{
          color: '#FFA500',
          fontSize: 14,
          fontWeight: '600',
          fontFamily: 'SpaceMono-Regular',
        }}>
          ENDGAME
        </Text>
      </TouchableOpacity>

      {/* Endgame Confirmation Modal */}
      <Modal
        visible={showEndgameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelEndgame}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            minWidth: 280,
            maxWidth: 320,
          }}>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 16,
              textAlign: 'center',
              fontFamily: 'SpaceMono-Regular',
            }}>
              End Game?
            </Text>
            
            <Text style={{
              color: '#D1D5DB',
              fontSize: 14,
              marginBottom: 24,
              textAlign: 'center',
              lineHeight: 20,
            }}>
              This will end the current game and declare a winner based on current scores.
            </Text>

            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={handleCancelEndgame}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: 8,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  flex: 1,
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                  fontFamily: 'SpaceMono-Regular',
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmEndgame}
                style={{
                  backgroundColor: 'rgba(255, 165, 0, 0.2)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 165, 0, 0.5)',
                  borderRadius: 8,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  flex: 1,
                }}
              >
                <Text style={{
                  color: '#FFA500',
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                  fontFamily: 'SpaceMono-Regular',
                }}>
                  End Game
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
