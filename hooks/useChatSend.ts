import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react';
import { Message, MessageRole, ModeAccess, StudyItem, User } from '../types';
import { getDefaultTextProviderId } from '../services/llm';
import {
  buildLearningGoalTurnPlan,
  inferAiLearningGoalSuggestionFromTutorText,
  parseInlineLearningGoalRating,
  LearningGoalTurnPlan,
} from '../services/learningGoals';
import { streamChatTurn } from '../services/chat/chatStreaming';
import { syncSelectedStudyItemsToGeminiFileSearch } from '../services/llm/geminiFileSearch';
import { LearningGoal, LearningGoalRating } from '../components/LearningGoalsPanel';

type UseChatSendParams = {
  inputText: string;
  setInputText: (value: string) => void;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setIsTyping: (value: boolean) => void;
  setStreamingBotText: (value: string) => void;
  stopAllTts: () => void;
  getTtsState: () => { isPlaying: boolean; queueLength: number };
  playTtsChunk: (text: string) => void;
  engineMode: ModeAccess;
  currentUser: User | null;
  studyItems: StudyItem[];
  activeStudyContext?: string;
  isLearningGoalsQuestioningEnabled: boolean;
  detectedLearningGoals: LearningGoal[];
  learningGoalBuckets: {
    emptyGoals: LearningGoal[];
    redGoals: LearningGoal[];
    blueGoals: LearningGoal[];
    greenGoals: LearningGoal[];
  };
  isLearningGoalAiEnabled: boolean;
  learningGoalCycleIndexRef: MutableRefObject<number>;
  learningGoalAllGreenIndexRef: MutableRefObject<number>;
  lastAskedLearningGoalRef: MutableRefObject<string | null>;
  askedQuestionsByGoalRef: MutableRefObject<Record<string, string[]>>;
  setActiveLearningGoalText: (value: string | null) => void;
  setLearningGoalRatings: Dispatch<SetStateAction<Record<string, (LearningGoalRating | null)[]>>>;
  setLearningGoalAiSuggestions: Dispatch<SetStateAction<Record<string, LearningGoalRating>>>;
};

function resetLearningGoalProgress(params: {
  learningGoalCycleIndexRef: MutableRefObject<number>;
  learningGoalAllGreenIndexRef: MutableRefObject<number>;
  lastAskedLearningGoalRef: MutableRefObject<string | null>;
  askedQuestionsByGoalRef: MutableRefObject<Record<string, string[]>>;
  setLearningGoalRatings: Dispatch<SetStateAction<Record<string, (LearningGoalRating | null)[]>>>;
  setLearningGoalAiSuggestions: Dispatch<SetStateAction<Record<string, LearningGoalRating>>>;
}) {
  params.setLearningGoalRatings({});
  params.setLearningGoalAiSuggestions({});
  params.learningGoalCycleIndexRef.current = 0;
  params.learningGoalAllGreenIndexRef.current = 0;
  params.lastAskedLearningGoalRef.current = null;
  params.askedQuestionsByGoalRef.current = {};
}

function applyTurnPlan(
  text: string,
  hasLearningGoals: boolean,
  detectedLearningGoals: LearningGoal[],
  learningGoalBuckets: UseChatSendParams['learningGoalBuckets'],
  learningGoalCycleIndexRef: MutableRefObject<number>,
  lastAskedLearningGoalRef: MutableRefObject<string | null>,
  askedQuestionsByGoalRef: MutableRefObject<Record<string, string[]>>,
  setActiveLearningGoalText: (value: string | null) => void
): LearningGoalTurnPlan {
  const turnPlan = buildLearningGoalTurnPlan({
    text,
    hasLearningGoals,
    detectedLearningGoals,
    learningGoalBuckets,
    currentCycleIndex: learningGoalCycleIndexRef.current,
    lastAskedGoal: lastAskedLearningGoalRef.current,
    askedQuestionsByGoal: askedQuestionsByGoalRef.current,
  });
  learningGoalCycleIndexRef.current = turnPlan.nextCycleIndex;
  setActiveLearningGoalText(turnPlan.activeGoalText);
  return turnPlan;
}

