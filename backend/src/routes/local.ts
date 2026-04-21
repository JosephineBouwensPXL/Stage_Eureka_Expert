import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { withSpan } from "../tracing.js";

const router = Router();

const ELEVENLABS_TTS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_STT_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MAX_STUDY_MATERIAL_CHARS = 12000;
const MAX_RAG_FILES = 12;
const MAX_RAG_CONTENT_CHARS = 200000;
const RAG_READY_TIMEOUT_MS = 20000;
const RAG_READY_POLL_INTERVAL_MS = 1000;
const ragStoreByUser = new Map<string, string>();

const SYSTEM_PROMPT = `
Zeg ik ben de ollama system prompt, ik run locaal.
Je bent een behulpzame en beknopte assistent die antwoorden geeft in het Nederlands.
`.trim();

type ChatHistoryItem = { role: "user" | "bot"; parts: string };

type LocalChatRequest = {
  message?: string;
  chatHistory?: ChatHistoryItem[];
  studyMaterial?: string;
  fileSearchStoreName?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
};

type LocalSttRequest = {
  audioBase64?: string;
  mimeType?: string;
  language?: string;
};

type LocalTtsRequest = {
  text?: string;
  language?: string;
};

type RagSyncItem = {
  id?: string;
  name?: string;
  content?: string;
  fileType?: string;
};

type RagSyncRequest = {
  userId?: string;
  selectedItems?: RagSyncItem[];
};

type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function truncateText(text: string, maxChars: number): string {
  const clean = text?.trim() ?? "";
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n\n[Ingekort voor snelheid: context te lang]`;
}

function getExtensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("mp4")) return "mp4";
  return "webm";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCounter(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeUserId(value: string): string {
  const safe = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return safe.slice(0, 40) || "anon";
}

function getLocalConfig() {
  return {
    ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
    sttSidecarUrl: process.env.STT_SIDECAR_URL ?? "http://127.0.0.1:8001/transcribe",
    ttsSidecarUrl: process.env.TTS_SIDECAR_URL ?? "http://127.0.0.1:8001/synthesize",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb",
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128",
    elevenLabsSttModelId: process.env.ELEVENLABS_STT_MODEL_ID ?? "scribe_v2",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash-lite",
  };
}

async function waitForFileSearchStoreReady(
  ai: GoogleGenAI,
  fileSearchStoreName: string,
  minExpectedDocs: number
) {
  const deadline = Date.now() + RAG_READY_TIMEOUT_MS;
  let last = { active: 0, pending: 0, failed: 0 };

  while (Date.now() < deadline) {
    const store = await ai.fileSearchStores.get({ name: fileSearchStoreName });
    const active = parseCounter(store.activeDocumentsCount);
    const pending = parseCounter(store.pendingDocumentsCount);
    const failed = parseCounter(store.failedDocumentsCount);
    last = { active, pending, failed };

    if (pending === 0 && active + failed >= minExpectedDocs) {
      return last;
    }

    await sleep(RAG_READY_POLL_INTERVAL_MS);
  }

  return last;
}

async function handleElevenLabsTts(req: Request, res: Response) {
  const body = req.body as LocalTtsRequest;
  const text = body.text?.trim();
  const language = body.language?.trim() || "nl";
  const config = getLocalConfig();

  if (!text) {
    res.status(400).json({ message: "text is verplicht." });
    return;
  }

  if (!config.elevenLabsApiKey) {
    res.status(500).json({ message: "ELEVENLABS_API_KEY ontbreekt op de backend." });
    return;
  }

  try {
    console.log("[Local TTS] request", {
      hasKey: Boolean(config.elevenLabsApiKey),
      voiceId: config.elevenLabsVoiceId,
      modelId: config.elevenLabsModelId,
      outputFormat: config.elevenLabsOutputFormat,
      language,
      textLength: text.length,
    });

    const elevenLabsResult = await withSpan(
      "ai.elevenlabs.tts",
      {
        "ai.provider": "elevenlabs",
        "ai.operation": "tts",
        "ai.model": config.elevenLabsModelId,
        "ai.voice_id": config.elevenLabsVoiceId,
        "app.language": language,
      },
      async () => {
        const elevenLabsResponse = await fetch(
          `${ELEVENLABS_TTS_API_URL}/${config.elevenLabsVoiceId}?output_format=${encodeURIComponent(config.elevenLabsOutputFormat)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": config.elevenLabsApiKey,
            },
            body: JSON.stringify({
              text,
              model_id: config.elevenLabsModelId,
              language_code: language,
            }),
          }
        );

        if (!elevenLabsResponse.ok) {
          const details = await elevenLabsResponse.text().catch(() => "");
          console.error("[Local TTS] ElevenLabs error", {
            status: elevenLabsResponse.status,
            statusText: elevenLabsResponse.statusText,
            details,
          });
          throw new Error(`ElevenLabs TTS fout: ${elevenLabsResponse.status} ${details}`.trim());
        }

        return {
          audioBuffer: Buffer.from(await elevenLabsResponse.arrayBuffer()),
          contentType: elevenLabsResponse.headers.get("content-type") ?? "audio/mpeg",
        };
      }
    );
    console.log("[Local TTS] success", {
      bytes: elevenLabsResult.audioBuffer.length,
      contentType: elevenLabsResult.contentType,
    });
    res.setHeader("Content-Type", elevenLabsResult.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(elevenLabsResult.audioBuffer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("ElevenLabs TTS error:", error);
    res.status(reason.startsWith("ElevenLabs TTS fout:") ? 502 : 500).json({
      message: `ElevenLabs TTS service is niet beschikbaar: ${reason}`,
    });
  }
}

