import { StudyItem } from "../../types";
import { embedTextsWithLocalModel } from "../localRagService";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 180;
const EMBEDDING_BATCH_SIZE = 24;
const MAX_RETRIEVED_CHUNKS = 5;
const MAX_CONTEXT_CHARS = 4200;
const MAX_CHUNKS_PER_DOCUMENT = 2;

type LocalRagChunk = {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

export type LocalRagIndex = {
  chunks: LocalRagChunk[];
  createdAt: number;
  documentIds: string[];
};

export function buildFallbackStudyContext(files: StudyItem[]): string | undefined {
  if (files.length === 0) return undefined;

  return files
    .map((file) => `--- DOCUMENT: ${file.name} ---\n${file.content ?? ""}`)
    .join("\n\n");
}

export async function buildLocalRagIndex(files: StudyItem[]): Promise<LocalRagIndex> {
  const sourceChunks = files.flatMap((file) => {
    const content = (file.content ?? "").trim();
    if (!content) return [];

    return splitTextIntoChunks(content).map((text, chunkIndex) => ({
      id: `${file.id}:${chunkIndex}`,
      documentId: file.id,
      documentName: file.name,
      chunkIndex,
      text,
    }));
  });

  if (sourceChunks.length === 0) {
    return {
      chunks: [],
      createdAt: Date.now(),
      documentIds: files.map((file) => file.id),
    };
  }

  const embeddings: number[][] = [];
  for (let start = 0; start < sourceChunks.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = sourceChunks.slice(start, start + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await embedTextsWithLocalModel(
      batch.map((chunk) => chunk.text),
      "document"
    );

    if (batchEmbeddings.length !== batch.length) {
      throw new Error("Het aantal embeddings komt niet overeen met het aantal chunks.");
    }

    embeddings.push(...batchEmbeddings);
  }

  return {
    chunks: sourceChunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    })),
    createdAt: Date.now(),
    documentIds: files.map((file) => file.id),
  };
}

export async function retrieveRelevantStudyContext(
  index: LocalRagIndex,
  query: string
): Promise<string | undefined> {
  const cleanQuery = query.trim();
  if (!cleanQuery || index.chunks.length === 0) return undefined;

  const [queryEmbedding] = await embedTextsWithLocalModel([cleanQuery], "query");
  if (!queryEmbedding) return undefined;

  const ranked = index.chunks
    .map((chunk) => ({
      chunk,
      score: dotProduct(queryEmbedding, chunk.embedding),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score);

  const selected: Array<{ chunk: LocalRagChunk; score: number }> = [];
  const chunksPerDocument = new Map<string, number>();
  let totalChars = 0;

  for (const item of ranked) {
    if (selected.length >= MAX_RETRIEVED_CHUNKS) break;

    const seenForDocument = chunksPerDocument.get(item.chunk.documentId) ?? 0;
    if (seenForDocument >= MAX_CHUNKS_PER_DOCUMENT) continue;

    const nextChars = totalChars + item.chunk.text.length;
    if (selected.length > 0 && nextChars > MAX_CONTEXT_CHARS) break;

    selected.push(item);
    chunksPerDocument.set(item.chunk.documentId, seenForDocument + 1);
    totalChars = nextChars;
  }

  if (selected.length === 0) return undefined;

  return [
    "Gebruik alleen deze lokaal opgehaalde stukken lesmateriaal als primaire bron.",
    "Als het antwoord niet expliciet in deze fragmenten staat, zeg dat eerlijk.",
    ...selected.map(
      ({ chunk }, indexNumber) =>
        `[Bron ${indexNumber + 1}] ${chunk.documentName} - fragment ${chunk.chunkIndex + 1}\n${chunk.text}`
    ),
  ].join("\n\n");
}

function splitTextIntoChunks(text: string): string[] {
  const clean = normalizeText(text);
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      const preferredBreak = findBreakPoint(clean, start, end);
      if (preferredBreak > start) {
        end = preferredBreak;
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return dedupeSequentialChunks(chunks);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function findBreakPoint(text: string, start: number, end: number): number {
  const minimum = start + Math.floor(CHUNK_SIZE * 0.55);
  const paragraphBreak = text.lastIndexOf("\n\n", end);
  if (paragraphBreak >= minimum) return paragraphBreak;

  const sentenceBreak = text.lastIndexOf(". ", end);
  if (sentenceBreak >= minimum) return sentenceBreak + 1;

  const wordBreak = text.lastIndexOf(" ", end);
  if (wordBreak >= minimum) return wordBreak;

  return end;
}

function dedupeSequentialChunks(chunks: string[]): string[] {
  const deduped: string[] = [];
  for (const chunk of chunks) {
    if (deduped[deduped.length - 1] !== chunk) deduped.push(chunk);
  }
  return deduped;
}

function dotProduct(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;

  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }

  return score;
}
