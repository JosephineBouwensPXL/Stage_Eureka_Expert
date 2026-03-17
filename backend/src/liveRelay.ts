import type { Server as HttpServer, IncomingMessage } from "http";
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";

type StartMessage = {
  type: "start";
  systemInstruction: string;
  ttsEnabled: boolean;
  fileSearchStoreName?: string;
};

type AudioMessage = {
  type: "audio";
  data: string;
  mimeType: string;
};

type CloseMessage = {
  type: "close";
};

type RelayMessage = StartMessage | AudioMessage | CloseMessage;

type RelayConfig = {
  server: HttpServer;
  isProduction: boolean;
  allowedOrigins: string[];
};

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isAllowedOrigin(req: IncomingMessage, isProduction: boolean, allowedOrigins: string[]) {
  const origin = (req.headers.origin ?? "").toString();
  if (!origin) return !isProduction;
  if (!isProduction && allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const parsed = JSON.parse(raw) as { type?: string };
    if (parsed.type === "start") return parsed as StartMessage;
    if (parsed.type === "audio") return parsed as AudioMessage;
    if (parsed.type === "close") return parsed as CloseMessage;
    return null;
  } catch {
    return null;
  }
}

export function attachNativeVoiceRelay(config: RelayConfig): void {
  const wss = new WebSocketServer({
    server: config.server,
    path: "/ws/native-voice",
  });

  wss.on("connection", (ws, req) => {
    if (!isAllowedOrigin(req, config.isProduction, config.allowedOrigins)) {
      ws.close(1008, "Origin not allowed");
      return;
    }

    let closed = false;
    let ttsEnabled = true;
    let session: any = null;

    const shutdown = () => {
      if (closed) return;
      closed = true;
      try {
        session?.close();
      } catch {
        // no-op
      }
      session = null;
    };

    ws.on("message", async (rawData: Buffer) => {
      const raw = rawData.toString("utf8");
      const message = parseRelayMessage(raw);
      if (!message) {
        sendJson(ws, { type: "error", message: "Invalid relay message" });
        return;
      }

      if (message.type === "start") {
        if (session) return;
        ttsEnabled = Boolean(message.ttsEnabled);
        const geminiApiKey = (process.env.GEMINI_API_KEY ?? "").trim();
        if (!geminiApiKey) {
          sendJson(ws, { type: "error", message: "GEMINI_API_KEY ontbreekt op de backend." });
          return;
        }

        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const liveModel = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025";
        const liveVoiceName = process.env.GEMINI_LIVE_VOICE ?? "Puck";

        try {
          session = await ai.live.connect({
            model: liveModel,
            callbacks: {
              onopen: () => sendJson(ws, { type: "open" }),
              onmessage: (serverMessage: LiveServerMessage) => {
                if (serverMessage.serverContent?.outputTranscription) {
                  sendJson(ws, {
                    type: "output_transcription",
                    text: serverMessage.serverContent.outputTranscription.text,
                  });
                } else if (serverMessage.serverContent?.inputTranscription) {
                  sendJson(ws, {
                    type: "input_transcription",
                    text: serverMessage.serverContent.inputTranscription.text,
                  });
                }

                if (serverMessage.serverContent?.turnComplete) {
                  sendJson(ws, { type: "turn_complete" });
                }

                const base64Audio = serverMessage.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio && ttsEnabled) {
                  sendJson(ws, { type: "audio_chunk", data: base64Audio });
                }

                if (serverMessage.serverContent?.interrupted) {
                  sendJson(ws, { type: "interrupted" });
                }
              },
              onerror: (error: unknown) =>
                sendJson(ws, { type: "error", message: `Gemini relay error: ${toErrorMessage(error)}` }),
              onclose: () => sendJson(ws, { type: "closed" }),
            },
            config: {
              responseModalities: ttsEnabled ? [Modality.AUDIO] : [Modality.TEXT],
              ...(ttsEnabled
                ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoiceName } } } }
                : {}),
              ...(message.fileSearchStoreName
                ? {
                    tools: [
                      {
                        fileSearch: {
                          fileSearchStoreNames: [message.fileSearchStoreName],
                          topK: 8,
                        },
                      },
                    ],
                  }
                : {}),
              systemInstruction: message.systemInstruction,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          });
        } catch (error) {
          sendJson(ws, { type: "error", message: `Gemini live connect failed: ${toErrorMessage(error)}` });
          shutdown();
        }
        return;
      }

      if (message.type === "audio") {
        if (!session) return;
        try {
          session.sendRealtimeInput({
            media: {
              data: message.data,
              mimeType: message.mimeType,
            },
          });
        } catch (error) {
          sendJson(ws, { type: "error", message: `Audio relay failed: ${toErrorMessage(error)}` });
        }
        return;
      }

      if (message.type === "close") {
        shutdown();
        if (ws.readyState === WebSocket.OPEN) ws.close(1000, "client closed");
      }
    });

    ws.on("error", () => {
      shutdown();
    });

    ws.on("close", () => {
      shutdown();
    });
  });
}
