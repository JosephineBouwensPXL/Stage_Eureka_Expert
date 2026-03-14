
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MessageRole, Message, User, Role, ModeAccess, StudyItem, StudyItemType, ClassicSttMode, ClassicTtsMode } from './types';
import ChatWindow from './components/ChatWindow';
import VoiceInterface from './components/VoiceInterface';
import ClassicVoiceInterface from './components/ClassicVoiceInterface';
import AuthScreen from './components/AuthScreen';
import AdminPanel from './components/AdminPanel';
import UploadLibraryModal from './components/UploadLibrary';
import StudyBuddyLogo from './components/StudyBuddyLogo';
import LearningGoalsPanel, { LearningGoal, LearningGoalRating } from './components/LearningGoalsPanel';
import { getDefaultTextProviderId, streamChatWithProvider } from './services/llm';
import { syncSelectedStudyItemsToGeminiFileSearch } from './services/llm/geminiFileSearch';
import { api } from './services/api';
import { getChatTtsProviderId, getTtsProvider } from './services/speech/tts';
import { TtsPlaybackSession } from './services/speech/tts/types';

declare const pdfjsLib: any;

const DEFAULT_LEARNING_GOAL_STARTERS = ['Ik', '-', '*', '•', '1.'];
type SettingsTab = 'algemeen' | 'audio' | 'leerdoelen';

