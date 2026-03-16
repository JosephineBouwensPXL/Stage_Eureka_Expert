import { ModeAccess } from '../../types';
import { streamChatWithProvider } from '../llm';
import { LlmProviderId } from '../llm/types';

export type InlineRating = 'red' | 'blue' | 'green';

type TtsState = {
  isPlaying: boolean;
  queueLength: number;
};

export type StreamChatTurnParams = {
  providerId: LlmProviderId;
  requestText: string;
  history: { role: string; parts: string }[];
  activeStudyContext?: string;
  fileSearchStoreName?: string;
  expectsInlineRating: boolean;
  engineMode: ModeAccess;
  getTtsState: () => TtsState;
  playTtsChunk: (text: string) => void;
  onVisibleText: (text: string) => void;
};

export async function streamChatTurn(params: StreamChatTurnParams): Promise<{
  fullResponse: string;
  inlineRating: InlineRating | null;
}> {
  const {
    providerId,
    requestText,
    history,
    activeStudyContext,
    fileSearchStoreName,
    expectsInlineRating,
    engineMode,
    getTtsState,
    playTtsChunk,
    onVisibleText,
  } = params;

  const firstTtsChunkMinChars = engineMode === ModeAccess.NATIVE ? 70 : 55;
  const nextTtsChunkMinChars = engineMode === ModeAccess.NATIVE ? 140 : 110;
  let fullResponse = '';
  let ttsBuffer = '';
  let inlineRating: InlineRating | null = null;
  let inlineRatingBuffer = '';
  let inlineRatingResolved = !expectsInlineRating;

  const flushTts = (force = false) => {
    const trimmed = ttsBuffer.trim();
    if (!trimmed) return;
    const hasSentenceBoundary = /[.!?]\s*$/.test(ttsBuffer);
    const ttsState = getTtsState();
    const isFirstChunk = !ttsState.isPlaying && ttsState.queueLength === 0;
    const minChunkChars = isFirstChunk ? firstTtsChunkMinChars : nextTtsChunkMinChars;
    if (force || (trimmed.length >= minChunkChars && hasSentenceBoundary)) {
      playTtsChunk(trimmed);
      ttsBuffer = '';
    }
  };

  const appendVisibleText = (textChunk: string) => {
    if (!textChunk) return;
    fullResponse += textChunk;
    onVisibleText(fullResponse);
    ttsBuffer += textChunk;
    flushTts(false);
  };

  const stream = streamChatWithProvider(providerId, {
    message: requestText,
    chatHistory: history,
    studyMaterial: activeStudyContext ? activeStudyContext : undefined,
    fileSearchStoreName,
  });

  for await (const chunk of stream) {
    if (!expectsInlineRating || inlineRatingResolved) {
      appendVisibleText(chunk);
      continue;
    }

    inlineRatingBuffer += chunk;
    const markerMatch = inlineRatingBuffer.match(/\[\[AI_RATING:(red|blue|green)\]\]/i);
    if (markerMatch) {
      inlineRating = markerMatch[1].toLowerCase() as InlineRating;
      const markerStart = markerMatch.index ?? 0;
      const markerEnd = markerStart + markerMatch[0].length;
      const beforeMarker = inlineRatingBuffer.slice(0, markerStart);
      const afterMarker = inlineRatingBuffer.slice(markerEnd).replace(/^\s*\n?/, '');
      appendVisibleText(beforeMarker + afterMarker);
      inlineRatingBuffer = '';
      inlineRatingResolved = true;
      continue;
    }

    if (inlineRatingBuffer.length > 240) {
      inlineRatingResolved = true;
      appendVisibleText(inlineRatingBuffer);
      inlineRatingBuffer = '';
    }
  }

  if (inlineRatingBuffer) appendVisibleText(inlineRatingBuffer);
  flushTts(true);

  return { fullResponse, inlineRating };
}
