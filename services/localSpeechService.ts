const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

type ChatHistoryItem = { role: string; parts: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function transcribeAudioWithLocalStt(audioBlob: Blob, language = "nl"): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBase64 = arrayBufferToBase64(arrayBuffer);

  const response = await fetch(`${API_BASE_URL}/local/stt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType: audioBlob.type || "audio/webm",
      language,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`STT request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

export async function* sendMessageStreamToLocalLLM(
  message: string,
  chatHistory: ChatHistoryItem[],
  studyMaterial?: string
) {
  const response = await fetch(`${API_BASE_URL}/local/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, chatHistory, studyMaterial }),
  });

  if (!response.ok || !response.body) {
    const details = await response.text().catch(() => "");
    throw new Error(`Local chat request failed: ${response.status} ${details}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) yield text;
  }
}
