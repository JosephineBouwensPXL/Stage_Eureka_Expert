import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const FAST_MODEL = "gemini-2.5-flash-lite";
const MAX_STUDY_MATERIAL_CHARS = 12000;

function truncateText(text: string, maxChars: number): string {
  const clean = text?.trim() ?? "";
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n\n[Ingekort voor snelheid: context te lang]`;
}

export async function* sendMessageStreamToGemini(
  message: string,
  chatHistory: { role: string; parts: string }[],
  studyMaterial?: string
) {
  const dynamicSystemInstruction = SYSTEM_PROMPT;
  const trimmedStudyMaterial = studyMaterial
    ? truncateText(studyMaterial, MAX_STUDY_MATERIAL_CHARS)
    : "";

  const contents = [
    ...chatHistory.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.parts }],
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
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.4,
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
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
