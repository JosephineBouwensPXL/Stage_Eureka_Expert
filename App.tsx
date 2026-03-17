import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MessageRole,
  Message,
  User,
  ModeAccess,
  StudyItem,
  ClassicSttMode,
  ClassicTtsMode,
} from './types';
import AuthScreen from './components/AuthScreen';
import { LearningGoal } from './components/LearningGoalsPanel';
import { SettingsTab } from './components/settings/SettingsModal';
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
  const [isClassicTtsEnabled, setIsClassicTtsEnabled] = useState<boolean>(
    () => localStorage.getItem('studybuddy_classic_audio_enabled') !== 'false'
  );
  const [isNativeTtsEnabled, setIsNativeTtsEnabled] = useState<boolean>(
    () => localStorage.getItem('studybuddy_native_audio_enabled') !== 'false'
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('algemeen');
  const [showAdmin, setShowAdmin] = useState(false);

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
    activeLearningGoalText,
    setActiveLearningGoalText,
    setLearningGoalCellRating,
    addLearningGoalColumn,
    removeLearningGoalColumn,
    addLearningGoalStarter,
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

  const detectedLearningGoals = useMemo<LearningGoal[]>(
    () => extractDetectedLearningGoals(studyItems, learningGoalStarters),
    [learningGoalStarters, studyItems]
  );

  const hasSelectedLearningGoalsDocument = useMemo(() => {
    return hasSelectedLearningGoalsDocumentInItems(studyItems);
  }, [studyItems]);

  const learningGoalBuckets = useMemo(() => {
    return buildLearningGoalBuckets({
      detectedLearningGoals,
      learningGoalColumns,
      learningGoalRatings,
      isLearningGoalAiEnabled,
      learningGoalAiSuggestions,
    });
  }, [
    detectedLearningGoals,
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
      setShowAdmin(false);
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
    localStorage.setItem('studybuddy_classic_audio_enabled', String(isClassicTtsEnabled));
  }, [isClassicTtsEnabled]);

  useEffect(() => {
    localStorage.setItem('studybuddy_native_audio_enabled', String(isNativeTtsEnabled));
  }, [isNativeTtsEnabled]);

  useEffect(() => {
    const ttsEnabled = engineMode === ModeAccess.CLASSIC ? isClassicTtsEnabled : isNativeTtsEnabled;
    if (!ttsEnabled) stopAllTts();
  }, [engineMode, isClassicTtsEnabled, isNativeTtsEnabled, stopAllTts]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setMessages([]);
  };

  const uploadFiles = async (
    files: File[],
    options?: { markAsLearningGoalsDocument?: boolean }
  ) => {
    if (files.length === 0) return;

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
    if ('target' in e) (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
  };

  const handleLearningGoalsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
    await uploadFiles(files, { markAsLearningGoalsDocument: true });
    e.currentTarget.value = '';
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
    const result = deleteStudyItem(studyItems, id);
    if (result.blocked) {
      alert('Dit document is toegewezen door een docent en kan niet worden verwijderd.');
      return;
    }
    setStudyItems(result.items);
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
    detectedLearningGoals,
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

  if (!currentUser) return <AuthScreen onLoginSuccess={(user) => setCurrentUser(user)} />;

  return (
    <AppView
      currentUser={{ id: currentUser.id, firstName: currentUser.firstName, role: currentUser.role }}
      showAdmin={showAdmin}
      onCloseAdmin={() => setShowAdmin(false)}
      selectedCount={selectedCount}
      isVoiceActive={isVoiceActive}
      onOpenUpload={() => setShowUpload(true)}
      onStartVoice={() => setIsVoiceActive(true)}
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
      isLearningGoalsQuestioningEnabled={isLearningGoalsQuestioningEnabled}
      onToggleLearningGoalsQuestioning={() => setIsLearningGoalsQuestioningEnabled((prev) => !prev)}
      isLearningGoalAiEnabled={isLearningGoalAiEnabled}
      onToggleLearningGoalAi={() => setIsLearningGoalAiEnabled((prev) => !prev)}
      learningGoalStarters={learningGoalStarters}
      onAddLearningGoalStarter={addLearningGoalStarter}
      onSetLearningGoalStarter={setLearningGoalStarter}
      onRemoveLearningGoalStarter={removeLearningGoalStarter}
      onLogout={handleLogout}
      onCloseSettings={() => setShowSettings(false)}
      showUpload={showUpload}
      onCloseUpload={() => setShowUpload(false)}
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
      onSend={() => void handleSend()}
      hasSelectedLearningGoalsDocument={hasSelectedLearningGoalsDocument}
      detectedLearningGoals={detectedLearningGoals}
      learningGoalRatings={learningGoalRatings}
      learningGoalAiSuggestions={learningGoalAiSuggestions}
      learningGoalColumns={learningGoalColumns}
      activeLearningGoalText={activeLearningGoalText}
      onSetLearningGoalCellRating={setLearningGoalCellRating}
      onAddLearningGoalColumn={addLearningGoalColumn}
      onRemoveLearningGoalColumn={removeLearningGoalColumn}
      onResetLearningGoalAiEvaluation={() => setLearningGoalAiSuggestions({})}
    />
  );
};

export default App;
