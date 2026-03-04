const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

export type EmbeddingInputType = "query" | "document";

type LocalEmbeddingResponse = {
  embeddings?: number[][];
  model?: string;
};

export async function embedTextsWithLocalModel(
  texts: string[],
  inputType: EmbeddingInputType = "document"
): Promise<number[][]> {
  const cleanedTexts = texts.map((text) => text.trim()).filter(Boolean);
  if (cleanedTexts.length === 0) return [];

  const response = await fetch(`${API_BASE_URL}/local/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texts: cleanedTexts,
      inputType,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Local embedding request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as LocalEmbeddingResponse;
  if (!Array.isArray(data.embeddings)) {
    throw new Error("Local embedding service gaf geen geldige embeddings terug.");
  }

  return data.embeddings;
}
