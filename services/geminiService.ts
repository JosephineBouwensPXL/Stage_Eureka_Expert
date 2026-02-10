
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function* sendMessageStreamToGemini(
  message: string, 
  chatHistory: { role: string, parts: string }[],
  studyMaterial?: string
) {
  // Inject material into system instruction for maximum priority
  const dynamicSystemInstruction = studyMaterial 
    ? `${SYSTEM_PROMPT}\n\nGEBRUIK DIT LESMATERIAAL ALS JE ENIGE BRON VOOR VRAGEN EN UITLEG:\n${studyMaterial}`
    : `${SYSTEM_PROMPT}\n\nEr is momenteel geen specifiek lesmateriaal geüpload door de leerling. Beantwoord hun vragen op een algemene, behulpzame en educatieve wijze.`;

  const contents = [
    ...chatHistory.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.parts }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 0 }
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