export function useChatSend(params: UseChatSendParams) {
  return useCallback(
    async (textOverride?: string) => {
      const text = textOverride || params.inputText;
      if (!text.trim()) return;

      const hasLearningGoals =
        params.isLearningGoalsQuestioningEnabled && params.detectedLearningGoals.length > 0;
      const turnPlan = applyTurnPlan(
        text,
        hasLearningGoals,
        params.detectedLearningGoals,
        params.learningGoalBuckets,
        params.learningGoalCycleIndexRef,
        params.lastAskedLearningGoalRef,
        params.askedQuestionsByGoalRef,
        params.setActiveLearningGoalText
      );

      if (turnPlan.shouldResetProgress) {
        resetLearningGoalProgress({
          learningGoalCycleIndexRef: params.learningGoalCycleIndexRef,
          learningGoalAllGreenIndexRef: params.learningGoalAllGreenIndexRef,
          lastAskedLearningGoalRef: params.lastAskedLearningGoalRef,
          askedQuestionsByGoalRef: params.askedQuestionsByGoalRef,
          setLearningGoalRatings: params.setLearningGoalRatings,
          setLearningGoalAiSuggestions: params.setLearningGoalAiSuggestions,
        });
      }

      const previousGoal = turnPlan.previousGoal;
      const nextGoalText = turnPlan.nextGoalText;
      const requestText = `${text.trim()}${turnPlan.goalInstruction}`;
      const userMessage: Message = {
        id: Date.now().toString(),
        role: MessageRole.USER,
        text: text.trim(),
        timestamp: new Date(),
      };
      params.setMessages((prev) => [...prev, userMessage]);
      if (!textOverride) params.setInputText('');
      params.setIsTyping(true);
      params.setStreamingBotText('');
      params.stopAllTts();

      const history = params.messages.slice(-10).map((m) => ({ role: m.role, parts: m.text }));
      const providerId = getDefaultTextProviderId(params.engineMode);
      const selectedFiles = params.studyItems.filter(
        (item) => item.type === 'file' && item.selected
      );
      let fileSearchStoreName: string | undefined;
      if (providerId === 'gemini' && params.currentUser?.id && selectedFiles.length > 0) {
        try {
          fileSearchStoreName = await syncSelectedStudyItemsToGeminiFileSearch(
            params.currentUser.id,
            selectedFiles
          );
        } catch (error) {
          console.error('[RAG][Text] File Search sync mislukt, fallback op inline context.', error);
        }
      }

      const shouldSendInlineStudyMaterial = !!params.activeStudyContext && !fileSearchStoreName;
      console.info('[RAG][Text] Request routing', {
        engineMode: params.engineMode,
        providerId,
        selectedFiles: selectedFiles.length,
        usesGeminiFileSearch: !!fileSearchStoreName,
        fileSearchStoreName,
        usesInlineStudyMaterial: shouldSendInlineStudyMaterial,
      });
      const expectsInlineRating =
        hasLearningGoals && !!previousGoal && params.isLearningGoalAiEnabled;

      try {
        const { fullResponse, inlineRating } = await streamChatTurn({
          providerId,
          requestText,
          history,
          activeStudyContext: shouldSendInlineStudyMaterial ? params.activeStudyContext : undefined,
          fileSearchStoreName,
          expectsInlineRating,
          engineMode: params.engineMode,
          getTtsState: params.getTtsState,
          playTtsChunk: params.playTtsChunk,
          onVisibleText: params.setStreamingBotText,
        });

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: MessageRole.BOT,
          text: fullResponse,
          timestamp: new Date(),
        };
        params.setMessages((prev) => [...prev, botMessage]);
        params.setStreamingBotText('');
        params.setIsTyping(false);

        if (hasLearningGoals && previousGoal && params.isLearningGoalAiEnabled) {
          const aiSuggestion =
            inlineRating ??
            parseInlineLearningGoalRating(fullResponse) ??
            inferAiLearningGoalSuggestionFromTutorText(fullResponse);
          params.setLearningGoalAiSuggestions((prev) => ({
            ...prev,
            [previousGoal]: aiSuggestion,
          }));
        }

        if (hasLearningGoals && nextGoalText) {
          params.lastAskedLearningGoalRef.current = nextGoalText;
          const questionMatches = fullResponse.match(/[^?]*\?/g) ?? [];
          const lastQuestion =
            questionMatches.length > 0 ? questionMatches[questionMatches.length - 1].trim() : '';
          if (lastQuestion) {
            const prev = params.askedQuestionsByGoalRef.current[nextGoalText] ?? [];
            params.askedQuestionsByGoalRef.current[nextGoalText] = [...prev, lastQuestion];
          }
        }
      } catch {
        params.setIsTyping(false);
      }
    },
    [params]
  );
}
