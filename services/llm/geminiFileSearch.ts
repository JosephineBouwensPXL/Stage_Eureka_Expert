import { StudyItem } from '../../types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

type RagSyncResponse = {
  fileSearchStoreName?: string;
  uploadedDocuments?: number;
  failedUploads?: number;
};

const storeCache = new Map<string, string>();
const inflightCache = new Map<string, Promise<string | undefined>>();

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildSelectionFingerprint(
  userId: string,
  files: Array<{ id: string; name: string; content: string; fileType?: string }>
): string {
  const normalized = files
    .map((item) => ({
      id: item.id,
      name: item.name,
      fileType: item.fileType ?? '',
      contentHash: hashString(item.content),
      size: item.content.length,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return hashString(`${userId}::${JSON.stringify(normalized)}`);
}

export async function syncSelectedStudyItemsToGeminiFileSearch(
  userId: string,
  selectedItems: StudyItem[]
): Promise<string | undefined> {
  const filesWithContent = selectedItems
    .filter((item) => item.type === 'file')
    .map((item) => ({
      id: item.id,
      name: item.name,
      content: (item.content ?? '').trim(),
      fileType: item.fileType,
    }))
    .filter((item) => item.content.length > 0);

  if (filesWithContent.length === 0) return undefined;
  const cacheKey = buildSelectionFingerprint(userId, filesWithContent);
  const cachedStore = storeCache.get(cacheKey);
  if (cachedStore) return cachedStore;

  const inflight = inflightCache.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    const response = await fetch(`${API_BASE_URL}/local/rag/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        selectedItems: filesWithContent,
      }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const parsed = (await response.json()) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // Keep fallback message.
      }
      throw new Error(message);
    }

    const data = (await response.json()) as RagSyncResponse;
    const storeName = data.fileSearchStoreName?.trim() || undefined;
    if (storeName) storeCache.set(cacheKey, storeName);
    return storeName;
  })();

  inflightCache.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflightCache.delete(cacheKey);
  }
}
