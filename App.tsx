import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MessageRole,
  Message,
  User,
  ModeAccess,
  StudyItem,
  ClassicSttMode,
  ClassicTtsMode,
  NativeSttMode,
  NativeTtsMode,
} from './types';
import AuthScreen from './components/AuthScreen';
import { LearningGoal } from './components/LearningGoalsPanel';
import { SettingsTab, type WalkthroughStream } from './components/settings/SettingsModal';
import { AppView } from './components/AppView';
import { api, authEvents } from './services/api';
import {
  buildLearningGoalBuckets,
  extractDetectedLearningGoals,
  hasSelectedLearningGoalsDocument as hasSelectedLearningGoalsDocumentInItems,
} from './services/learningGoals';
import { processUploadedFiles } from './services/studyUpload';
import {
  createFolderItem,
  deleteStudyItem,
  hasSelectableFilesInFolder as hasSelectableFilesInFolderInItems,
  isFolderSelectedInItems,
  moveStudyItem,
  renameStudyItem,
  setItemIconColorInItems,
  toggleFileSelectionInItems,
  toggleFolderSelectionInItems,
} from './services/studyItemMutations';
import { useTtsQueue } from './hooks/useTtsQueue';
import { useChatSend } from './hooks/useChatSend';
import { useLearningGoalsState } from './hooks/useLearningGoalsState';
import {
  buildActiveStudyContext,
  buildBreadcrumbs,
  countSelectedRegularFiles,
  getStudyItemsStorageKey,
  parseStoredStudyItems,
} from './services/studyItems';
import { getClassicSttProviderId, getSttProvider } from './services/speech/stt';
import { SttCaptureSession } from './services/speech/stt/types';

