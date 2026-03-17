import { GoogleGenAI } from '@google/genai';

function resolveGeminiApiKey(): string {
  return '';
}

export function getGeminiApiKey(): string {
  return resolveGeminiApiKey();
}

export function createGeminiClient(): GoogleGenAI | null {
  return null;
}
