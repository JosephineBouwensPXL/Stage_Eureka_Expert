import { Router } from "express";

const router = Router();

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MAX_STUDY_MATERIAL_CHARS = 12000;

const SYSTEM_PROMPT = `
Zeg ik ben de ollama system prompt, ik run locaal.
Je bent een behulpzame en beknopte assistent die antwoorden geeft in het Nederlands.
`.trim();

type ChatHistoryItem = { role: "user" | "bot"; parts: string };

type LocalChatRequest = {
  message?: string;
  chatHistory?: ChatHistoryItem[];
  studyMaterial?: string;
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

function getLocalConfig() {
  return {
    ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
    sttSidecarUrl: process.env.STT_SIDECAR_URL ?? "http://127.0.0.1:8001/transcribe",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb",
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128",
  };
}

router.post("/tts", async (req, res) => {
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

    const elevenLabsResponse = await fetch(
      `${ELEVENLABS_API_URL}/${config.elevenLabsVoiceId}?output_format=${encodeURIComponent(config.elevenLabsOutputFormat)}`,
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
      res.status(elevenLabsResponse.status).json({
        message: `ElevenLabs TTS fout: ${elevenLabsResponse.status} ${details}`.trim(),
      });
      return;
    }

    const audioBuffer = Buffer.from(await elevenLabsResponse.arrayBuffer());
    console.log("[Local TTS] success", {
      bytes: audioBuffer.length,
      contentType: elevenLabsResponse.headers.get("content-type"),
    });
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("ElevenLabs TTS error:", error);
    res.status(500).json({
      message: `ElevenLabs TTS service is niet beschikbaar: ${reason}`,
    });
  }
});

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
      res.status(502).json({ message: `Ollama fout: ${ollamaResponse.status} ${details}` });
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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
            const text = parsed.message?.content ?? "";
            if (text) res.write(text);
          } catch {
            // Ignore non-json lines from the stream.
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as { message?: { content?: string } };
        const text = parsed.message?.content ?? "";
        if (text) res.write(text);
      } catch {
        // Ignore trailing non-json content.
      }
    }

    res.end();
  } catch (error) {
    console.error("Local chat error:", error);
    res.status(500).json({ message: "Lokale chat service is niet beschikbaar." });
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

    const sttResponse = await fetch(config.sttSidecarUrl, {
      method: "POST",
      body: formData,
    });

    if (!sttResponse.ok) {
      const details = await sttResponse.text().catch(() => "");
      res.status(502).json({ message: `STT sidecar fout: ${sttResponse.status} ${details}` });
      return;
    }

    const data = (await sttResponse.json()) as { text?: string };
    console.log(
      `[Local STT] mime=${mimeType} bytes=${binary.length} textLen=${(data.text ?? "").trim().length}`
    );
    res.json({ text: data.text ?? "" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Local STT error:", error);
    res.status(500).json({
      message: `Lokale STT service is niet beschikbaar: ${reason}. Controleer sidecar op ${config.sttSidecarUrl}`,
    });
  }
});

export { router as localRouter };