const App: React.FC = () => {
  const MAX_LEARNING_GOAL_COLUMNS = 5;
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('studybuddy_theme') === 'dark');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [engineMode, setEngineMode] = useState<'native' | 'classic'>('classic');
  const [classicSttMode, setClassicSttMode] = useState<ClassicSttMode>(() => {
    const saved = localStorage.getItem('studybuddy_classic_stt_mode');
    return saved === 'browser' ? 'browser' : 'local';
  });
  const [classicTtsMode, setClassicTtsMode] = useState<ClassicTtsMode>(() => {
    const saved = localStorage.getItem('studybuddy_classic_tts_mode');
    return saved === 'local' ? 'local' : 'browser';
  });
  const [isClassicTtsEnabled, setIsClassicTtsEnabled] = useState<boolean>(() => localStorage.getItem('studybuddy_classic_audio_enabled') !== 'false');
  const [isNativeTtsEnabled, setIsNativeTtsEnabled] = useState<boolean>(() => localStorage.getItem('studybuddy_native_audio_enabled') !== 'false');
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
  const [learningGoalRatings, setLearningGoalRatings] = useState<Record<string, (LearningGoalRating | null)[]>>({});
  const [learningGoalAiSuggestions, setLearningGoalAiSuggestions] = useState<Record<string, LearningGoalRating>>({});
  const [learningGoalColumns, setLearningGoalColumns] = useState<number>(1);
  const [isLearningGoalAiEnabled, setIsLearningGoalAiEnabled] = useState<boolean>(false);
  const [isLearningGoalsQuestioningEnabled, setIsLearningGoalsQuestioningEnabled] = useState<boolean>(true);
  const [learningGoalStarters, setLearningGoalStarters] = useState<string[]>(DEFAULT_LEARNING_GOAL_STARTERS);
  const [activeLearningGoalText, setActiveLearningGoalText] = useState<string | null>(null);
  const [isLearningGoalRatingsReady, setIsLearningGoalRatingsReady] = useState(false);
  
  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingBotText, setStreamingBotText] = useState('');

  const ttsPlaybackRef = useRef<TtsPlaybackSession | null>(null);
  const ttsQueue = useRef<string[]>([]);
  const isPlayingTts = useRef(false);
  const learningGoalCycleIndexRef = useRef(0);
  const learningGoalAllGreenIndexRef = useRef(0);
  const lastAskedLearningGoalRef = useRef<string | null>(null);
  const askedQuestionsByGoalRef = useRef<Record<string, string[]>>({});

  const getStudyItemsStorageKey = (user: User | null): string | null => {
    if (!user) return null;
    return `studybuddy_study_items_${user.id}`;
  };

  const getLearningGoalRatingsStorageKey = (user: User | null): string | null => {
    if (!user) return null;
    return `studybuddy_learning_goal_ratings_${user.id}`;
  };

  const parseStoredStudyItems = (raw: string | null): StudyItem[] => {
    if (!raw) return [];
    try {
      return JSON.parse(raw).map((i: any) => ({ ...i, createdAt: new Date(i.createdAt) }));
    } catch {
      return [];
    }
  };

  const studyItemsStorageKey = useMemo(
    () => getStudyItemsStorageKey(currentUser),
    [currentUser]
  );
  const learningGoalRatingsStorageKey = useMemo(
    () => getLearningGoalRatingsStorageKey(currentUser),
    [currentUser]
  );

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

  useEffect(() => {
    setIsLearningGoalRatingsReady(false);

    if (!learningGoalRatingsStorageKey) {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setIsLearningGoalRatingsReady(true);
      return;
    }
    const raw = localStorage.getItem(learningGoalRatingsStorageKey);
    if (!raw) {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setIsLearningGoalRatingsReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);

      // Backward compatibility: old format was Record<goalText, color>.
      if (parsed && !Array.isArray(parsed) && !parsed.ratings) {
        const migrated: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (value === 'red' || value === 'blue' || value === 'green') {
            migrated[goalText] = [value as LearningGoalRating];
          }
        }
        setLearningGoalRatings(migrated);
        setLearningGoalAiSuggestions({});
        setLearningGoalColumns(1);
        setIsLearningGoalAiEnabled(false);
        setIsLearningGoalsQuestioningEnabled(true);
        setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
        setIsLearningGoalRatingsReady(true);
        return;
      }

      const parsedColumns = Number(parsed?.columns);
      const safeColumns = Number.isFinite(parsedColumns) && parsedColumns > 0
        ? Math.min(MAX_LEARNING_GOAL_COLUMNS, Math.floor(parsedColumns))
        : 1;
      const parsedAiEnabled = typeof parsed?.isAiEnabled === 'boolean' ? parsed.isAiEnabled : false;
      const parsedQuestioningEnabled = typeof parsed?.isQuestioningEnabled === 'boolean' ? parsed.isQuestioningEnabled : true;
      const parsedRatings = (parsed?.ratings ?? {}) as Record<string, unknown>;
      const parsedAiSuggestions = (parsed?.aiSuggestions ?? {}) as Record<string, unknown>;
      const parsedStarters = Array.isArray(parsed?.goalStarters) ? parsed.goalStarters : [];
      const normalizedStarters = parsedStarters
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
      const normalized: Record<string, (LearningGoalRating | null)[]> = {};
      const normalizedAiSuggestions: Record<string, LearningGoalRating> = {};

      for (const [goalText, row] of Object.entries(parsedRatings)) {
        const rowArray = Array.isArray(row) ? row : [];
        normalized[goalText] = Array.from({ length: safeColumns }, (_, idx) => {
          const value = rowArray[idx];
          return value === 'red' || value === 'blue' || value === 'green' ? value : null;
        });
      }
      for (const [goalText, value] of Object.entries(parsedAiSuggestions)) {
        if (value === 'red' || value === 'blue' || value === 'green') {
          normalizedAiSuggestions[goalText] = value;
        }
      }

      setLearningGoalRatings(normalized);
      setLearningGoalAiSuggestions(normalizedAiSuggestions);
      setLearningGoalColumns(safeColumns);
      setIsLearningGoalAiEnabled(parsedAiEnabled);
      setIsLearningGoalsQuestioningEnabled(parsedQuestioningEnabled);
      setLearningGoalStarters(normalizedStarters.length > 0 ? normalizedStarters : DEFAULT_LEARNING_GOAL_STARTERS);
      setIsLearningGoalRatingsReady(true);
    } catch {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setIsLearningGoalRatingsReady(true);
    }
  }, [learningGoalRatingsStorageKey]);

  useEffect(() => {
    if (!learningGoalRatingsStorageKey || !isLearningGoalRatingsReady) return;
    localStorage.setItem(
      learningGoalRatingsStorageKey,
      JSON.stringify({
        columns: learningGoalColumns,
        isAiEnabled: isLearningGoalAiEnabled,
        isQuestioningEnabled: isLearningGoalsQuestioningEnabled,
        goalStarters: learningGoalStarters.map((value) => value.trim()).filter(Boolean),
        aiSuggestions: learningGoalAiSuggestions,
        ratings: learningGoalRatings,
      })
    );
  }, [learningGoalRatings, learningGoalAiSuggestions, learningGoalColumns, isLearningGoalAiEnabled, isLearningGoalsQuestioningEnabled, learningGoalStarters, learningGoalRatingsStorageKey, isLearningGoalRatingsReady]);

  // Combined context for the AI
  const activeStudyContext = useMemo(() => {
    const selectedFiles = studyItems.filter(i => i.type === 'file' && i.selected);
    if (selectedFiles.length === 0) return undefined;
    
    return selectedFiles
      .map((f) => {
        const goalsSection = (f.learningGoals?.length ?? 0) > 0
          ? `\n\nLEERDOELEN:\n${f.learningGoals!.map((goal, idx) => `${idx + 1}. ${goal}`).join('\n')}`
          : '';
        return `--- DOCUMENT: ${f.name} ---\n${f.content ?? ''}${goalsSection}`;
      })
      .join('\n\n');
  }, [studyItems]);

  const selectedCount = useMemo(
    () =>
      studyItems.filter(
        (item) =>
          item.type === 'file' &&
          item.selected &&
          !(item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
      ).length,
    [studyItems]
  );

  const detectedLearningGoals = useMemo<LearningGoal[]>(() => {
    const fromLearningGoalDocs = studyItems.filter((item) =>
      item.type === 'file' && (item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
    );

    const normalized = new Set<string>();
    const extracted: LearningGoal[] = [];
    const normalizedStarters = learningGoalStarters
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const addGoal = (raw: string) => {
      const clean = raw.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[\).\s-]+/, '').trim();
      if (clean.length < 4) return;
      if (/^(leerdoel(en)?|leerdoelen overzicht)$/i.test(clean)) return;
      if (/^item:/i.test(clean)) return;
      const key = clean.toLowerCase();
      if (normalized.has(key)) return;
      normalized.add(key);
      extracted.push({ id: `goal-${normalized.size}`, text: clean, createdAt: new Date() });
    };

    for (const doc of fromLearningGoalDocs) {
      if (doc.learningGoals?.length) {
        for (const goal of doc.learningGoals) addGoal(goal);
      }

      const content = doc.content ?? '';
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const lowered = trimmed.toLowerCase();
        const looksLikeGoal = normalizedStarters.some((starter) => {
          if (/^\d+[.\-)]?$/.test(starter)) return /^\d+[\).\s-]+/.test(trimmed);
          return lowered.startsWith(starter);
        });
        if (looksLikeGoal) addGoal(trimmed);
      }
    }

    return extracted;
  }, [learningGoalStarters, studyItems]);

  const hasSelectedLearningGoalsDocument = useMemo(() => {
    return studyItems.some(
      (item) =>
        item.type === 'file' &&
        item.selected &&
        (item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
    );
  }, [studyItems]);

  const learningGoalBuckets = useMemo(() => {
    const emptyGoals: LearningGoal[] = [];
    const redGoals: LearningGoal[] = [];
    const blueGoals: LearningGoal[] = [];
    const greenGoals: LearningGoal[] = [];

    const getLatestRating = (goalText: string): LearningGoalRating | null => {
      if (isLearningGoalAiEnabled) {
        const aiValue = learningGoalAiSuggestions[goalText];
        return aiValue === 'red' || aiValue === 'blue' || aiValue === 'green' ? aiValue : null;
      }
      const row = learningGoalRatings[goalText] ?? [];
      const value = row[Math.max(0, learningGoalColumns - 1)];
      return value === 'red' || value === 'blue' || value === 'green' ? value : null;
    };

    for (const goal of detectedLearningGoals) {
      const latestRating = getLatestRating(goal.text);
      if (latestRating === null) emptyGoals.push(goal);
      else if (latestRating === 'red') redGoals.push(goal);
      else if (latestRating === 'blue') blueGoals.push(goal);
      else greenGoals.push(goal);
    }

    return { emptyGoals, redGoals, blueGoals, greenGoals };
  }, [detectedLearningGoals, learningGoalColumns, learningGoalRatings, isLearningGoalAiEnabled, learningGoalAiSuggestions]);

  const setLearningGoalCellRating = useCallback((goalText: string, columnIndex: number, rating: LearningGoalRating | null) => {
    setLearningGoalRatings((prev) => {
      const currentRow = prev[goalText] ?? Array.from({ length: learningGoalColumns }, () => null);
      const nextRow = [...currentRow];

      while (nextRow.length < learningGoalColumns) nextRow.push(null);
      nextRow[columnIndex] = rating;

      return { ...prev, [goalText]: nextRow };
    });
  }, [learningGoalColumns]);

  const addLearningGoalColumn = useCallback(() => {
    setLearningGoalColumns((prevColumns) => {
      if (prevColumns >= MAX_LEARNING_GOAL_COLUMNS) return MAX_LEARNING_GOAL_COLUMNS;
      const nextColumns = prevColumns + 1;
      setLearningGoalRatings((prevRatings) => {
        const expanded: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, row] of Object.entries(prevRatings)) {
          const nextRow = [...row];
          while (nextRow.length < nextColumns) nextRow.push(null);
          expanded[goalText] = nextRow;
        }
        return expanded;
      });
      return nextColumns;
    });
  }, [MAX_LEARNING_GOAL_COLUMNS]);

  const removeLearningGoalColumn = useCallback(() => {
    setLearningGoalColumns((prevColumns) => {
      if (prevColumns <= 1) return 1;
      const nextColumns = prevColumns - 1;
      setLearningGoalRatings((prevRatings) => {
        const trimmed: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, row] of Object.entries(prevRatings)) {
          trimmed[goalText] = row.slice(0, nextColumns);
        }
        return trimmed;
      });
      return nextColumns;
    });
  }, []);

  const addLearningGoalStarter = useCallback(() => {
    setLearningGoalStarters((prev) => [...prev, '']);
  }, []);

  const setLearningGoalStarter = useCallback((index: number, value: string) => {
    setLearningGoalStarters((prev) => prev.map((starter, i) => (i === index ? value : starter)));
  }, []);

  const removeLearningGoalStarter = useCallback((index: number) => {
    setLearningGoalStarters((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const parseInlineLearningGoalRating = useCallback((raw: string): LearningGoalRating | null => {
    const match = raw.match(/\[\[AI_RATING:(red|blue|green)\]\]/i);
    if (!match) return null;
    const value = match[1].toLowerCase();
    return value === 'red' || value === 'blue' || value === 'green' ? value : null;
  }, []);

  const inferAiLearningGoalSuggestionFromTutorText = useCallback((botText: string): LearningGoalRating => {
    const normalized = botText.toLowerCase();
    if (/(gedeeltelijk|deels|onvolledig|mist belangrijke onderdelen|bijna juist)/.test(normalized)) return 'blue';
    if (/(niet juist|onjuist|incorrect|fout|niet correct|off-topic|onvoldoende)/.test(normalized)) return 'red';
    if (/(helemaal juist|dat is juist|dat is correct|goed gedaan|correct|juist)/.test(normalized)) return 'green';
    return 'red';
  }, []);

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
  ]);

  useEffect(() => {
    if (isLearningGoalsQuestioningEnabled) return;
    learningGoalCycleIndexRef.current = 0;
    learningGoalAllGreenIndexRef.current = 0;
    lastAskedLearningGoalRef.current = null;
    askedQuestionsByGoalRef.current = {};
    setActiveLearningGoalText(null);
  }, [isLearningGoalsQuestioningEnabled]);

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
    if (ttsEnabled) return;

    ttsQueue.current = [];
    isPlayingTts.current = false;
    setIsBotSpeaking(false);
    window.speechSynthesis.cancel();
    ttsPlaybackRef.current?.stop();
    ttsPlaybackRef.current = null;
  }, [engineMode, isClassicTtsEnabled, isNativeTtsEnabled]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setMessages([]);
  };

  const extractTextFromDocxWithZip = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error('Bestand is geen geldig DOCX-zipbestand.');
    }

    const jsZipLib = (window as any).JSZip;
    if (!jsZipLib || typeof jsZipLib.loadAsync !== 'function') {
      throw new Error('DOCX parser ontbreekt (JSZip niet geladen).');
    }

    const zip = await jsZipLib.loadAsync(arrayBuffer);
    const xmlCandidates = [
      'word/document.xml',
      'word/header1.xml',
      'word/header2.xml',
      'word/footer1.xml',
      'word/footer2.xml',
      'word/footnotes.xml',
      'word/endnotes.xml',
    ];

    const parser = new DOMParser();
    const chunks: string[] = [];

    for (const xmlPath of xmlCandidates) {
      const xmlFile = zip.file(xmlPath);
      if (!xmlFile) continue;
      const xmlString = await xmlFile.async('string');
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const textNodes = Array.from(xmlDoc.getElementsByTagName('w:t'));
      const text = textNodes.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      if (text) chunks.push(text);
    }

    if (chunks.length === 0) {
      throw new Error('Geen leesbare tekst gevonden in DOCX.');
    }

    return chunks.join('\n\n');
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'txt') return await file.text();
    if (extension === 'docx') {
      if (file.size === 0) {
        throw new Error('Bestand is leeg (0 bytes). Dit gebeurt vaak bij cloud-bestanden die nog niet lokaal gedownload zijn (bijv. OneDrive/Teams). Open het bestand eerst en sla lokaal op, upload daarna opnieuw.');
      }

      const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const isZipHeader = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b;
      const isLegacyDocHeader = header.length >= 4 && header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;
      if (!isZipHeader && isLegacyDocHeader) {
        throw new Error('Dit lijkt een oud .doc-bestand (geen .docx). Sla het document eerst op als .docx en upload opnieuw.');
      }

      let mammothError = '';
      try {
        const mammothLib = (window as any).mammoth;
        if (mammothLib && typeof mammothLib.extractRawText === 'function') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammothLib.extractRawText({ arrayBuffer });
          const text = (result?.value || '').trim();
          if (text) return text;
          mammothError = 'Mammoth gaf lege tekst terug.';
        } else {
          mammothError = 'Mammoth is niet geladen.';
        }
      } catch (error) {
        mammothError = error instanceof Error ? error.message : 'Onbekende Mammoth fout.';
      }

      try {
        return await extractTextFromDocxWithZip(file);
      } catch (zipError) {
        const zipMessage = zipError instanceof Error ? zipError.message : 'Onbekende ZIP fout.';
        throw new Error(`DOCX lezen mislukt. Mammoth: ${mammothError}. ZIP fallback: ${zipMessage}`);
      }
    } 
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }
    if (extension === 'pptx') {
      const arrayBuffer = await file.arrayBuffer();
      const jsZipLib = (window as any).JSZip;
      if (!jsZipLib || typeof jsZipLib.loadAsync !== 'function') {
        throw new Error('PPTX parser ontbreekt (JSZip niet geladen).');
      }
      const zip = await jsZipLib.loadAsync(arrayBuffer);
      let text = '';
      const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
      for (const name of slideFiles.sort()) {
        const content = await zip.file(name).async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        for (let j = 0; j < textNodes.length; j++) text += textNodes[j].textContent + ' ';
        text += '\n';
      }
      return text;
    }
    throw new Error('Bestandstype niet ondersteund');
  };

  const uploadFiles = async (
    files: File[],
    options?: { markAsLearningGoalsDocument?: boolean }
  ) => {
    if (files.length === 0) return;

    setIsExtracting(true);
    const uploadedItems: StudyItem[] = [];
    const failedFiles: string[] = [];
    const failedReasons: string[] = [];

    try {
      for (const file of files) {
        try {
          const extractedText = await extractTextFromFile(file);
          uploadedItems.push({
              id: Math.random().toString(36).substring(2, 11),
              name: file.name,
              type: 'file',
              parentId: currentFolderId,
              content: extractedText,
              fileType: file.name.split('.').pop() || 'txt',
              selected: true,
              iconColor: options?.markAsLearningGoalsDocument ? '#16a34a' : undefined,
              isLearningGoalsDocument: options?.markAsLearningGoalsDocument ? true : undefined,
              createdAt: new Date()
            });
        } catch (error) {
          failedFiles.push(file.name);
          const reason = error instanceof Error ? error.message : 'Onbekende fout';
          failedReasons.push(`${file.name}: ${reason}`);
          console.error(`[Upload] Fout bij verwerken van "${file.name}":`, error);
        }
      }

      if (uploadedItems.length > 0) {
        setStudyItems(prev => [...prev, ...uploadedItems]);
      }

      if (failedFiles.length > 0) {
        const firstReason = failedReasons[0] ? ` Reden: ${failedReasons[0]}` : '';
        alert(`Deze bestanden konden niet worden gelezen: ${failedFiles.join(', ')}. Ondersteund: .txt, .docx, .pdf, .pptx.${firstReason}`);
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
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files, { markAsLearningGoalsDocument: true });
    e.target.value = '';
  };

  const handleFileDrop = async (files: File[]) => {
    await uploadFiles(files);
  };

  const createFolder = (name: string) => {
    if (!name || !name.trim()) return;
    const newFolder: StudyItem = {
      id: Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      type: 'folder',
      parentId: currentFolderId,
      selected: false,
      createdAt: new Date()
    };
    setStudyItems(prev => [...prev, newFolder]);
  };

  const renameItem = (id: string, newName: string) => {
    const item = studyItems.find(i => i.id === id);
    if (!item || item.isLocked) return;
    if (!newName || !newName.trim()) return;
    setStudyItems(prev => prev.map(i => i.id === id ? { ...i, name: newName.trim() } : i));
  };

  const deleteItem = (id: string) => {
    const item = studyItems.find(i => i.id === id);
    if (item?.isLocked) {
      alert("Dit document is toegewezen door een docent en kan niet worden verwijderd.");
      return;
    }
    setStudyItems(prev => {
      const toDelete = new Set([id]);
      let size = 0;
      while (toDelete.size !== size) {
        size = toDelete.size;
        prev.forEach(item => {
          if (item.parentId && toDelete.has(item.parentId)) toDelete.add(item.id);
        });
      }
      return prev.filter(item => !toDelete.has(item.id));
    });
  };

  const moveItem = (targetFolderId: string | null) => {
    if (!movingItemId) return;
    if (movingItemId === targetFolderId) return;
    setStudyItems(prev => {
      const movingItem = prev.find(i => i.id === movingItemId);
      if (!movingItem) return prev;

      if (movingItem.type === 'folder' && targetFolderId) {
        // Prevent moving a folder into itself or one of its descendants.
        if (targetFolderId === movingItemId) return prev;
        const descendants = new Set<string>([movingItemId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const item of prev) {
            if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
              descendants.add(item.id);
              changed = true;
            }
          }
        }
        if (descendants.has(targetFolderId)) return prev;
      }

      return prev.map(i => i.id === movingItemId ? { ...i, parentId: targetFolderId } : i);
    });
    setMovingItemId(null);
  };

  const toggleFileSelection = (id: string) => {
    setStudyItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const getDescendantFileIds = (items: StudyItem[], folderId: string): Set<string> => {
    const folderIds = new Set<string>([folderId]);
    const fileIds = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;
      for (const item of items) {
        if (!item.parentId || !folderIds.has(item.parentId)) continue;
        if (item.type === 'folder' && !folderIds.has(item.id)) {
          folderIds.add(item.id);
          changed = true;
        }
        if (item.type === 'file') fileIds.add(item.id);
      }
    }

    return fileIds;
  };

  const hasSelectableFilesInFolder = (folderId: string): boolean => {
    return getDescendantFileIds(studyItems, folderId).size > 0;
  };

  const isFolderSelected = (folderId: string): boolean => {
    const fileIds = getDescendantFileIds(studyItems, folderId);
    if (fileIds.size === 0) return false;
    return studyItems.filter(i => fileIds.has(i.id)).every(i => i.selected);
  };

  const toggleFolderSelection = (folderId: string) => {
    setStudyItems(prev => {
      const fileIds = getDescendantFileIds(prev, folderId);
      if (fileIds.size === 0) return prev;
      const shouldSelect = !prev.filter(i => fileIds.has(i.id)).every(i => i.selected);
      return prev.map(i => fileIds.has(i.id) ? { ...i, selected: shouldSelect } : i);
    });
  };

  const setItemIconColor = (id: string, color: string) => {
    setStudyItems(prev => prev.map(item => item.id === id ? { ...item, iconColor: color } : item));
  };

  const toggleAllInCurrentView = (selected: boolean) => {
    const currentViewIds = new Set(studyItems.filter(i => i.parentId === currentFolderId && i.type === 'file').map(i => i.id));
    setStudyItems(prev => prev.map(i => currentViewIds.has(i.id) ? { ...i, selected } : i));
  };

  const processTtsQueue = async () => {
    const ttsEnabled = engineMode === ModeAccess.CLASSIC ? isClassicTtsEnabled : isNativeTtsEnabled;
    if (!ttsEnabled) {
      console.info('[TTS] Skipped because TTS is disabled', {
        engineMode,
      });
      ttsQueue.current = [];
      isPlayingTts.current = false;
      setIsBotSpeaking(false);
      return;
    }

    if (isPlayingTts.current || ttsQueue.current.length === 0) return;
    isPlayingTts.current = true;
    const text = ttsQueue.current.shift()!;
    setIsBotSpeaking(true);
    try {
      const providerId = getChatTtsProviderId(engineMode, classicTtsMode);
      const provider = getTtsProvider(providerId);
      console.info('[TTS] Using provider', {
        engineMode,
        provider: provider.id,
        textLength: text.length,
      });
      const session = await provider.speak({ text, language: provider.id === 'browser' ? 'nl-NL' : 'nl' });
      if (!session) {
        isPlayingTts.current = false;
        if (ttsQueue.current.length === 0) setIsBotSpeaking(false);
        processTtsQueue();
        return;
      }
      ttsPlaybackRef.current?.stop();
      ttsPlaybackRef.current = session;
      await session.finished;
    } catch (err) {
      console.error(err);
    } finally {
      if (ttsPlaybackRef.current) {
        ttsPlaybackRef.current = null;
      }
      isPlayingTts.current = false;
      if (ttsQueue.current.length === 0) setIsBotSpeaking(false);
      processTtsQueue();
    }
  };

  const playTtsChunk = (text: string) => {
    const ttsEnabled = engineMode === ModeAccess.CLASSIC ? isClassicTtsEnabled : isNativeTtsEnabled;
    if (!ttsEnabled || !text.trim()) return;
    ttsQueue.current.push(text.trim());
    processTtsQueue();
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputText;
    if (!text.trim()) return;
    const hasLearningGoals = isLearningGoalsQuestioningEnabled && detectedLearningGoals.length > 0;
    const allGoalsAreGreen =
      hasLearningGoals &&
      learningGoalBuckets.greenGoals.length === detectedLearningGoals.length;
    const effectiveBuckets = allGoalsAreGreen
      ? {
          emptyGoals: detectedLearningGoals,
          redGoals: [] as LearningGoal[],
          blueGoals: [] as LearningGoal[],
          greenGoals: [] as LearningGoal[],
        }
      : learningGoalBuckets;
    const prioritizedGoals = [
      ...effectiveBuckets.emptyGoals,
      ...effectiveBuckets.redGoals,
      ...effectiveBuckets.blueGoals,
      ...effectiveBuckets.greenGoals,
    ];
    let previousGoal = lastAskedLearningGoalRef.current;
    const previousGoalQuestions = previousGoal ? (askedQuestionsByGoalRef.current[previousGoal] ?? []) : [];
    const previousQuestion = previousGoalQuestions.length > 0
      ? previousGoalQuestions[previousGoalQuestions.length - 1]
      : '';
    let nextGoalText: string | null = null;
    let askedForGoal: string[] = [];

    let goalInstruction = '';
    if (hasLearningGoals) {
      if (allGoalsAreGreen) {
        setLearningGoalRatings({});
        setLearningGoalAiSuggestions({});
        learningGoalCycleIndexRef.current = 0;
        learningGoalAllGreenIndexRef.current = 0;
        lastAskedLearningGoalRef.current = null;
        askedQuestionsByGoalRef.current = {};
        previousGoal = null;
      }

      if (prioritizedGoals.length > 0) {
        const nextGoal = prioritizedGoals[learningGoalCycleIndexRef.current % prioritizedGoals.length];
        learningGoalCycleIndexRef.current += 1;
        setActiveLearningGoalText(nextGoal.text);
        nextGoalText = nextGoal.text;
        askedForGoal = askedQuestionsByGoalRef.current[nextGoal.text] ?? [];
        const isFirstRoundForGoal = askedForGoal.length === 0;
        goalInstruction = [
          '',
          '[LEERDOEL-MODUS]',
          ...(previousGoal
            ? [
                `LEERLING_ANTWOORD: """${text.trim()}"""`,
                `VORIGE_VRAAG: """${previousQuestion || '(onbekend)'}"""`,
                'Behandel LEERLING_ANTWOORD altijd als antwoord op je vorige vraag als er tekst aanwezig is.',
                'Beoordeel ALLEEN of LEERLING_ANTWOORD de VORIGE_VRAAG correct beantwoordt.',
                'Het leerdoel is context voor de opvolgvraag, niet het beoordelingscriterium voor dit antwoord.',
                'Als LEERLING_ANTWOORD niet leeg is, mag je NOOIT zeggen dat er geen antwoord is gegeven.',
                'Als het antwoord onvolledig is: zeg "gedeeltelijk juist" en corrigeer inhoudelijk.',
                'Beoordeel strikt op de exact gestelde vraag, niet op extra info die niet gevraagd is.',
                'Als de vraag om 1 feit/term vraagt en de leerling noemt die correct, dan is het antwoord volledig juist (ook als het kort is).',
                'Gebruik "gedeeltelijk juist" alleen als de vraag meerdere vereiste onderdelen had of als er inhoudelijk een essentieel deel mist.',
                'Noem een correct, kernachtig feitantwoord nooit "gedeeltelijk juist".',
                'Zet HELEMAAL bovenaan je antwoord exact een marker in dit formaat: [[AI_RATING:red]] of [[AI_RATING:blue]] of [[AI_RATING:green]].',
                'Gebruik AI_RATING:blue als het antwoord gedeeltelijk juist is.',
                'AI_RATING moet exact overeenkomen met je inhoudelijke beoordeling in tekst.',
              ]
            : [
                'Dit is de start van de quiz.',
                'Evalueer nu nog geen leerlingantwoord.',
                'Stel meteen de eerste vraag.',
              ]),
          previousGoal
            ? `Beoordeel eerst het antwoord op de vorige vraag "${previousQuestion || '(onbekend)'}".`
            : 'Stel eerst de eerste quizvraag.',
          'Volg daarna exact de quiz-flow uit de system prompt: juist/fout beoordeling, korte gestructureerde uitleg, daarna volgende vraag.',
          `Volgende vraag moet gericht zijn op leerdoel: "${nextGoal.text}"`,
          'Stel exact 1 nieuwe vraag.',
          'Noem of citeer het leerdoel nooit expliciet in je antwoord.',
          isFirstRoundForGoal
            ? 'In deze eerste ronde mag de vraag bijna letterlijk de formulering van het leerdoel volgen.'
            : 'Vanaf de tweede ronde moet de vraag inhoudelijk variëren t.o.v. eerdere vragen voor dit leerdoel.',
          'Herhaal nooit letterlijk een eerder gestelde vraag.',
          askedForGoal.length > 0 ? `VERBODEN exact te herhalen: ${askedForGoal.slice(-6).join(' | ')}` : 'Nog geen verboden vraagzinnen.',
          askedForGoal.length > 0 ? `Reeds gestelde vragen voor dit leerdoel: ${askedForGoal.slice(-6).join(' | ')}` : 'Voor dit leerdoel zijn nog geen eerdere vragen gesteld.',
        ].join('\n');
      } else {
        setActiveLearningGoalText(null);
      }
    } else {
      setActiveLearningGoalText(null);
    }

    const requestText = `${text.trim()}${goalInstruction}`;
    const userMessage: Message = { id: Date.now().toString(), role: MessageRole.USER, text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    if (!textOverride) setInputText('');
    setIsTyping(true); setStreamingBotText(''); ttsQueue.current = [];
    ttsPlaybackRef.current?.stop();
    ttsPlaybackRef.current = null;
    isPlayingTts.current = false;
    setIsBotSpeaking(false);
    const history = messages.slice(-10).map(m => ({ role: m.role, parts: m.text }));
    const providerId = getDefaultTextProviderId(engineMode);
    const selectedFiles = studyItems.filter((item) => item.type === 'file' && item.selected);
    let fileSearchStoreName: string | undefined;

    if (providerId === 'gemini' && currentUser && selectedFiles.length > 0) {
      try {
        fileSearchStoreName = await syncSelectedStudyItemsToGeminiFileSearch(currentUser.id, selectedFiles);
      } catch (error) {
        console.error('[Gemini File Search] Synchronisatie mislukt, fallback op inline context.', error);
      }
    }

    const shouldSendInlineStudyMaterial = !!activeStudyContext;
    console.info('[RAG][Text] Request routing', {
      engineMode,
      providerId,
      selectedFiles: selectedFiles.length,
      usesGeminiFileSearch: !!fileSearchStoreName,
      fileSearchStoreName,
      usesInlineStudyMaterial: shouldSendInlineStudyMaterial,
    });
    let fullResponse = '';
    let ttsBuffer = '';
    const expectsInlineRating = hasLearningGoals && !!previousGoal && isLearningGoalAiEnabled;
    let inlineRating: LearningGoalRating | null = null;
    let inlineRatingBuffer = '';
    let inlineRatingResolved = !expectsInlineRating;
    const firstTtsChunkMinChars = engineMode === ModeAccess.NATIVE ? 70 : 55;
    const nextTtsChunkMinChars = engineMode === ModeAccess.NATIVE ? 140 : 110;

    const flushTts = (force = false) => {
      const trimmed = ttsBuffer.trim();
      if (!trimmed) return;
      const hasSentenceBoundary = /[.!?]\s*$/.test(ttsBuffer);
      const isFirstChunk = !isPlayingTts.current && ttsQueue.current.length === 0;
      const minChunkChars = isFirstChunk ? firstTtsChunkMinChars : nextTtsChunkMinChars;
      if (force || (trimmed.length >= minChunkChars && hasSentenceBoundary)) {
        playTtsChunk(trimmed);
        ttsBuffer = '';
      }
    };

    const appendVisibleText = (textChunk: string) => {
      if (!textChunk) return;
      fullResponse += textChunk;
      setStreamingBotText(fullResponse);
      ttsBuffer += textChunk;
      flushTts(false);
    };

    try {
      const stream = streamChatWithProvider(providerId, {
        message: requestText,
        chatHistory: history,
        studyMaterial: shouldSendInlineStudyMaterial ? activeStudyContext : undefined,
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
          inlineRating = markerMatch[1].toLowerCase() as LearningGoalRating;
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
      const botMessage: Message = { id: (Date.now() + 1).toString(), role: MessageRole.BOT, text: fullResponse, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]); setStreamingBotText(''); setIsTyping(false);
      if (hasLearningGoals && previousGoal && isLearningGoalAiEnabled) {
        const aiSuggestion =
          inlineRating ??
          parseInlineLearningGoalRating(fullResponse) ??
          inferAiLearningGoalSuggestionFromTutorText(fullResponse);
        setLearningGoalAiSuggestions((prev) => ({ ...prev, [previousGoal]: aiSuggestion }));
      }
      if (hasLearningGoals && nextGoalText) {
        lastAskedLearningGoalRef.current = nextGoalText;
        const questionMatches = fullResponse.match(/[^?]*\?/g) ?? [];
        const lastQuestion = questionMatches.length > 0 ? questionMatches[questionMatches.length - 1].trim() : '';
        if (lastQuestion) {
          const prev = askedQuestionsByGoalRef.current[nextGoalText] ?? [];
          askedQuestionsByGoalRef.current[nextGoalText] = [...prev, lastQuestion];
        }
      }
    } catch (err) { setIsTyping(false); }
  };

  const handleTranscriptionUpdate = useCallback((text: string, role: 'user' | 'bot') => {
    if (role === 'user') setStreamingUserText(text); else setStreamingBotText(text);
  }, []);

  const handleTurnComplete = useCallback((userText: string, botText: string) => {
    const timestamp = new Date();
    const newEntries: Message[] = [];
    if (userText.trim()) newEntries.push({ id: `v-u-${timestamp.getTime()}`, role: MessageRole.USER, text: userText.trim(), timestamp });
    if (botText.trim()) newEntries.push({ id: `v-b-${timestamp.getTime() + 1}`, role: MessageRole.BOT, text: botText.trim(), timestamp });
    if (newEntries.length > 0) setMessages(prev => [...prev, ...newEntries]);
    setStreamingUserText(''); setStreamingBotText('');
  }, []);

  const currentItems = studyItems.filter(item => item.parentId === currentFolderId);
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = studyItems.find(i => i.id === currentId);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parentId;
      } else break;
    }
    return crumbs;
  }, [currentFolderId, studyItems]);

  if (!currentUser) return <AuthScreen onLoginSuccess={(user) => setCurrentUser(user)} />;

  return (
    <div className="h-screen overflow-hidden flex flex-col transition-colors duration-300">
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      
      <header className="fixed top-0 inset-x-0 z-40">
        <div className="w-full px-4 md:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <StudyBuddyLogo className="w-14 h-14" />
            <div>
              <h1 className="text-3xl font-black text-studybuddy-dark dark:text-white tracking-tight">StudyBuddy</h1>
              <p className="text-studybuddy-blue font-bold text-xs uppercase tracking-widest">Hi, {currentUser.firstName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button onClick={() => setShowUpload(true)} className={`px-5 py-3 rounded-2xl shadow-sm transition-all flex items-center space-x-2 font-bold ${selectedCount > 0 ? 'bg-studybuddy-yellow text-studybuddy-dark' : 'bg-white dark:bg-slate-800 text-studybuddy-magenta border-2 border-slate-100 dark:border-slate-700'}`}>
              <i className="fa-solid fa-folder-tree"></i>
              <span className="hidden sm:inline">{selectedCount > 0 ? `${selectedCount} Gekozen` : 'Bibliotheek'}</span>
            </button>
            
            {!isVoiceActive && (
              <button onClick={() => setIsVoiceActive(true)} className="px-6 py-3 bg-studybuddy-blue hover:bg-blue-600 text-white rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center space-x-2 font-black">
                <i className="fa-solid fa-microphone-lines"></i>
                <span className="hidden sm:inline">Start Voice</span>
              </button>
            )}
            {currentUser.role === Role.ADMIN && (
              <button onClick={() => setShowAdmin(true)} className="w-12 h-12 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-lg" title="Admin">
                <i className="fa-solid fa-user-shield text-xl"></i>
              </button>
            )}

            <button onClick={() => setShowSettings(true)} className="w-12 h-12 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 rounded-2xl flex items-center justify-center hover:text-studybuddy-blue transition-all">
              <i className="fa-solid fa-gear text-xl"></i>
            </button>
          </div>
        </div>
      </header>

	      {showSettings && (
	        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
	          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-700 p-6 md:p-8">
	            <div className="flex justify-between items-center mb-6">
	              <h2 className="text-2xl font-black text-studybuddy-dark dark:text-white">Instellingen</h2>
	              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-2xl"></i></button>
	            </div>
	            <div className="grid grid-cols-3 gap-2 mb-4">
	              <button
	                onClick={() => setSettingsTab('algemeen')}
	                className={`py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
	                  settingsTab === 'algemeen'
	                    ? 'bg-studybuddy-blue text-white'
	                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
	                }`}
	              >
	                Algemeen
	              </button>
	              <button
	                onClick={() => setSettingsTab('audio')}
	                className={`py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
	                  settingsTab === 'audio'
	                    ? 'bg-studybuddy-blue text-white'
	                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
	                }`}
	              >
	                Audio
	              </button>
	              <button
	                onClick={() => setSettingsTab('leerdoelen')}
	                className={`py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
	                  settingsTab === 'leerdoelen'
	                    ? 'bg-studybuddy-blue text-white'
	                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
	                }`}
	              >
	                Leerdoelen
	              </button>
	            </div>
	            <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
	              {settingsTab === 'algemeen' && (
	                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                  <div className="flex items-center space-x-3">
	                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-studybuddy-yellow' : 'bg-studybuddy-blue text-white'}`}><i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'} text-xl`}></i></div>
	                    <span className="font-bold text-studybuddy-dark dark:text-white">Donkere Modus</span>
	                  </div>
	                  <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-14 h-8 rounded-full relative transition-colors ${isDarkMode ? 'bg-studybuddy-blue' : 'bg-slate-200'}`}><div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
	                </div>
	              )}
	              {settingsTab === 'audio' && engineMode === ModeAccess.CLASSIC && (
	                <>
	                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                    <div className="flex items-center justify-between">
	                      <span className="font-bold text-studybuddy-dark dark:text-white">Classic STT</span>
	                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Input</span>
	                    </div>
	                    <div className="mt-3 grid grid-cols-2 gap-2">
	                      <button
	                        onClick={() => setClassicSttMode('local')}
	                        className={`py-2 rounded-xl font-bold transition-all ${
	                          classicSttMode === 'local'
	                            ? 'bg-studybuddy-blue text-white'
	                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
	                        }`}
	                      >
	                        Local
	                      </button>
	                      <button
	                        onClick={() => setClassicSttMode('browser')}
	                        className={`py-2 rounded-xl font-bold transition-all ${
	                          classicSttMode === 'browser'
	                            ? 'bg-studybuddy-blue text-white'
	                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
	                        }`}
	                      >
	                        Browser
	                      </button>
	                    </div>
	                  </div>
	                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                    <div className="flex items-center justify-between">
	                      <span className="font-bold text-studybuddy-dark dark:text-white">Classic TTS</span>
	                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Output</span>
	                    </div>
	                    <div className="mt-3 flex items-center justify-between">
	                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
	                        {isClassicTtsEnabled ? 'TTS aan' : 'TTS uit'}
	                      </span>
	                      <button
	                        onClick={() => setIsClassicTtsEnabled((prev) => !prev)}
	                        aria-pressed={isClassicTtsEnabled}
	                        className={`w-14 h-8 rounded-full relative transition-colors ${isClassicTtsEnabled ? 'bg-studybuddy-blue' : 'bg-slate-200 dark:bg-slate-700'}`}
	                      >
	                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isClassicTtsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
	                      </button>
	                    </div>
	                  </div>
	                  {isClassicTtsEnabled && (
	                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                      <div className="flex items-center justify-between">
	                        <span className="font-bold text-studybuddy-dark dark:text-white">Classic TTS Engine</span>
	                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voice</span>
	                      </div>
	                      <div className="mt-3 grid grid-cols-2 gap-2">
	                        <button
	                          onClick={() => setClassicTtsMode('local')}
	                          className={`py-2 rounded-xl font-bold transition-all ${
	                            classicTtsMode === 'local'
	                              ? 'bg-studybuddy-blue text-white'
	                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
	                          }`}
	                        >
	                          Local
	                        </button>
	                        <button
	                          onClick={() => setClassicTtsMode('browser')}
	                          className={`py-2 rounded-xl font-bold transition-all ${
	                            classicTtsMode === 'browser'
	                              ? 'bg-studybuddy-blue text-white'
	                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
	                          }`}
	                        >
	                          Browser
	                        </button>
	                      </div>
	                    </div>
	                  )}
	                </>
	              )}
	              {settingsTab === 'audio' && engineMode === ModeAccess.NATIVE && (
	                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                  <div className="flex items-center justify-between">
	                    <span className="font-bold text-studybuddy-dark dark:text-white">Native TTS</span>
	                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Output</span>
	                  </div>
	                  <div className="mt-3 flex items-center justify-between">
	                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
	                      {isNativeTtsEnabled ? 'TTS aan' : 'TTS uit'}
	                    </span>
	                    <button
	                      onClick={() => setIsNativeTtsEnabled((prev) => !prev)}
	                      aria-pressed={isNativeTtsEnabled}
	                      className={`w-14 h-8 rounded-full relative transition-colors ${isNativeTtsEnabled ? 'bg-studybuddy-blue' : 'bg-slate-200 dark:bg-slate-700'}`}
	                    >
	                      <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isNativeTtsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
	                    </button>
	                  </div>
	                </div>
	              )}
	              {settingsTab === 'leerdoelen' && (
	                <>
	                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                    <div className="flex items-center justify-between">
	                      <span className="font-bold text-studybuddy-dark dark:text-white">Leerdoel-ondervraging</span>
	                      <button
	                        onClick={() => setIsLearningGoalsQuestioningEnabled((prev) => !prev)}
	                        aria-pressed={isLearningGoalsQuestioningEnabled}
	                        className={`w-14 h-8 rounded-full relative transition-colors ${isLearningGoalsQuestioningEnabled ? 'bg-studybuddy-blue' : 'bg-slate-200 dark:bg-slate-700'}`}
	                      >
	                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isLearningGoalsQuestioningEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
	                      </button>
	                    </div>
	                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
	                      {isLearningGoalsQuestioningEnabled ? 'Leerdoelen worden gebruikt in de ondervraging.' : 'Leerdoelen worden niet gebruikt in de ondervraging.'}
	                    </p>
	                  </div>
	                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                    <div className="flex items-center justify-between">
	                      <span className="font-bold text-studybuddy-dark dark:text-white">AI-beoordeling</span>
	                      <button
	                        onClick={() => setIsLearningGoalAiEnabled((prev) => !prev)}
	                        aria-pressed={isLearningGoalAiEnabled}
	                        className={`w-14 h-8 rounded-full relative transition-colors ${isLearningGoalAiEnabled ? 'bg-studybuddy-blue' : 'bg-slate-200 dark:bg-slate-700'}`}
	                      >
	                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isLearningGoalAiEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
	                      </button>
	                    </div>
	                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
	                      {isLearningGoalAiEnabled ? 'AI-beoordeling staat aan.' : 'AI-beoordeling staat uit.'}
	                    </p>
	                  </div>
	                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
	                    <div className="flex items-center justify-between mb-3">
	                      <span className="font-bold text-studybuddy-dark dark:text-white">Leerdoel-voorzetsels</span>
	                      <button
	                        onClick={addLearningGoalStarter}
	                        className="w-8 h-8 rounded-lg bg-studybuddy-blue text-white hover:bg-blue-600 transition-colors"
	                        title="Voorzetsel toevoegen"
	                      >
	                        <i className="fa-solid fa-plus"></i>
	                      </button>
	                    </div>
	                    <div className="space-y-2">
	                      {learningGoalStarters.map((starter, index) => (
	                        <div key={`starter-${index}`} className="flex items-center gap-2">
	                          <input
	                            type="text"
	                            value={starter}
	                            onChange={(e) => setLearningGoalStarter(index, e.target.value)}
	                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-studybuddy-blue/20"
	                            placeholder="Bijv. Ik of -"
	                          />
	                          <button
	                            onClick={() => removeLearningGoalStarter(index)}
	                            disabled={learningGoalStarters.length <= 1}
	                            className={`w-9 h-9 rounded-xl transition-colors ${
	                              learningGoalStarters.length <= 1
	                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
	                                : 'bg-red-50 text-red-500 hover:bg-red-100'
	                            }`}
	                            title="Verwijderen"
	                          >
	                            <i className="fa-solid fa-trash"></i>
	                          </button>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                </>
	              )}
	              <button onClick={handleLogout} className="w-full py-4 bg-slate-100 dark:bg-slate-900 hover:bg-red-50 text-slate-600 rounded-2xl font-black transition-all flex items-center justify-center space-x-2"><i className="fa-solid fa-right-from-bracket"></i><span>Uitloggen</span></button>
	              <button onClick={() => setShowSettings(false)} className="w-full mt-4 py-4 bg-studybuddy-magenta text-white rounded-2xl font-black shadow-lg">Sluiten</button>
	            </div>
	          </div>
        </div>
      )}

      <UploadLibraryModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
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
        selectedCount={selectedCount}
      />

      <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-4 md:px-8 pt-24 pb-4 flex flex-col">
      <main className="flex-1 min-h-0 flex flex-col">
        {engineMode === ModeAccess.NATIVE ? (
          <VoiceInterface
            isActive={isVoiceActive}
            onClose={() => setIsVoiceActive(false)}
            onTranscriptionUpdate={handleTranscriptionUpdate}
            onTurnComplete={handleTurnComplete}
            onBotSpeakingChange={setIsBotSpeaking}
            studyMaterial={activeStudyContext}
            ttsEnabled={isNativeTtsEnabled}
            ragUserId={currentUser.id}
            ragSelectedStudyItems={studyItems.filter((item) => item.type === 'file' && item.selected)}
          />
        ) : (
          <ClassicVoiceInterface isActive={isVoiceActive} onClose={() => setIsVoiceActive(false)} onTranscriptionUpdate={handleTranscriptionUpdate} onTurnComplete={handleTurnComplete} onBotSpeakingChange={setIsBotSpeaking} studyMaterial={activeStudyContext} sttMode={classicSttMode} ttsMode={classicTtsMode} ttsEnabled={isClassicTtsEnabled} />
        )}
        <div className="flex flex-col flex-1 min-h-0">
          <ChatWindow messages={messages} isTyping={isTyping} streamingUserText={streamingUserText} streamingBotText={streamingBotText} />
        </div>
      </main>

      <div className="shrink-0 mt-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-xl border-2 border-slate-50 dark:border-slate-700 flex items-center gap-3">
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={selectedCount > 0 ? `Vraag iets over je ${selectedCount} document(en)...` : "Stel een vraag of kies je lesstof!"} className="flex-1 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-4 focus:ring-studybuddy-blue/5 outline-none text-lg dark:text-white transition-all placeholder:text-slate-400" />
          <button onClick={() => handleSend()} disabled={!inputText.trim() || isTyping || isVoiceActive} className="w-16 h-16 bg-studybuddy-blue hover:bg-blue-600 disabled:bg-slate-100 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90"><i className="fa-solid fa-paper-plane text-2xl"></i></button>
        </div>
      </div>

      <footer className="relative shrink-0 mt-4 py-4 flex flex-col sm:flex-row justify-between items-center text-slate-300 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] gap-4">

        <span>Eureka Expert</span>

        <div className="absolute left-1/2 -translate-x-1/2 flex space-x-4">
          <div className="w-3 h-3 bg-studybuddy-blue rounded-full"></div>
          <div className="w-3 h-3 bg-studybuddy-magenta rounded-full"></div>
          <div className="w-3 h-3 bg-studybuddy-yellow rounded-full"></div>
        </div>

        <span>Â© 2026 Eureka StudyBuddy</span>

      </footer>
      </div>
    {hasSelectedLearningGoalsDocument && (
      <div className="hidden xl:block fixed right-8 top-24 z-30 w-[460px] 2xl:w-[520px]">
        <LearningGoalsPanel
          goals={detectedLearningGoals}
          ratings={learningGoalRatings}
          aiSuggestions={learningGoalAiSuggestions}
          columns={learningGoalColumns}
          isAiEnabled={isLearningGoalAiEnabled}
          activeGoalText={activeLearningGoalText}
          onSetCellRating={setLearningGoalCellRating}
          onAddColumn={addLearningGoalColumn}
          onRemoveColumn={removeLearningGoalColumn}
          onResetAiEvaluation={() => setLearningGoalAiSuggestions({})}
        />
      </div>
    )}
    </div>
  );
};

export default App;
