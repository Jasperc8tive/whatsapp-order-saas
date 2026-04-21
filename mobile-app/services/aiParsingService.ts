import { apiRequest } from "./apiClient";

export interface ParseMessageResult {
  draftId?: string;
  transcription?: string;
  items?: Array<{ name: string; quantity: number }>;
  confidence?: number;
}

export interface SmartReplyResult {
  reply: string;
}

export const aiParsingService = {
  async parseWhatsAppMessage(message: string, customerPhone: string): Promise<ParseMessageResult> {
    return apiRequest<ParseMessageResult>("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({
        action: "parse_message",
        message,
        customerPhone,
      }),
    });
  },

  async generateSmartReply(context: string): Promise<SmartReplyResult> {
    return apiRequest<SmartReplyResult>("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({
        action: "smart_reply",
        context,
      }),
    });
  },

  async parseVoiceMessage(
    audioBase64: string,
    mimeType: string,
    customerPhone?: string
  ): Promise<ParseMessageResult> {
    return apiRequest<ParseMessageResult>("/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({
        action: "parse_voice",
        audioBase64,
        mimeType,
        customerPhone,
      }),
    });
  },
};
