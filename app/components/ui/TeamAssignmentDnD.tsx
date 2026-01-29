import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, LayoutRectangle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

type PlayerColor = "r" | "b" | "y" | "g";
type TeamId = "A" | "B";
type TeamAssignments = Record<PlayerColor, TeamId>;

interface PlayerInfo {
  color: PlayerColor;
  name?: string;
  isBot?: boolean;
}

interface TeamAssignmentDnDProps {
  teamAssignments: TeamAssignments;
  players?: PlayerInfo[];
  onAssignmentChange: (newAssignments: TeamAssignments) => void;
  disabled?: boolean;
}

const COLOR_CONFIG: Record<PlayerColor, { bg: string; label: string; border: string }> = {
  r: { bg: "#ef4444", label: "Red", border: "#dc2626" },
  b: { bg: "#3b82f6", label: "Blue", border: "#2563eb" },
  y: { bg: "#a855f7", label: "Purple", border: "#9333ea" },
  g: { bg: "#22c55e", label: "Green", border: "#16a34a" },
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

interface DraggablePlayerChipProps {
  color: PlayerColor;
  playerName: string;
  currentTeam: TeamId;
  teamABounds: LayoutRectangle | null;
  teamBBounds: LayoutRectangle | null;
  containerBounds: LayoutRectangle | null;
  onTeamChange: (color: PlayerColor, newTeam: TeamId) => void;
  disabled?: boolean;
}

const DraggablePlayerChip: React.FC<DraggablePlayerChipProps> = ({
  color,
  playerName,
  currentTeam,
  teamABounds,
  teamBBounds,
  containerBounds,
  onTeamChange,
  disabled = false,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const config = COLOR_CONFIG[color];

  const handleDrop = useCallback(
    (x: number) => {
      if (!containerBounds || !teamABounds || !teamBBounds) return;

      // Calculate drop position relative to container
      const containerMidX = containerBounds.width / 2;
      
      // Determine which team based on x position
      const newTeam: TeamId = x < containerMidX ? "A" : "B";
      
      if (newTeam !== currentTeam) {
        onTeamChange(color, newTeam);
      }
    },
    [containerBounds, teamABounds, teamBBounds, currentTeam, color, onTeamChange]
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.1, SPRING_CONFIG);
      zIndex.value = 100;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 1;

      // Calculate absolute X position for drop detection
      const absoluteX = event.absoluteX;
      runOnJS(handleDrop)(absoluteX);

      // Animate back to origin
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: isDragging.value ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.playerChip, animatedStyle]}>
        <View style={[styles.colorDot, { backgroundColor: config.bg }]} />
        <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
          {playerName}
        </Text>
        {!disabled && (
          <View style={styles.dragHandle}>
            <Text style={styles.dragHandleText}>⋮⋮</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const TeamAssignmentDnD: React.FC<TeamAssignmentDnDProps> = ({
  teamAssignments,
  players = [],
  onAssignmentChange,
  disabled = false,
}) => {
  const containerBounds = useSharedValue<LayoutRectangle | null>(null);
  const teamABounds = useSharedValue<LayoutRectangle | null>(null);
  const teamBBounds = useSharedValue<LayoutRectangle | null>(null);

  const [containerLayout, setContainerLayout] = React.useState<LayoutRectangle | null>(null);
  const [teamALayout, setTeamALayout] = React.useState<LayoutRectangle | null>(null);
  const [teamBLayout, setTeamBLayout] = React.useState<LayoutRectangle | null>(null);

  const teamAPlayers = useMemo(() => {
    return (["r", "b", "y", "g"] as PlayerColor[]).filter(
      (c) => teamAssignments[c] === "A"
    );
  }, [teamAssignments]);

  const teamBPlayers = useMemo(() => {
    return (["r", "b", "y", "g"] as PlayerColor[]).filter(
      (c) => teamAssignments[c] === "B"
    );
  }, [teamAssignments]);

  const getPlayerName = useCallback(
    (color: PlayerColor): string => {
      const player = players.find((p) => p.color === color);
      if (!player) return COLOR_CONFIG[color].label;
      if (player.isBot) return `Bot ${COLOR_CONFIG[color].label}`;
      return player.name || COLOR_CONFIG[color].label;
    },
    [players]
  );

  const handleTeamChange = useCallback(
    (color: PlayerColor, newTeam: TeamId) => {
      const newAssignments = { ...teamAssignments, [color]: newTeam };
      onAssignmentChange(newAssignments);
    },
    [teamAssignments, onAssignmentChange]
  );

  const handleContainerLayout = useCallback((event: { nativeEvent: { layout: LayoutRectangle } }) => {
    const layout = event.nativeEvent.layout;
    containerBounds.value = layout;
    setContainerLayout(layout);
  }, []);

  const handleTeamALayout = useCallback((event: { nativeEvent: { layout: LayoutRectangle } }) => {
    const layout = event.nativeEvent.layout;
    teamABounds.value = layout;
    setTeamALayout(layout);
  }, []);

  const handleTeamBLayout = useCallback((event: { nativeEvent: { layout: LayoutRectangle } }) => {
    const layout = event.nativeEvent.layout;
    teamBBounds.value = layout;
    setTeamBLayout(layout);
  }, []);

  const renderPlayerChip = useCallback(
    (color: PlayerColor, team: TeamId) => (
      <DraggablePlayerChip
        key={color}
        color={color}
        playerName={getPlayerName(color)}
        currentTeam={team}
        teamABounds={teamALayout}
        teamBBounds={teamBLayout}
        containerBounds={containerLayout}
        onTeamChange={handleTeamChange}
        disabled={disabled}
      />
    ),
    [getPlayerName, teamALayout, teamBLayout, containerLayout, handleTeamChange, disabled]
  );

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {/* Team Red - Left */}
      <View style={styles.teamColumn} onLayout={handleTeamALayout}>
        <View style={[styles.teamHeader, styles.teamRedHeader]}>
          <Text style={styles.teamHeaderText}>Red</Text>
        </View>
        <View style={[styles.teamDropZone, styles.teamRedDropZone]}>
          {teamAPlayers.length === 0 ? (
            <Text style={styles.emptyText}>Drop here</Text>
          ) : (
            teamAPlayers.map((color) => renderPlayerChip(color, "A"))
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Team Blue - Right */}
      <View style={styles.teamColumn} onLayout={handleTeamBLayout}>
        <View style={[styles.teamHeader, styles.teamBlueHeader]}>
          <Text style={styles.teamHeaderText}>Blue</Text>
        </View>
        <View style={[styles.teamDropZone, styles.teamBlueDropZone]}>
          {teamBPlayers.length === 0 ? (
            <Text style={styles.emptyText}>Drop here</Text>
          ) : (
            teamBPlayers.map((color) => renderPlayerChip(color, "B"))
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  teamColumn: {
    flex: 1,
    minHeight: 120,
  },
  teamHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  teamRedHeader: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  teamBlueHeader: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  teamHeaderText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  teamDropZone: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
    padding: 8,
    minHeight: 80,
    justifyContent: "flex-start",
    gap: 6,
  },
  teamRedDropZone: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  teamBlueDropZone: {
    borderColor: "rgba(59, 130, 246, 0.3)",
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
  divider: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  vsText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
    fontWeight: "600",
    paddingVertical: 8,
  },
  playerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  playerName: {
    color: "#ffffff",
    fontSize: 13,
    flex: 1,
  },
  dragHandle: {
    paddingLeft: 8,
  },
  dragHandleText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
    letterSpacing: -2,
  },
});

export default TeamAssignmentDnD;
