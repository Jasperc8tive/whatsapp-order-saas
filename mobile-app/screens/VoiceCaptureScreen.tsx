import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { useThemeColors } from "../lib/theme";
import { aiParsingService } from "../services/aiParsingService";

export function VoiceCaptureScreen() {
  const colors = useThemeColors();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [transcription, setTranscription] = useState("");
  const [parseSummary, setParseSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission denied", "Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (error) {
      Alert.alert("Recording error", (error as Error).message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setLoading(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert("Recording error", "Could not access recorded audio file.");
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await aiParsingService.parseVoiceMessage(base64, "audio/m4a", customerPhone.trim() || undefined);
      setTranscription(result.transcription ?? "");
      setParseSummary(`Confidence: ${(result.confidence ?? 0).toFixed(2)} | Items: ${result.items?.length ?? 0}`);
      Alert.alert("Voice parsed", "Draft captured successfully.");
    } catch (error) {
      Alert.alert("Parse failed", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Voice order capture</Text>
      <Text style={{ color: colors.mutedText }}>
        Record a WhatsApp-like voice note, transcribe it server-side, and parse into order draft items.
      </Text>
      <AppInput
        label="Customer phone (optional)"
        value={customerPhone}
        onChangeText={setCustomerPhone}
        keyboardType="phone-pad"
      />
      <View style={styles.row}>
        <AppButton title={recording ? "Recording..." : "Start recording"} onPress={startRecording} disabled={!!recording || loading} />
        <AppButton title={loading ? "Processing..." : "Stop & parse"} variant="secondary" onPress={stopRecording} disabled={!recording || loading} />
      </View>
      {!!transcription && <Text style={{ color: colors.text }}>Transcription: {transcription}</Text>}
      {!!parseSummary && <Text style={{ color: colors.mutedText }}>{parseSummary}</Text>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
});
