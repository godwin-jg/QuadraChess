import React from "react";
import { View, Text, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Piece from "../board/Piece";
import { sw, sh, sf, isCompact } from "../../utils/responsive";

interface PlayerHUDPanelProps {
  players: Array<{
    name: string;
    color: string;
    score: number;
    capturedPieces: string[];
    isCurrentTurn: boolean;
    isEliminated: boolean;
    timeMs?: number;
    teamLabel?: string;
  }>;
  panelType: 'top' | 'bottom';
}

const PLAYER_COLORS: Record<string, string> = {
  r: "#DC2626", b: "#2563EB", y: "#7C3AED", g: "#16A34A"
};
const PLAYER_NAMES: Record<string, string> = {
  r: "Red", b: "Blue", y: "Purple", g: "Green"
};

const SCORE_ANIMATION = {
  spring: { damping: 10, stiffness: 100, mass: 1 },
  flashInMs: 100,
  flashOutMs: 300,
};

const TURN_TRANSITION_MS = 140;

const formatTime = (ms?: number) => {
  if (typeof ms !== "number") return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const TurnColorText = React.memo(function TurnColorText({
  isActive,
  activeColor,
  inactiveColor,
  style,
  children,
}: {
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: TURN_TRANSITION_MS });
  }, [isActive, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
  }), [activeColor, inactiveColor]);

  return <Animated.Text style={[style, animatedStyle]}>{children}</Animated.Text>;
});

const JuicyScore = React.memo(function JuicyScore({
  score,
  baseColor,
  playerColor,
  isEliminated,
}: {
  score: number;
  baseColor: string;
  playerColor: string;
  isEliminated: boolean;
}) {
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);
  const deltaProgress = useSharedValue(0);
  const prevScoreRef = React.useRef(score);
  const [delta, setDelta] = React.useState(0);

  React.useEffect(() => {
    const diff = score - prevScoreRef.current;
    if (diff > 0) {
      setDelta(diff);
      deltaProgress.value = 0;
      deltaProgress.value = withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(520, withTiming(0, { duration: 200 }))
      );
      scale.value = withSequence(
        withSpring(1.5, SCORE_ANIMATION.spring),
        withSpring(1, SCORE_ANIMATION.spring)
      );
      flash.value = withSequence(
        withTiming(1, { duration: SCORE_ANIMATION.flashInMs }),
        withTiming(0, { duration: SCORE_ANIMATION.flashOutMs })
      );
    } else {
      setDelta(0);
      deltaProgress.value = 0;
    }
    prevScoreRef.current = score;
  }, [score]);

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(flash.value, [0, 1], [baseColor, playerColor]);
    return {
      color,
      transform: [{ scale: scale.value }],
    };
  }, [baseColor, playerColor]);

  const deltaStyle = useAnimatedStyle(() => ({
    opacity: deltaProgress.value,
    transform: [
      { translateY: -8 * deltaProgress.value },
      { scale: 1 + 0.08 * deltaProgress.value },
    ],
  }));

  return (
    <View style={styles.scoreContainer}>
      {delta > 0 && (
        <Animated.Text
          key={`delta-${score}`}
          style={[styles.floatingDelta, deltaStyle]}
        >
          +{delta}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          styles.playerScore,
          { textDecorationLine: isEliminated ? "line-through" : "none" },
          animatedStyle,
        ]}
      >
        {score}
      </Animated.Text>
    </View>
  );
});