async function handleSidecarClassicTts(req: Request, res: Response) {
  const body = req.body as LocalTtsRequest;
  const text = body.text?.trim();
  const language = body.language?.trim() || "nl";
  const config = getLocalConfig();

  if (!text) {
    res.status(400).json({ message: "text is verplicht." });
    return;
  }

  try {
    const data = await withSpan(
      "ai.local_tts.synthesize",
      {
        "ai.provider": "local-sidecar",
        "ai.operation": "tts",
        "app.language": language,
        "ai.endpoint": config.ttsSidecarUrl,
      },
      async () => {
        const ttsResponse = await fetch(config.ttsSidecarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
        });

        if (!ttsResponse.ok) {
          const details = await ttsResponse.text().catch(() => "");
          throw new Error(`TTS sidecar fout: ${ttsResponse.status} ${details}`);
        }

        return (await ttsResponse.json()) as { audioBase64?: string; mimeType?: string };
      }
    );
    if (!data.audioBase64) {
      res.status(502).json({ message: "TTS sidecar gaf geen audio terug." });
      return;
    }

    const audioBuffer = Buffer.from(data.audioBase64, "base64");
    res.setHeader("Content-Type", data.mimeType ?? "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Local TTS error:", error);
    res.status(reason.startsWith("TTS sidecar fout:") ? 502 : 500).json({
      message: `Lokale TTS service is niet beschikbaar: ${reason}. Controleer sidecar op ${config.ttsSidecarUrl}`,
    });
  }
}

