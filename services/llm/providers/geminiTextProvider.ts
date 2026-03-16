import { SYSTEM_PROMPT } from "../../../constants";
import { createGeminiClient } from "../geminiClient";
import { LlmTextProvider, StreamChatRequest } from "../types";

const FAST_MODEL = "gemini-2.5-flash-lite";
const MAX_STUDY_MATERIAL_CHARS = 12000;

function truncateText(text: string, maxChars: number): string {
  const clean = text?.trim() ?? "";
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n\n[Ingekort voor snelheid: context te lang]`;
}

async function* streamChat({
  message,
  chatHistory,
  studyMaterial,
  fileSearchStoreName,
  systemInstructionOverride,
  temperatureOverride,
  maxOutputTokensOverride,
  responseMimeTypeOverride,
}: StreamChatRequest) {
  const ai = createGeminiClient();
  if (!ai) {
    yield "Gemini API-key ontbreekt. Voeg `VITE_GEMINI_API_KEY` toe in je frontend env en herstart Vite.";
    return;
  }

  const trimmedStudyMaterial = studyMaterial
    ? truncateText(studyMaterial, MAX_STUDY_MATERIAL_CHARS)
    : "";
  console.info("[RAG][GeminiText] generateContentStream", {
    hasFileSearchStore: !!fileSearchStoreName,
    fileSearchStoreName,
    inlineStudyMaterialChars: trimmedStudyMaterial.length,
  });

  const contents = [
    ...chatHistory.map((item) => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.parts }],
    })),
    ...(trimmedStudyMaterial
      ? [
          {
            role: "user",
            parts: [
              {
                text: `Gebruik dit lesmateriaal als context (ingekort voor snelheid):\n${trimmedStudyMaterial}`,
              },
            ],
          },
        ]
      : []),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const result = await ai.models.generateContentStream({
      model: FAST_MODEL,
      contents: contents as any,
      config: {
        systemInstruction: systemInstructionOverride ?? SYSTEM_PROMPT,
        temperature: temperatureOverride ?? 0.4,
        maxOutputTokens: maxOutputTokensOverride ?? 1500,
        responseMimeType: responseMimeTypeOverride ?? "text/plain",
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
      if (text) yield text;
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    yield "Oeps, even een foutje. Probeer het zo nog eens!";
  }
}

export const geminiTextProvider: LlmTextProvider = {
  id: "gemini",
  label: "Google Gemini",
  streamChat,
};