export default function PlayerHUDPanel({ players, panelType }: PlayerHUDPanelProps) {
  const c = isCompact; // compact mode flag
  
  return (
    <View style={[styles.panel, panelType === 'top' ? styles.topPanel : styles.bottomPanel]}>
      <View style={styles.playersContainer}>
        {players.map((player) => {
          const scoreColor = player.isEliminated
            ? "#9CA3AF"
            : player.score === 0
              ? "#9CA3AF"
              : "#FFFFFF";
          const playerColor = PLAYER_COLORS[player.color] || "#FFFFFF";
          const isActive = !player.isEliminated && player.isCurrentTurn;
          const nameActiveColor = player.isEliminated ? "#9CA3AF" : playerColor;
          const nameInactiveColor = player.isEliminated ? "#9CA3AF" : "#D1D5DB";
          const isLowTime = !player.isEliminated && (player.timeMs ?? 0) <= 10000;
          const timeActiveColor = player.isEliminated
            ? "#9CA3AF"
            : isLowTime
              ? "#F87171"
              : "#FFFFFF";
          const timeInactiveColor = player.isEliminated
            ? "#9CA3AF"
            : isLowTime
              ? "#F87171"
              : "#D1D5DB";
          const capturedActiveColor = player.isEliminated ? "#9CA3AF" : "#FFFFFF";
          const capturedInactiveColor = player.isEliminated ? "#9CA3AF" : "#D1D5DB";
          const smallActiveColor = player.isEliminated ? "#9CA3AF" : "#FFFFFF";
          const smallInactiveColor = player.isEliminated ? "#9CA3AF" : "#9CA3AF";
          return (
            <View key={player.color} style={styles.playerSection}>
              <View style={styles.playerInfo}>
              <TurnColorText
                isActive={isActive}
                activeColor={nameActiveColor}
                inactiveColor={nameInactiveColor}
                style={[
                  styles.playerName,
                  { textDecorationLine: player.isEliminated ? "line-through" : "none" },
                ]}
              >
                {PLAYER_NAMES[player.color] || "Unknown"}
              </TurnColorText>
              <TurnColorText
                isActive={isActive}
                activeColor={timeActiveColor}
                inactiveColor={timeInactiveColor}
                style={styles.playerTime}
              >
                {formatTime(player.timeMs)}
              </TurnColorText>
              {player.teamLabel && (
                <Text style={styles.teamLabel}>
                  {player.teamLabel}
                </Text>
              )}
              <JuicyScore
                score={player.score}
                baseColor={scoreColor}
                playerColor={playerColor}
                isEliminated={player.isEliminated}
              />
              {player.isEliminated && <Text style={styles.eliminatedText}>ELIMINATED</Text>}
            </View>

            <View style={styles.capturedSection}>
              <TurnColorText
                isActive={isActive}
                activeColor={capturedActiveColor}
                inactiveColor={capturedInactiveColor}
                style={styles.capturedLabel}
              >
                Captured
              </TurnColorText>
              <View style={styles.capturedPieces}>
                {player.capturedPieces.length > 0 ? (
                  player.capturedPieces.slice(0, 6).map((piece, i) => (
                    <Piece key={`${piece}-${i}`} piece={piece} size={sw(c ? 10 : 12)} />
                  ))
                ) : (
                  <TurnColorText
                    isActive={isActive}
                    activeColor={smallActiveColor}
                    inactiveColor={smallInactiveColor}
                    style={styles.smallText}
                  >
                    None
                  </TurnColorText>
                )}
                {player.capturedPieces.length > 6 && (
                  <TurnColorText
                    isActive={isActive}
                    activeColor={smallActiveColor}
                    inactiveColor={smallInactiveColor}
                    style={styles.smallText}
                  >
                    +{player.capturedPieces.length - 6}
                  </TurnColorText>
                )}
              </View>
            </View>
          </View>
          );
        })}
      </View>
    </View>
  );
}

const c = isCompact;
const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: sw(c ? 16 : 24),
    paddingVertical: sh(c ? 10 : 16),
    marginHorizontal: sw(12),
    marginVertical: sh(6),
  },
  topPanel: {
    borderTopWidth: 0,
    borderBottomLeftRadius: sw(16),
    borderBottomRightRadius: sw(16),
    marginTop: 0,
  },
  bottomPanel: {
    borderBottomWidth: 0,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    marginBottom: 0,
  },
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sw(c ? 16 : 24),
  },
  playerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: sw(c ? 8 : 12),
    paddingVertical: sh(c ? 4 : 8),
  },
  playerInfo: {
    alignItems: 'center',
    marginBottom: sh(c ? 4 : 8),
    overflow: 'visible',
  },
  playerName: {
    fontSize: sf(c ? 13 : 16),
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: sh(4),
  },
  playerScore: {
    fontSize: sf(c ? 20 : 24),
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: sw(c ? 34 : 40),
    height: sh(c ? 24 : 30),
    position: 'relative',
    overflow: 'visible',
  },
  floatingDelta: {
    position: 'absolute',
    top: -sh(c ? 10 : 12),
    fontSize: sf(c ? 16 : 20),
    fontWeight: '900',
    color: '#FACC15',
  },
  playerTime: {
    fontSize: sf(c ? 11 : 13),
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: sh(4),
  },
  teamLabel: {
    fontSize: sf(c ? 9 : 11),
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: sh(2),
  },
  eliminatedText: {
    fontSize: sf(c ? 9 : 11),
    color: '#F87171',
    fontWeight: '600',
    marginTop: sh(4),
  },
  capturedSection: {
    alignItems: 'center',
    height: sh(c ? 38 : 50),
  },
  capturedLabel: {
    fontSize: sf(c ? 10 : 12),
    fontWeight: '600',
    letterSpacing: 1.0,
    marginBottom: sh(4),
  },
  capturedPieces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(2),
    maxWidth: sw(c ? 80 : 100),
    height: sh(c ? 24 : 30),
  },
  smallText: {
    fontSize: sf(c ? 9 : 11),
    fontStyle: 'italic',
  },
});
