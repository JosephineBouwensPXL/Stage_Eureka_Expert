const DEFAULT_MAX_TTS_CHUNK_CHARS = 4200;

function splitAtBoundary(text: string, maxChars: number): [string, string] {
  const slice = text.slice(0, maxChars);
  const boundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(', ')
  );

  if (boundary > maxChars * 0.45) {
    return [text.slice(0, boundary + 1).trim(), text.slice(boundary + 1).trim()];
  }

  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.45) {
    return [text.slice(0, lastSpace).trim(), text.slice(lastSpace + 1).trim()];
  }

  return [slice.trim(), text.slice(maxChars).trim()];
}

export function chunkSpeechText(
  text: string,
  maxChars = DEFAULT_MAX_TTS_CHUNK_CHARS
): string[] {
  let remaining = text.trim();
  const chunks: string[] = [];

  while (remaining) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    const [chunk, rest] = splitAtBoundary(remaining, maxChars);
    if (chunk) chunks.push(chunk);
    remaining = rest;
  }

  return chunks;
}