const App: React.FC = () => {
  const MAX_LEARNING_GOAL_COLUMNS = 5;
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    () => localStorage.getItem('studybuddy_theme') === 'dark'
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isInputRecording, setIsInputRecording] = useState(false);
  const [, setIsBotSpeaking] = useState(false);
  const [engineMode, setEngineMode] = useState<'native' | 'classic'>('classic');
  const [classicSttMode, setClassicSttMode] = useState<ClassicSttMode>(() => {
    const saved = localStorage.getItem('studybuddy_classic_stt_mode');
    return saved === 'browser' ? 'browser' : 'local';
  });
  const [classicTtsMode, setClassicTtsMode] = useState<ClassicTtsMode>(() => {
    const saved = localStorage.getItem('studybuddy_classic_tts_mode');
    return saved === 'local' ? 'local' : 'browser';
  });
  const [nativeSttMode, setNativeSttMode] = useState<NativeSttMode>(() => {
    const saved = localStorage.getItem('studybuddy_native_stt_mode');
    return saved === 'browser' ? 'browser' : 'elevenlabs';
  });
  const [isClassicTtsEnabled, setIsClassicTtsEnabled] = useState<boolean>(
    () => localStorage.getItem('studybuddy_classic_audio_enabled') !== 'false'
  );
  const [isNativeTtsEnabled, setIsNativeTtsEnabled] = useState<boolean>(
    () => localStorage.getItem('studybuddy_native_audio_enabled') !== 'false'
  );
  const [nativeTtsMode, setNativeTtsMode] = useState<NativeTtsMode>(() => {
    const saved = localStorage.getItem('studybuddy_native_tts_mode');
    return saved === 'browser' ? 'browser' : 'elevenlabs';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('algemeen');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showWelcomeTourPrompt, setShowWelcomeTourPrompt] = useState(false);
  const [isWalkthroughNarrationEnabled, setIsWalkthroughNarrationEnabled] = useState(false);
  const [uploadWalkthroughResetToken, setUploadWalkthroughResetToken] = useState(0);
  const [uploadWalkthroughMode, setUploadWalkthroughMode] = useState<
    'full' | 'learning-goals-only'
  >('full');
  const [appWalkthroughStream, setAppWalkthroughStream] = useState<WalkthroughStream>('volledig');
  const [appWalkthroughResetToken, setAppWalkthroughResetToken] = useState(0);
  const [continueFullAppAfterUpload, setContinueFullAppAfterUpload] = useState(false);
  const [continueLearningGoalsTourAfterUpload, setContinueLearningGoalsTourAfterUpload] =
    useState(false);

  // File Management State
  const [studyItems, setStudyItems] = useState<StudyItem[]>([]);
  const [isStudyItemsReady, setIsStudyItemsReady] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingBotText, setStreamingBotText] = useState('');

  const learningGoalCycleIndexRef = useRef(0);
  const learningGoalAllGreenIndexRef = useRef(0);
  const lastAskedLearningGoalRef = useRef<string | null>(null);
  const askedQuestionsByGoalRef = useRef<Record<string, string[]>>({});
  const inputSttSessionRef = useRef<SttCaptureSession | null>(null);
  const inputSttPreviewSessionRef = useRef<SttCaptureSession | null>(null);
  const inputRecordingBaseTextRef = useRef('');
  const inputRecordingPreviewTextRef = useRef('');

  const {
    learningGoalRatings,
    setLearningGoalRatings,
    learningGoalAiSuggestions,
    setLearningGoalAiSuggestions,
    learningGoalColumns,
    isLearningGoalAiEnabled,
    setIsLearningGoalAiEnabled,
    isLearningGoalsQuestioningEnabled,
    setIsLearningGoalsQuestioningEnabled,
    learningGoalStarters,
    customLearningGoals,
    hiddenLearningGoals,
    disabledLearningGoals,
    isLearningGoalTableExtractionEnabled,
    setIsLearningGoalTableExtractionEnabled,
    learningGoalTableColumnIndex,
    setLearningGoalTableColumnIndex,
    activeLearningGoalText,
    setActiveLearningGoalText,
    setLearningGoalCellRating,
    addLearningGoalColumn,
    removeLearningGoalColumn,
    addLearningGoalStarter,
    addCustomLearningGoal,
    toggleLearningGoalDisabled,
    removeLearningGoal,
    setLearningGoalStarter,
    removeLearningGoalStarter,
  } = useLearningGoalsState({
    userId: currentUser?.id,
    maxColumns: MAX_LEARNING_GOAL_COLUMNS,
  });

  const {
    playTtsChunk,
    stopAll: stopAllTts,
    getState: getTtsState,
  } = useTtsQueue({
    engineMode,
    classicTtsMode,
    nativeTtsMode,
    isClassicTtsEnabled,
    isNativeTtsEnabled,
    setIsBotSpeaking,
  });

  const studyItemsStorageKey = useMemo(() => getStudyItemsStorageKey(currentUser), [currentUser]);

  // Persistence
  useEffect(() => {
    setIsStudyItemsReady(false);

    if (!studyItemsStorageKey) {
      setStudyItems([]);
      setCurrentFolderId(null);
      setMovingItemId(null);
      return;
    }

    const userScoped = localStorage.getItem(studyItemsStorageKey);
    if (userScoped !== null) {
      setStudyItems(parseStoredStudyItems(userScoped));
      setCurrentFolderId(null);
      setMovingItemId(null);
      setIsStudyItemsReady(true);
      return;
    }

    // One-time migration from old shared key to current user-scoped key.
    const legacyRaw = localStorage.getItem('studybuddy_study_items');
    if (legacyRaw !== null) {
      localStorage.setItem(studyItemsStorageKey, legacyRaw);
      localStorage.removeItem('studybuddy_study_items');
      setStudyItems(parseStoredStudyItems(legacyRaw));
    } else {
      setStudyItems([]);
    }
    setCurrentFolderId(null);
    setMovingItemId(null);
    setIsStudyItemsReady(true);
  }, [studyItemsStorageKey]);

  useEffect(() => {
    if (!studyItemsStorageKey || !isStudyItemsReady) return;
    localStorage.setItem(studyItemsStorageKey, JSON.stringify(studyItems));
  }, [studyItems, studyItemsStorageKey, isStudyItemsReady]);

  // Combined context for the AI
  const activeStudyContext = useMemo(() => {
    return buildActiveStudyContext(studyItems);
  }, [studyItems]);

  const selectedCount = useMemo(() => countSelectedRegularFiles(studyItems), [studyItems]);

  const selectedLearningGoalStudyItems = useMemo(
    () =>
      studyItems.filter(
        (item) =>
          item.type === 'file' &&
          item.selected &&
          (item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
      ),
    [studyItems]
  );

  const detectedLearningGoals = useMemo<LearningGoal[]>(
    () => {
      const hiddenGoals = new Set(
        hiddenLearningGoals.map((goal) => goal.trim().toLowerCase()).filter(Boolean)
      );
      const extractedGoals = extractDetectedLearningGoals(
        selectedLearningGoalStudyItems,
        learningGoalStarters,
        {
          isTableExtractionEnabled: isLearningGoalTableExtractionEnabled,
          tableGoalColumnIndex: learningGoalTableColumnIndex,
        }
      ).filter((goal) => !hiddenGoals.has(goal.text.trim().toLowerCase()));
      const seenGoalTexts = new Set(extractedGoals.map((goal) => goal.text.trim().toLowerCase()));
      const manualGoals: LearningGoal[] = customLearningGoals
        .map((goalText, index) => ({
          id: `custom-goal-${index + 1}`,
          text: goalText.trim(),
          createdAt: new Date(0),
        }))
        .filter((goal) => goal.text.length >= 4)
        .filter((goal) => !hiddenGoals.has(goal.text.toLowerCase()))
        .filter((goal) => {
          const key = goal.text.toLowerCase();
          if (seenGoalTexts.has(key)) return false;
          seenGoalTexts.add(key);
          return true;
        });

      return [...extractedGoals, ...manualGoals];
    },
    [
      customLearningGoals,
      hiddenLearningGoals,
      isLearningGoalTableExtractionEnabled,
      learningGoalTableColumnIndex,
      learningGoalStarters,
      selectedLearningGoalStudyItems,
    ]
  );

  const enabledLearningGoals = useMemo<LearningGoal[]>(() => {
    const disabledSet = new Set(
      disabledLearningGoals.map((goal) => goal.trim().toLowerCase()).filter(Boolean)
    );
    return detectedLearningGoals.filter((goal) => !disabledSet.has(goal.text.trim().toLowerCase()));
  }, [detectedLearningGoals, disabledLearningGoals]);

  const handleAddLearningGoal = useCallback(
    (goalText: string) => {
      addCustomLearningGoal(goalText);
    },
    [addCustomLearningGoal]
  );

  const handleToggleLearningGoalDisabled = useCallback(
    (goalText: string) => {
      toggleLearningGoalDisabled(goalText);
      if (activeLearningGoalText?.trim().toLowerCase() === goalText.trim().toLowerCase()) {
        setActiveLearningGoalText(null);
      }
    },
    [activeLearningGoalText, setActiveLearningGoalText, toggleLearningGoalDisabled]
  );

  const handleRemoveLearningGoal = useCallback(
    (goalText: string) => {
      removeLearningGoal(goalText);
      if (activeLearningGoalText?.trim().toLowerCase() === goalText.trim().toLowerCase()) {
        setActiveLearningGoalText(null);
      }
    },
    [activeLearningGoalText, removeLearningGoal, setActiveLearningGoalText]
  );

  const hasSelectedLearningGoalsDocument = useMemo(() => {
    return hasSelectedLearningGoalsDocumentInItems(studyItems);
  }, [studyItems]);

  useEffect(() => {
    if (hasSelectedLearningGoalsDocument) return;
    setIsLearningGoalsQuestioningEnabled(false);
  }, [hasSelectedLearningGoalsDocument, setIsLearningGoalsQuestioningEnabled]);

  const learningGoalBuckets = useMemo(() => {
    return buildLearningGoalBuckets({
      detectedLearningGoals: enabledLearningGoals,
      learningGoalColumns,
      learningGoalRatings,
      isLearningGoalAiEnabled,
      learningGoalAiSuggestions,
    });
  }, [
    enabledLearningGoals,
    learningGoalColumns,
    learningGoalRatings,
    isLearningGoalAiEnabled,
    learningGoalAiSuggestions,
  ]);

  useEffect(() => {
    learningGoalCycleIndexRef.current = 0;
    learningGoalAllGreenIndexRef.current = 0;
    lastAskedLearningGoalRef.current = null;
    askedQuestionsByGoalRef.current = {};
    setActiveLearningGoalText(null);
  }, [
    learningGoalBuckets.emptyGoals.length,
    learningGoalBuckets.redGoals.length,
    learningGoalBuckets.blueGoals.length,
    learningGoalBuckets.greenGoals.length,
    setActiveLearningGoalText,
  ]);

  useEffect(() => {
    if (isLearningGoalsQuestioningEnabled) return;
    learningGoalCycleIndexRef.current = 0;
    learningGoalAllGreenIndexRef.current = 0;
    lastAskedLearningGoalRef.current = null;
    askedQuestionsByGoalRef.current = {};
    setActiveLearningGoalText(null);
  }, [isLearningGoalsQuestioningEnabled, setActiveLearningGoalText]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studybuddy_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studybuddy_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser) setEngineMode(currentUser.modeAccess);
  }, [currentUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setShowSettings(false);
      setSettingsTab('algemeen');
      setShowAdmin(false);
      setShowWelcomeTourPrompt(false);
      setIsWalkthroughNarrationEnabled(false);
      setMessages([]);
    };

    window.addEventListener(authEvents.AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(authEvents.AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  useEffect(() => {
    localStorage.setItem('studybuddy_classic_stt_mode', classicSttMode);
  }, [classicSttMode]);

  useEffect(() => {
    localStorage.setItem('studybuddy_classic_tts_mode', classicTtsMode);
  }, [classicTtsMode]);

  useEffect(() => {
    localStorage.setItem('studybuddy_native_stt_mode', nativeSttMode);
  }, [nativeSttMode]);

  useEffect(() => {
    localStorage.setItem('studybuddy_classic_audio_enabled', String(isClassicTtsEnabled));
  }, [isClassicTtsEnabled]);

  useEffect(() => {
    localStorage.setItem('studybuddy_native_audio_enabled', String(isNativeTtsEnabled));
  }, [isNativeTtsEnabled]);

  useEffect(() => {
    localStorage.setItem('studybuddy_native_tts_mode', nativeTtsMode);
  }, [nativeTtsMode]);

  useEffect(() => {
    const ttsEnabled = engineMode === ModeAccess.CLASSIC ? isClassicTtsEnabled : isNativeTtsEnabled;
    if (!ttsEnabled) stopAllTts();
  }, [engineMode, isClassicTtsEnabled, isNativeTtsEnabled, stopAllTts]);

  useEffect(() => {
    return () => {
      inputSttSessionRef.current?.stop();
      inputSttSessionRef.current = null;
      inputSttPreviewSessionRef.current?.stop();
      inputSttPreviewSessionRef.current = null;
    };
  }, []);

  const handleLogout = () => {
    inputSttSessionRef.current?.stop();
    inputSttSessionRef.current = null;
    inputSttPreviewSessionRef.current?.stop();
    inputSttPreviewSessionRef.current = null;
    setIsInputRecording(false);
    api.logout();
    setCurrentUser(null);
    setShowSettings(false);
    setSettingsTab('algemeen');
    setShowAdmin(false);
    setShowWelcomeTourPrompt(false);
    setIsWalkthroughNarrationEnabled(false);
    setMessages([]);
  };

  const handleRestartWalkthrough = useCallback((stream: WalkthroughStream) => {
    setSettingsTab('algemeen');
    setShowSettings(false);
    setIsVoiceActive(false);

    if (stream === 'volledig') {
      localStorage.removeItem('studybuddy_upload_library_walkthrough_seen_v1');
      setUploadWalkthroughResetToken((prev) => prev + 1);
      setUploadWalkthroughMode('full');
      setCurrentFolderId(null);
      setShowUpload(false);
      setContinueFullAppAfterUpload(true);
      setContinueLearningGoalsTourAfterUpload(false);
      setAppWalkthroughStream('volledig');
      setAppWalkthroughResetToken((prev) => prev + 1);
      return;
    }

    if (stream === 'bibliotheek' || stream === 'leerdoelen') {
      localStorage.removeItem('studybuddy_upload_library_walkthrough_seen_v1');
      setUploadWalkthroughResetToken((prev) => prev + 1);
      setUploadWalkthroughMode(stream === 'leerdoelen' ? 'learning-goals-only' : 'full');
      setCurrentFolderId(null);
      setShowUpload(true);
      setContinueFullAppAfterUpload(false);
      setContinueLearningGoalsTourAfterUpload(stream === 'leerdoelen');
      return;
    }

    setContinueFullAppAfterUpload(false);
    setContinueLearningGoalsTourAfterUpload(false);
    setUploadWalkthroughMode('full');
    setShowUpload(false);
    setAppWalkthroughStream(stream);
    setAppWalkthroughResetToken((prev) => prev + 1);
  }, []);

  const handleUploadWalkthroughCompleted = useCallback((status: 'finished' | 'skipped') => {
    if (!continueFullAppAfterUpload && !continueLearningGoalsTourAfterUpload) return;
    if (status === 'skipped') {
      setContinueFullAppAfterUpload(false);
      setContinueLearningGoalsTourAfterUpload(false);
      return;
    }
    if (continueFullAppAfterUpload) {
      setContinueFullAppAfterUpload(false);
      setShowUpload(false);
      setAppWalkthroughStream('volledig-na-bibliotheek');
      setAppWalkthroughResetToken((prev) => prev + 1);
    }
  }, [continueFullAppAfterUpload, continueLearningGoalsTourAfterUpload]);

  const uploadFiles = async (
    files: File[],
    options?: { markAsLearningGoalsDocument?: boolean }
  ): Promise<boolean> => {
    if (files.length === 0) return false;

    setIsExtracting(true);
    try {
      const { uploadedItems, failedFiles, failedReasons } = await processUploadedFiles(files, {
        currentFolderId,
        markAsLearningGoalsDocument: options?.markAsLearningGoalsDocument,
      });

      if (uploadedItems.length > 0) {
        setStudyItems((prev) => [...prev, ...uploadedItems]);
      }

      if (failedFiles.length > 0) {
        const firstReason = failedReasons[0] ? ` Reden: ${failedReasons[0]}` : '';
        alert(
          `Deze bestanden konden niet worden gelezen: ${failedFiles.join(', ')}. Ondersteund: .txt, .docx, .pdf, .pptx.${firstReason}`
        );
      }
      return uploadedItems.length > 0;
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: File[] = [];
    if ('target' in e) {
      const inputFiles = (e as React.ChangeEvent<HTMLInputElement>).target.files;
      files = inputFiles ? Array.from(inputFiles) : [];
    } else {
      e.preventDefault();
      files = Array.from((e as React.DragEvent).dataTransfer.files || []);
    }
    await uploadFiles(files);
  };

  const handleLearningGoalsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
    const uploaded = await uploadFiles(files, { markAsLearningGoalsDocument: true });
    if (uploaded && continueLearningGoalsTourAfterUpload) {
      setContinueLearningGoalsTourAfterUpload(false);
      setShowUpload(false);
      setAppWalkthroughStream('leerdoelen');
      setAppWalkthroughResetToken((prev) => prev + 1);
    }
  };

  const handleFileDrop = async (files: File[]) => {
    await uploadFiles(files);
  };

  const createFolder = (name: string) => {
    const newFolder = createFolderItem(name, currentFolderId);
    if (!newFolder) return;
    setStudyItems((prev) => [...prev, newFolder]);
  };

  const renameItem = (id: string, newName: string) => {
    setStudyItems((prev) => renameStudyItem(prev, id, newName));
  };

  const deleteItem = (id: string) => {
    const nextItems = deleteStudyItem(studyItems, id);
    setStudyItems(nextItems);
  };

  const moveItem = (targetFolderId: string | null) => {
    if (!movingItemId) return;
    setStudyItems((prev) => moveStudyItem(prev, movingItemId, targetFolderId));
    setMovingItemId(null);
  };

  const toggleFileSelection = (id: string) => {
    setStudyItems((prev) => toggleFileSelectionInItems(prev, id));
  };

  const hasSelectableFilesInFolder = (folderId: string): boolean => {
    return hasSelectableFilesInFolderInItems(studyItems, folderId);
  };

  const isFolderSelected = (folderId: string): boolean => {
    return isFolderSelectedInItems(studyItems, folderId);
  };

  const toggleFolderSelection = (folderId: string) => {
    setStudyItems((prev) => toggleFolderSelectionInItems(prev, folderId));
  };

  const setItemIconColor = (id: string, color: string) => {
    setStudyItems((prev) => setItemIconColorInItems(prev, id, color));
  };

  const handleSend = useChatSend({
    inputText,
    setInputText,
    messages,
    setMessages,
    setIsTyping,
    setStreamingBotText,
    stopAllTts,
    getTtsState,
    playTtsChunk,
    engineMode,
    currentUser,
    studyItems,
    activeStudyContext,
    isLearningGoalsQuestioningEnabled,
    detectedLearningGoals: enabledLearningGoals,
    learningGoalBuckets,
    isLearningGoalAiEnabled,
    learningGoalCycleIndexRef,
    learningGoalAllGreenIndexRef,
    lastAskedLearningGoalRef,
    askedQuestionsByGoalRef,
    setActiveLearningGoalText,
    setLearningGoalRatings,
    setLearningGoalAiSuggestions,
  });

  const handleTranscriptionUpdate = useCallback((text: string, role: 'user' | 'bot') => {
    if (role === 'user') setStreamingUserText(text);
    else setStreamingBotText(text);
  }, []);

  const handleTurnComplete = useCallback((userText: string, botText: string) => {
    const timestamp = new Date();
    const newEntries: Message[] = [];
    if (userText.trim())
      newEntries.push({
        id: `v-u-${timestamp.getTime()}`,
        role: MessageRole.USER,
        text: userText.trim(),
        timestamp,
      });
    if (botText.trim())
      newEntries.push({
        id: `v-b-${timestamp.getTime() + 1}`,
        role: MessageRole.BOT,
        text: botText.trim(),
        timestamp,
      });
    if (newEntries.length > 0) setMessages((prev) => [...prev, ...newEntries]);
    setStreamingUserText('');
    setStreamingBotText('');
  }, []);

  const currentItems = studyItems.filter((item) => item.parentId === currentFolderId);
  const breadcrumbs = useMemo(() => {
    return buildBreadcrumbs(studyItems, currentFolderId);
  }, [currentFolderId, studyItems]);

  const handleToggleInputRecording = useCallback(async () => {
    if (isVoiceActive) return;

    if (inputSttSessionRef.current || inputSttPreviewSessionRef.current) {
      console.info('[Input STT] Stop requested');
      inputSttSessionRef.current?.stop();
      inputSttPreviewSessionRef.current?.stop();
      return;
    }

    inputRecordingBaseTextRef.current = inputText;
    inputRecordingPreviewTextRef.current = '';
    setIsInputRecording(true);

    try {
      const browserProvider = getSttProvider('browser');
      const previewHandler = (transcript: string) => {
        inputRecordingPreviewTextRef.current = transcript.trim();
        const baseText = inputRecordingBaseTextRef.current.trim();
        const previewText = inputRecordingPreviewTextRef.current;
        setInputText(baseText ? `${baseText} ${previewText}`.trim() : previewText);
      };

      const provider =
        classicSttMode === 'browser'
          ? browserProvider
          : engineMode === ModeAccess.NATIVE
            ? getSttProvider(nativeSttMode === 'browser' ? 'browser' : 'elevenlabs')
            : getSttProvider(getClassicSttProviderId(classicSttMode));

      console.info('[Input STT] Starting capture', {
        engineMode,
        classicSttMode,
        nativeSttMode,
        provider: provider.id,
      });

      if (provider.id !== 'browser') {
        try {
          const previewSession = await browserProvider.captureOnce({
            language: 'nl-NL',
            maxDurationMs: 120000,
            onInterimTranscript: previewHandler,
          });
          inputSttPreviewSessionRef.current = previewSession;
          console.info('[Input STT] Browser preview session started');
        } catch {
          inputSttPreviewSessionRef.current = null;
          console.warn('[Input STT] Browser preview session failed to start');
        }
      } else {
        inputSttPreviewSessionRef.current = null;
      }

      const session = await provider.captureOnce({
        language: provider.id === 'browser' ? 'nl-NL' : 'nl',
        maxDurationMs: 120000,
        onInterimTranscript: provider.id === 'browser' ? previewHandler : undefined,
      });

      inputSttSessionRef.current = session;

      const transcript = await session.result;
      console.info('[Input STT] Capture finished', {
        provider: provider.id,
        transcriptLength: transcript?.trim().length ?? 0,
      });
      if (inputSttSessionRef.current === session) {
        inputSttSessionRef.current = null;
      }
      const previewSession = inputSttPreviewSessionRef.current;
      inputSttPreviewSessionRef.current = null;
      previewSession?.stop();
      setIsInputRecording(false);

      const finalTranscript = transcript?.trim() || inputRecordingPreviewTextRef.current.trim();
      const baseText = inputRecordingBaseTextRef.current.trim();
      inputRecordingPreviewTextRef.current = '';

      if (!finalTranscript) {
        setInputText(inputRecordingBaseTextRef.current);
        return;
      }

      setInputText(baseText ? `${baseText} ${finalTranscript}` : finalTranscript);
    } catch (error) {
      console.error('Input dictation failed:', error);
      inputSttSessionRef.current = null;
      inputSttPreviewSessionRef.current?.stop();
      inputSttPreviewSessionRef.current = null;
      inputRecordingPreviewTextRef.current = '';
      setInputText(inputRecordingBaseTextRef.current);
      setIsInputRecording(false);
      alert('Spraakopname voor het tekstveld kon niet gestart worden.');
    }
  }, [classicSttMode, engineMode, inputText, isVoiceActive, nativeSttMode]);

  if (!currentUser)
    return (
      <AuthScreen
        onLoginSuccess={(user, options) => {
          setCurrentUser(user);
          setShowSettings(false);
          setSettingsTab('algemeen');
          setShowAdmin(false);
          setShowWelcomeTourPrompt(Boolean(options?.justRegistered));
          setIsWalkthroughNarrationEnabled(false);
        }}
      />
    );

  return (
    <AppView
      currentUser={{ id: currentUser.id, firstName: currentUser.firstName, role: currentUser.role }}
      showWelcomeTourPrompt={showWelcomeTourPrompt}
      isWalkthroughNarrationEnabled={isWalkthroughNarrationEnabled}
      onWalkthroughNarrationChange={setIsWalkthroughNarrationEnabled}
      onStartWelcomeTour={() => {
        setShowWelcomeTourPrompt(false);
        handleRestartWalkthrough('volledig');
      }}
      onDismissWelcomeTourPrompt={() => {
        setShowWelcomeTourPrompt(false);
        setIsWalkthroughNarrationEnabled(false);
      }}
      showAdmin={showAdmin}
      onCloseAdmin={() => setShowAdmin(false)}
      selectedCount={selectedCount}
      isVoiceActive={isVoiceActive}
      onOpenUpload={() => {
        setUploadWalkthroughMode('full');
        setContinueLearningGoalsTourAfterUpload(false);
        setShowUpload(true);
      }}
      onStartVoice={() => {
        if (isVoiceActive) {
          setIsVoiceActive(false);
          return;
        }

        if (engineMode === ModeAccess.NATIVE) {
          setIsNativeTtsEnabled(true);
        } else {
          setIsClassicTtsEnabled(true);
        }
        setIsVoiceActive(true);
      }}
      onOpenAdmin={() => setShowAdmin(true)}
      onOpenSettings={() => setShowSettings(true)}
      showSettings={showSettings}
      settingsTab={settingsTab}
      onSettingsTabChange={setSettingsTab}
      isDarkMode={isDarkMode}
      onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      engineMode={engineMode}
      classicSttMode={classicSttMode}
      onClassicSttModeChange={setClassicSttMode}
      isClassicTtsEnabled={isClassicTtsEnabled}
      onToggleClassicTts={() => setIsClassicTtsEnabled((prev) => !prev)}
      classicTtsMode={classicTtsMode}
      onClassicTtsModeChange={setClassicTtsMode}
      isNativeTtsEnabled={isNativeTtsEnabled}
      onToggleNativeTts={() => setIsNativeTtsEnabled((prev) => !prev)}
      nativeSttMode={nativeSttMode}
      onNativeSttModeChange={setNativeSttMode}
      nativeTtsMode={nativeTtsMode}
      onNativeTtsModeChange={setNativeTtsMode}
      isLearningGoalsQuestioningEnabled={isLearningGoalsQuestioningEnabled}
      onToggleLearningGoalsQuestioning={() => setIsLearningGoalsQuestioningEnabled((prev) => !prev)}
      isLearningGoalAiEnabled={isLearningGoalAiEnabled}
      onToggleLearningGoalAi={() => setIsLearningGoalAiEnabled((prev) => !prev)}
      learningGoalStarters={learningGoalStarters}
      onAddLearningGoalStarter={addLearningGoalStarter}
      onSetLearningGoalStarter={setLearningGoalStarter}
      onRemoveLearningGoalStarter={removeLearningGoalStarter}
      isLearningGoalTableExtractionEnabled={isLearningGoalTableExtractionEnabled}
      onToggleLearningGoalTableExtraction={() =>
        setIsLearningGoalTableExtractionEnabled((prev) => !prev)
      }
      learningGoalTableColumnIndex={learningGoalTableColumnIndex}
      onSetLearningGoalTableColumnIndex={setLearningGoalTableColumnIndex}
      onRestartWalkthrough={handleRestartWalkthrough}
      onLogout={handleLogout}
      onCloseSettings={() => setShowSettings(false)}
      showUpload={showUpload}
      onCloseUpload={() => {
        setShowUpload(false);
        setContinueLearningGoalsTourAfterUpload(false);
        setUploadWalkthroughMode('full');
      }}
      currentFolderId={currentFolderId}
      onOpenFolder={setCurrentFolderId}
      breadcrumbs={breadcrumbs}
      movingItemId={movingItemId}
      onSetMovingItemId={setMovingItemId}
      onMoveItem={moveItem}
      onCreateFolder={createFolder}
      onFileUpload={handleFileUpload}
      onLearningGoalsFileUpload={handleLearningGoalsFileUpload}
      onFileDrop={handleFileDrop}
      isExtracting={isExtracting}
      currentItems={currentItems}
      onRenameItem={renameItem}
      onDeleteItem={deleteItem}
      onToggleFileSelection={toggleFileSelection}
      onToggleFolderSelection={toggleFolderSelection}
      isFolderSelected={isFolderSelected}
      hasSelectableFilesInFolder={hasSelectableFilesInFolder}
      onSetItemIconColor={setItemIconColor}
      uploadWalkthroughResetToken={uploadWalkthroughResetToken}
      uploadWalkthroughMode={uploadWalkthroughMode}
      onUploadWalkthroughCompleted={handleUploadWalkthroughCompleted}
      appWalkthroughStream={appWalkthroughStream}
      appWalkthroughResetToken={appWalkthroughResetToken}
      activeStudyContext={activeStudyContext}
      ragSelectedStudyItems={studyItems.filter((item) => item.type === 'file' && item.selected)}
      onCloseVoice={() => setIsVoiceActive(false)}
      onTranscriptionUpdate={handleTranscriptionUpdate}
      onTurnComplete={handleTurnComplete}
      onBotSpeakingChange={setIsBotSpeaking}
      messages={messages}
      isTyping={isTyping}
      streamingUserText={streamingUserText}
      streamingBotText={streamingBotText}
      inputText={inputText}
      onInputTextChange={setInputText}
      isInputRecording={isInputRecording}
      onToggleInputRecording={() => void handleToggleInputRecording()}
      onSend={() => void handleSend()}
      hasSelectedLearningGoalsDocument={hasSelectedLearningGoalsDocument}
      detectedLearningGoals={detectedLearningGoals}
      disabledLearningGoalTexts={disabledLearningGoals}
      learningGoalRatings={learningGoalRatings}
      learningGoalAiSuggestions={learningGoalAiSuggestions}
      learningGoalColumns={learningGoalColumns}
      activeLearningGoalText={activeLearningGoalText}
      onSetLearningGoalCellRating={setLearningGoalCellRating}
      onAddLearningGoalColumn={addLearningGoalColumn}
      onRemoveLearningGoalColumn={removeLearningGoalColumn}
      onAddLearningGoal={handleAddLearningGoal}
      onToggleLearningGoalDisabled={handleToggleLearningGoalDisabled}
      onRemoveLearningGoal={handleRemoveLearningGoal}
      onResetLearningGoalAiEvaluation={() => setLearningGoalAiSuggestions({})}
    />
  );
};

export default App;
