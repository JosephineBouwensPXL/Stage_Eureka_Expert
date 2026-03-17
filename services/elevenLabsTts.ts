const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

export async function synthesizeSpeechWithElevenLabs(
  text: string,
  languageCode = 'nl'
): Promise<string | null> {
  if (!text.trim()) return null;

  console.info('[TTS] ElevenLabs requested', {
    provider: 'elevenlabs',
    languageCode,
    textLength: text.trim().length,
    endpoint: `${API_BASE_URL}/local/tts/elevenlabs`,
  });

  const response = await fetch(`${API_BASE_URL}/local/tts/elevenlabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language: languageCode,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `ElevenLabs TTS request failed with status ${response.status}`);
  }

  const audioBlob = await response.blob();
  if (audioBlob.size === 0) return null;

  console.info('[TTS] ElevenLabs response received', {
    provider: 'elevenlabs',
    bytes: audioBlob.size,
    mimeType: audioBlob.type || 'unknown',
  });

  return URL.createObjectURL(audioBlob);
}