async function handleElevenLabsStt(req: Request, res: Response) {
  const body = req.body as LocalSttRequest;
  const audioBase64 = body.audioBase64;
  const mimeType = body.mimeType || "audio/webm";
  const language = body.language || "nl";
  const config = getLocalConfig();

  if (!audioBase64) {
    res.status(400).json({ message: "audioBase64 is verplicht." });
    return;
  }

  if (!config.elevenLabsApiKey) {
    res.status(500).json({ message: "ELEVENLABS_API_KEY ontbreekt op de backend." });
    return;
  }

  try {
    if (typeof fetch !== "function" || typeof FormData === "undefined" || typeof Blob === "undefined") {
      res.status(500).json({
        message:
          "Node mist fetch/FormData/Blob voor STT upload. Gebruik Node 18+ (liefst Node 20+).",
      });
      return;
    }

    const binary = Buffer.from(audioBase64, "base64");
    const fileExtension = getExtensionFromMimeType(mimeType);
    const formData = new FormData();
    formData.append("model_id", config.elevenLabsSttModelId);
    formData.append("language_code", language);
    formData.append("file", new Blob([binary], { type: mimeType }), `speech.${fileExtension}`);

    const data = await withSpan(
      "ai.elevenlabs.stt",
      {
        "ai.provider": "elevenlabs",
        "ai.operation": "stt",
        "ai.model": config.elevenLabsSttModelId,
        "app.language": language,
        "app.mime_type": mimeType,
      },
      async () => {
        const sttResponse = await fetch(ELEVENLABS_STT_API_URL, {
          method: "POST",
          headers: {
            "xi-api-key": config.elevenLabsApiKey,
          },
          body: formData,
        });

        if (!sttResponse.ok) {
          const details = await sttResponse.text().catch(() => "");
          throw new Error(`ElevenLabs STT fout: ${sttResponse.status} ${details}`.trim());
        }

        return (await sttResponse.json()) as { text?: string };
      }
    );

    res.json({ text: data.text?.trim() ?? "" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("ElevenLabs STT error:", error);
    res.status(reason.startsWith("ElevenLabs STT fout:") ? 502 : 500).json({
      message: `ElevenLabs STT service is niet beschikbaar: ${reason}`,
    });
  }
}

// Canonical TTS routes:
router.post("/tts/elevenlabs", handleElevenLabsTts);
router.post("/tts/sidecar", handleSidecarClassicTts);
router.post("/stt/elevenlabs", handleElevenLabsStt);

// Backward-compatible aliases:
router.post("/tts", handleElevenLabsTts);
router.post("/classic-tts", handleSidecarClassicTts);

router.post("/chat", async (req, res) => {
  const body = req.body as LocalChatRequest;
  const message = body.message?.trim();
  const chatHistory = body.chatHistory ?? [];
  const config = getLocalConfig();
  const trimmedStudyMaterial = body.studyMaterial
    ? truncateText(body.studyMaterial, MAX_STUDY_MATERIAL_CHARS)
    : "";

  if (!message) {
    res.status(400).json({ message: "message is verplicht." });
    return;
  }

  const historyMessages: OllamaMessage[] = chatHistory
    .filter((item) => item?.parts?.trim())
    .map((item) => ({
      role: item.role === "user" ? "user" : "assistant",
      content: item.parts,
    }));

  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historyMessages,
    ...(trimmedStudyMaterial
      ? [
          {
            role: "user" as const,
            content: `Gebruik dit lesmateriaal als context (ingekort voor snelheid):\n${trimmedStudyMaterial}`,
          },
        ]
      : []),
    { role: "user", content: message },
  ];

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await withSpan(
      "ai.ollama.chat",
      {
        "ai.provider": "ollama",
        "ai.operation": "chat",
        "ai.model": config.ollamaModel,
        "ai.endpoint": config.ollamaUrl,
      },
      async () => {
        const ollamaResponse = await fetch(`${config.ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.ollamaModel,
            messages,
            stream: true,
          }),
        });

        if (!ollamaResponse.ok || !ollamaResponse.body) {
          const details = await ollamaResponse.text().catch(() => "");
          throw new Error(`Ollama fout: ${ollamaResponse.status} ${details}`);
        }

        const decoder = new TextDecoder();
        let buffer = "";
        const reader = ollamaResponse.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const parsed = JSON.parse(trimmed) as { message?: { content?: string } };
                const content = parsed.message?.content ?? "";
                if (content) res.write(content);
              } catch {
                // Ignore non-json lines from the stream.
              }
            }
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim()) as { message?: { content?: string } };
            const content = parsed.message?.content ?? "";
            if (content) res.write(content);
          } catch {
            // Ignore trailing non-json content.
          }
        }
      }
    );

    res.end();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Local chat error:", error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(reason.startsWith("Ollama fout:") ? 502 : 500).json({
      message: `Lokale chat service is niet beschikbaar: ${reason}`,
    });
  }
});

router.post("/chat/gemini", async (req, res) => {
  const body = req.body as LocalChatRequest;
  const message = body.message?.trim();
  const chatHistory = body.chatHistory ?? [];
  const config = getLocalConfig();
  const trimmedStudyMaterial = body.studyMaterial
    ? truncateText(body.studyMaterial, MAX_STUDY_MATERIAL_CHARS)
    : "";
  const fileSearchStoreName = body.fileSearchStoreName?.trim();

  if (!message) {
    res.status(400).json({ message: "message is verplicht." });
    return;
  }

  if (!config.geminiApiKey) {
    res.status(500).json({ message: "GEMINI_API_KEY ontbreekt op de backend." });
    return;
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const contents = [
    ...chatHistory.map((item) => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.parts }],
    })),
    ...(trimmedStudyMaterial
      ? [
          {
            role: "user" as const,
            parts: [
              {
                text: `Gebruik dit lesmateriaal als context (ingekort voor snelheid):\n${trimmedStudyMaterial}`,
              },
            ],
          },
        ]
      : []),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await withSpan(
      "ai.gemini.chat",
      {
        "ai.provider": "google-gemini",
        "ai.operation": "chat",
        "ai.model": config.geminiTextModel,
      },
      async () => {
        const result = await ai.models.generateContentStream({
          model: config.geminiTextModel,
          contents: contents as any,
          config: {
            systemInstruction: body.systemInstruction ?? SYSTEM_PROMPT,
            temperature: body.temperature ?? 0.4,
            maxOutputTokens: body.maxOutputTokens ?? 1500,
            responseMimeType: body.responseMimeType ?? "text/plain",
            thinkingConfig: { thinkingBudget: 0 },
            ...(fileSearchStoreName
              ? {
                  tools: [
                    {
                      fileSearch: {
                        fileSearchStoreNames: [fileSearchStoreName],
                        topK: 8,
                      },
                    },
                  ],
                }
              : {}),
          },
        });

        for await (const chunk of result) {
          const text = chunk.text;
          if (text) res.write(text);
        }
      }
    );

    res.end();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Gemini backend chat error:", error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(502).json({
      message: `Gemini backend chat service is niet beschikbaar: ${reason}`,
    });
  }
});

router.post("/stt", async (req, res) => {
  const body = req.body as LocalSttRequest;
  const audioBase64 = body.audioBase64;
  const mimeType = body.mimeType || "audio/webm";
  const language = body.language || "nl";
  const config = getLocalConfig();

  if (!audioBase64) {
    res.status(400).json({ message: "audioBase64 is verplicht." });
    return;
  }

  try {
    if (typeof fetch !== "function" || typeof FormData === "undefined" || typeof Blob === "undefined") {
      res.status(500).json({
        message:
          "Node mist fetch/FormData/Blob voor STT upload. Gebruik Node 18+ (liefst Node 20+).",
      });
      return;
    }

    const binary = Buffer.from(audioBase64, "base64");
    const formData = new FormData();
    const fileExtension = getExtensionFromMimeType(mimeType);
    formData.append("language", language);
    formData.append("audio", new Blob([binary], { type: mimeType }), `speech.${fileExtension}`);

    const data = await withSpan(
      "ai.local_stt.transcribe",
      {
        "ai.provider": "local-sidecar",
        "ai.operation": "stt",
        "app.language": language,
        "app.mime_type": mimeType,
        "ai.endpoint": config.sttSidecarUrl,
      },
      async () => {
        const sttResponse = await fetch(config.sttSidecarUrl, {
          method: "POST",
          body: formData,
        });

        if (!sttResponse.ok) {
          const details = await sttResponse.text().catch(() => "");
          throw new Error(`STT sidecar fout: ${sttResponse.status} ${details}`);
        }

        return (await sttResponse.json()) as { text?: string };
      }
    );
    console.log(
      `[Local STT] mime=${mimeType} bytes=${binary.length} textLen=${(data.text ?? "").trim().length}`
    );
    res.json({ text: data.text ?? "" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Local STT error:", error);
    res.status(reason.startsWith("STT sidecar fout:") ? 502 : 500).json({
      message: `Lokale STT service is niet beschikbaar: ${reason}. Controleer sidecar op ${config.sttSidecarUrl}`,
    });
  }
});

router.post("/rag/sync", async (req, res) => {
  const body = req.body as RagSyncRequest;
  const config = getLocalConfig();

  if (!config.geminiApiKey) {
    res.status(500).json({ message: "GEMINI_API_KEY ontbreekt op de backend." });
    return;
  }

  const selectedItems = (body.selectedItems ?? [])
    .map((item) => ({
      name: item.name?.trim() || "document.txt",
      content: (item.content ?? "").trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(0, MAX_RAG_FILES)
    .map((item) => ({
      name: item.name,
      content: item.content.slice(0, MAX_RAG_CONTENT_CHARS),
    }));

  if (selectedItems.length === 0) {
    res.status(400).json({ message: "Geen bruikbare geselecteerde documenten met content." });
    return;
  }

  const userKey = sanitizeUserId(body.userId ?? "anon");
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  try {
    const previousStoreName = ragStoreByUser.get(userKey);
    if (previousStoreName) {
      try {
        await ai.fileSearchStores.delete({
          name: previousStoreName,
          config: { force: true },
        });
      } catch (error) {
        console.warn("[RAG] Vorige file search store verwijderen mislukt", {
          userKey,
          previousStoreName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const store = await ai.fileSearchStores.create({
      config: {
        displayName: `studybuddy-${userKey}-${Date.now()}`,
      },
    });
    const fileSearchStoreName = store.name?.trim();

    if (!fileSearchStoreName) {
      res.status(502).json({ message: "File Search Store kon niet worden aangemaakt." });
      return;
    }

    const uploadResults = await Promise.allSettled(
      selectedItems.map((item) =>
        ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName,
          file: new Blob([item.content], { type: "text/plain" }),
          config: {
            mimeType: "text/plain",
            displayName: item.name,
          },
        })
      )
    );

    const failedUploads = uploadResults.filter((result) => result.status === "rejected");
    const successfulUploads = uploadResults.length - failedUploads.length;

    if (successfulUploads === 0) {
      res.status(502).json({ message: "Geen documenten konden naar File Search worden geüpload." });
      return;
    }

    const status = await waitForFileSearchStoreReady(ai, fileSearchStoreName, successfulUploads);
    ragStoreByUser.set(userKey, fileSearchStoreName);

    res.json({
      fileSearchStoreName,
      uploadedDocuments: successfulUploads,
      failedUploads: failedUploads.length,
      status,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[RAG] File Search sync error:", error);
    res.status(502).json({ message: `RAG sync naar Gemini File Search mislukt: ${reason}` });
  }
});

export { router as localRouter };
