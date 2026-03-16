import { StudyItem } from '../../types';
import { createGeminiClient, getGeminiApiKey } from './geminiClient';

const STORE_KEY_PREFIX = 'studybuddy_gemini_file_search_store_';
const DOC_INDEX_KEY_PREFIX = 'studybuddy_gemini_file_search_docs_';
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 40;
const STORE_READY_POLL_INTERVAL_MS = 900;
const STORE_READY_MAX_POLL_ATTEMPTS = 20;

type StoredDocumentIndex = Record<
  string,
  {
    signature: string;
    documentName?: string;
  }
>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCount(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStoreKey(userId: string): string {
  return `${STORE_KEY_PREFIX}${userId}`;
}

function getDocIndexKey(userId: string): string {
  return `${DOC_INDEX_KEY_PREFIX}${userId}`;
}

function readDocIndex(userId: string): StoredDocumentIndex {
  const raw = localStorage.getItem(getDocIndexKey(userId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredDocumentIndex;
  } catch {
    return {};
  }
}

function writeDocIndex(userId: string, index: StoredDocumentIndex) {
  localStorage.setItem(getDocIndexKey(userId), JSON.stringify(index));
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}

async function buildSignature(item: StudyItem): Promise<string> {
  const content = item.content ?? '';
  const hash = await sha256(content);
  return `${item.name}|${item.fileType ?? 'txt'}|${content.length}|${hash}`;
}

function requireGeminiClient() {
  const ai = createGeminiClient();
  if (!ai) throw new Error('Gemini API-key ontbreekt.');
  return ai;
}

async function waitForUploadOperation(operation: any): Promise<any> {
  const ai = requireGeminiClient();
  let current = operation;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (current?.done) return current;
    await sleep(POLL_INTERVAL_MS);
    current = await ai.operations.get({ operation: current });
  }
  throw new Error('Upload naar Gemini File Search timed out.');
}

async function ensureStore(userId: string): Promise<string> {
  const ai = requireGeminiClient();
  const storeKey = getStoreKey(userId);
  const existingStore = localStorage.getItem(storeKey);

  if (existingStore) {
    try {
      const existing = await ai.fileSearchStores.get({ name: existingStore });
      if (existing?.name) {
        console.info('[RAG][FileSearch] Reusing existing store', {
          userId,
          storeName: existing.name,
        });
        return existing.name;
      }
    } catch {
      // Store reference is stale, recreate below.
    }
  }

  const created = await ai.fileSearchStores.create({
    config: {
      displayName: `StudyBuddy ${userId} ${new Date().toISOString().slice(0, 10)}`,
    },
  });

  if (!created?.name) {
    throw new Error('Kon geen Gemini File Search Store aanmaken.');
  }

  localStorage.setItem(storeKey, created.name);
  console.info('[RAG][FileSearch] Created new store', { userId, storeName: created.name });
  return created.name;
}

async function deleteDocumentIfKnown(documentName?: string) {
  const ai = createGeminiClient();
  if (!ai || !documentName) return;
  try {
    await ai.fileSearchStores.documents.delete({
      name: documentName,
      config: { force: true },
    });
  } catch (error) {
    console.warn('[Gemini File Search] Document delete failed', { documentName, error });
  }
}

async function uploadStudyItem(storeName: string, item: StudyItem): Promise<string> {
  const ai = requireGeminiClient();
  const text = (item.content ?? '').trim();
  if (!text) return undefined;

  const blob = new Blob([text], { type: 'text/plain' });
  const operation = await ai.fileSearchStores.uploadToFileSearchStore({
    fileSearchStoreName: storeName,
    file: blob,
    config: {
      mimeType: 'text/plain',
      displayName: item.name,
      customMetadata: [{ key: 'study_item_id', stringValue: item.id }],
    },
  });

  const done = await waitForUploadOperation(operation);
  if (done?.error) {
    throw new Error(`Upload mislukt voor ${item.name}: ${JSON.stringify(done.error)}`);
  }
  const documentName = done?.response?.documentName;
  if (!documentName) {
    throw new Error(`Upload gaf geen documentName terug voor ${item.name}.`);
  }
  return documentName;
}

async function waitForStoreReady(
  storeName: string,
  expectedMinActiveDocuments: number
): Promise<void> {
  const ai = createGeminiClient();
  if (!ai) return;

  for (let attempt = 0; attempt < STORE_READY_MAX_POLL_ATTEMPTS; attempt++) {
    const store = await ai.fileSearchStores.get({ name: storeName });
    const active = parseCount(store.activeDocumentsCount);
    const pending = parseCount(store.pendingDocumentsCount);
    const failed = parseCount(store.failedDocumentsCount);

    console.info('[RAG][FileSearch] Store status', {
      storeName,
      activeDocumentsCount: active,
      pendingDocumentsCount: pending,
      failedDocumentsCount: failed,
      expectedMinActiveDocuments,
      attempt: attempt + 1,
    });

    if (pending === 0 && active >= expectedMinActiveDocuments) return;
    await sleep(STORE_READY_POLL_INTERVAL_MS);
  }
}

export async function syncSelectedStudyItemsToGeminiFileSearch(
  userId: string,
  selectedItems: StudyItem[]
): Promise<string | undefined> {
  if (!getGeminiApiKey()) {
    console.warn('[RAG][FileSearch] Gemini API-key ontbreekt, sla File Search sync over.');
    return undefined;
  }

  const eligibleItems = selectedItems.filter(
    (item) => item.type === 'file' && !!item.content?.trim()
  );
  console.info('[RAG][FileSearch] Sync start', {
    userId,
    selectedItems: selectedItems.length,
    eligibleItems: eligibleItems.length,
    eligibleItemLengths: eligibleItems.map((item) => ({
      id: item.id,
      name: item.name,
      contentChars: (item.content ?? '').length,
    })),
  });
  if (eligibleItems.length === 0) return undefined;

  const storeName = await ensureStore(userId);
  const index = readDocIndex(userId);
  const selectedIds = new Set(eligibleItems.map((item) => item.id));
  let changed = false;

  for (const [itemId, entry] of Object.entries(index)) {
    if (selectedIds.has(itemId)) continue;
    await deleteDocumentIfKnown(entry.documentName);
    delete index[itemId];
    changed = true;
  }

  for (const item of eligibleItems) {
    const signature = await buildSignature(item);
    const current = index[item.id];
    if (current?.signature === signature && !!current.documentName) continue;

    await deleteDocumentIfKnown(current?.documentName);
    const documentName = await uploadStudyItem(storeName, item);
    index[item.id] = { signature, documentName };
    changed = true;
    console.info('[RAG][FileSearch] Uploaded/updated document', {
      itemId: item.id,
      itemName: item.name,
      documentName,
    });
  }

  writeDocIndex(userId, index);
  await waitForStoreReady(storeName, Object.keys(index).length);
  console.info('[RAG][FileSearch] Sync complete', {
    userId,
    storeName,
    indexedDocuments: Object.keys(index).length,
    changed,
  });
  return storeName;
}
