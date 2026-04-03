import { Alert, type AlertButton } from "react-native";

import { toUserFacingError } from "./userFacingError";

export function showAlert(title: string, message: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons);
}

export function showInfo(title: string, message: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons);
}

export function showSuccess(title: string, message: string, buttons?: AlertButton[]) {
  Alert.alert(title, message, buttons);
}

export function showErrorAlert(title: string, error: unknown, fallback: string) {
  Alert.alert(title, toUserFacingError(error, fallback));
}

export function showLoadError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showSaveError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showUpdateError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showSendError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showCreateError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showStartError(title: string, error: unknown, fallback: string) {
  showErrorAlert(title, error, fallback);
}

export function showConfirmDeletion(message: string, onConfirm: () => void | Promise<void>, confirmText = "Delete") {
  Alert.alert("Confirm deletion", message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmText,
      style: "destructive",
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
