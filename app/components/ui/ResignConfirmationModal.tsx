import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native";

interface ResignConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  playerName: string;
}

export default function ResignConfirmationModal({
  visible,
  onConfirm,
  onCancel,
  playerName,
}: ResignConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Resign Game</Text>
          <Text style={styles.message}>
            Are you sure you want to resign, {playerName}?
          </Text>
          <Text style={styles.warning}>
            This will eliminate you from the game.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Resign</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 24,
    width: width * 0.8,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 8,
  },
  warning: {
    fontSize: 14,
    color: "#F59E0B",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#374151",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  confirmButton: {
    backgroundColor: "#DC2626",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
