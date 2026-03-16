import { GoogleGenAI } from "@google/genai";

function resolveGeminiApiKey(): string {
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
  const legacyViteKey = import.meta.env?.GEMINI_API_KEY;
  const definedProcessKey =
    typeof process !== "undefined"
      ? (process.env?.API_KEY ?? process.env?.GEMINI_API_KEY)
      : undefined;

  return (viteKey ?? legacyViteKey ?? definedProcessKey ?? "").trim();
}

export function getGeminiApiKey(): string {
  return resolveGeminiApiKey();
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

