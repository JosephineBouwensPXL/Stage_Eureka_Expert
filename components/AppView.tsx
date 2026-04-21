import React from 'react';
import { EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { Role, ModeAccess, ClassicSttMode, ClassicTtsMode, Message, StudyItem } from '../types';
import AppHeader from './layout/AppHeader';
import SettingsModal, { SettingsTab, type WalkthroughStream } from './settings/SettingsModal';
import UploadLibraryModal from './UploadLibrary';
import VoiceInterface from './VoiceInterface';
import ClassicVoiceInterface from './ClassicVoiceInterface';
import ChatWindow from './ChatWindow';
import LearningGoalsPanel, { LearningGoal, LearningGoalRating } from './LearningGoalsPanel';
import AdminPanel from './AdminPanel';

type AppViewProps = {
  currentUser: { id: string; firstName: string; role: Role };
  showWelcomeTourPrompt: boolean;
  isWalkthroughNarrationEnabled: boolean;
  onWalkthroughNarrationChange: (enabled: boolean) => void;
  onStartWelcomeTour: () => void;
  onDismissWelcomeTourPrompt: () => void;
  showAdmin: boolean;
  onCloseAdmin: () => void;
  selectedCount: number;
  isVoiceActive: boolean;
  onOpenUpload: () => void;
  onStartVoice: () => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
  showSettings: boolean;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  engineMode: 'native' | 'classic';
  classicSttMode: ClassicSttMode;
  onClassicSttModeChange: (mode: ClassicSttMode) => void;
  isClassicTtsEnabled: boolean;
  onToggleClassicTts: () => void;
  classicTtsMode: ClassicTtsMode;
  onClassicTtsModeChange: (mode: ClassicTtsMode) => void;
  isNativeTtsEnabled: boolean;
  onToggleNativeTts: () => void;
  isLearningGoalsQuestioningEnabled: boolean;
  onToggleLearningGoalsQuestioning: () => void;
  isLearningGoalAiEnabled: boolean;
  onToggleLearningGoalAi: () => void;
  learningGoalStarters: string[];
  onAddLearningGoalStarter: () => void;
  onSetLearningGoalStarter: (index: number, value: string) => void;
  onRemoveLearningGoalStarter: (index: number) => void;
  isLearningGoalTableExtractionEnabled: boolean;
  onToggleLearningGoalTableExtraction: () => void;
  learningGoalTableColumnIndex: number;
  onSetLearningGoalTableColumnIndex: (value: number) => void;
  onRestartWalkthrough: (stream: WalkthroughStream) => void;
  onLogout: () => void;
  onCloseSettings: () => void;
  showUpload: boolean;
  onCloseUpload: () => void;
  currentFolderId: string | null;
  onOpenFolder: (folderId: string | null) => void;
  breadcrumbs: StudyItem[];
  movingItemId: string | null;
  onSetMovingItemId: (id: string | null) => void;
  onMoveItem: (targetFolderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => Promise<void>;
  onLearningGoalsFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onFileDrop: (files: File[]) => Promise<void>;
  isExtracting: boolean;
  currentItems: StudyItem[];
  onRenameItem: (id: string, newName: string) => void;
  onDeleteItem: (id: string) => void;
  onToggleFileSelection: (id: string) => void;
  onToggleFolderSelection: (folderId: string) => void;
  isFolderSelected: (folderId: string) => boolean;
  hasSelectableFilesInFolder: (folderId: string) => boolean;
  onSetItemIconColor: (id: string, color: string) => void;
  uploadWalkthroughResetToken: number;
  uploadWalkthroughMode: 'full' | 'learning-goals-only';
  onUploadWalkthroughCompleted: (status: 'finished' | 'skipped') => void;
  appWalkthroughStream: WalkthroughStream;
  appWalkthroughResetToken: number;
  activeStudyContext?: string;
  ragSelectedStudyItems: StudyItem[];
  onCloseVoice: () => void;
  onTranscriptionUpdate: (text: string, role: 'user' | 'bot') => void;
  onTurnComplete: (userText: string, botText: string) => void;
  onBotSpeakingChange: (value: boolean) => void;
  messages: Message[];
  isTyping: boolean;
  streamingUserText: string;
  streamingBotText: string;
  inputText: string;
  onInputTextChange: (value: string) => void;
  isInputRecording: boolean;
  onToggleInputRecording: () => void;
  onSend: () => void;
  hasSelectedLearningGoalsDocument: boolean;
  detectedLearningGoals: LearningGoal[];
  disabledLearningGoalTexts: string[];
  learningGoalRatings: Record<string, (LearningGoalRating | null)[]>;
  learningGoalAiSuggestions: Record<string, LearningGoalRating>;
  learningGoalColumns: number;
  activeLearningGoalText: string | null;
  onSetLearningGoalCellRating: (
    goalText: string,
    columnIndex: number,
    rating: LearningGoalRating | null
  ) => void;
  onAddLearningGoalColumn: () => void;
  onRemoveLearningGoalColumn: () => void;
  onAddLearningGoal: (goalText: string) => void;
  onToggleLearningGoalDisabled: (goalText: string) => void;
  onRemoveLearningGoal: (goalText: string) => void;
  onResetLearningGoalAiEvaluation: () => void;
};

export const AppView: React.FC<AppViewProps> = (props) => {
  const [runAppWalkthrough, setRunAppWalkthrough] = React.useState(false);
  const lastNarratedStepKeyRef = React.useRef<string | null>(null);
  const hasNarratedWelcomePromptRef = React.useRef(false);
  const hasLearningGoalsSidebar =
    props.hasSelectedLearningGoalsDocument || props.isLearningGoalsQuestioningEnabled;

  const appWalkthroughSteps = React.useMemo<Step[]>(
    () => {
      if (props.appWalkthroughStream === 'volledig-na-bibliotheek') {
        return [
          {
            target: '.walkthrough-start-voice',
            title: 'Voice starten',
            content:
              'Klik op "Start Voice" voor een volledige steminteractie: praten, luisteren en direct feedback.',
            disableBeacon: true,
          },
          {
            target: '.walkthrough-chat-input',
            title: 'Chatten',
            content: 'Typ hier je vraag. Je kunt chat gebruiken met of zonder voice.',
          },
          {
            target: '.walkthrough-send-chat',
            title: 'Versturen',
            content: 'Verzend je vraag met deze knop of met Enter.',
          },
          ...(hasLearningGoalsSidebar
            ? [
                {
                  target: '.walkthrough-learning-goals-panel',
                  title: 'Leerdoelenpaneel',
                  content:
                    'Hier zie je herkende leerdoelen en je voortgang per doel. Dit helpt gericht oefenen.',
                } satisfies Step,
              ]
            : []),
          {
            target: '.walkthrough-open-settings',
            title: 'Instellingen',
            content:
              'Hier pas je microfoon, geluid, leerdoelen en rondleidingen per onderdeel aan.',
          },
        ];
      }

      if (props.appWalkthroughStream === 'chat') {
        return [
          {
            target: '.walkthrough-chat-input',
            title: 'Chat invoer',
            content: 'Typ hier je vraag over je lesstof.',
            disableBeacon: true,
          },
          {
            target: '.walkthrough-send-chat',
            title: 'Bericht versturen',
            content: 'Klik op verzenden of druk op Enter.',
          },
        ];
      }

      if (props.appWalkthroughStream === 'voice') {
        return [
          {
            target: '.walkthrough-start-voice',
            title: 'Voice starten',
            content:
              'Klik hier om een volledige voice-interactie te starten: jij spreekt, StudyBuddy antwoordt.',
            disableBeacon: true,
          },
          {
            target: '.walkthrough-open-settings',
            title: 'Voice instellingen',
            content:
              'Via Instellingen > Audio kun je microfoon en geluid aanpassen aan je voorkeur.',
          },
        ];
      }

      if (props.appWalkthroughStream === 'leerdoelen') {
        return [
          {
            target: '.walkthrough-learning-goals-panel',
            title: 'Leerdoelenpaneel',
            content: 'Hier zie je alle leerdoelen als je klikt op de vierkantjes kun je ze rood, blauw of groen beoordelen beoordelen.',
            disableBeacon: true,
          },
          {
            target: '.walkthrough-learning-goals-add',
            title: 'Leerdoel Toevoegen',
            content: 'Voeg hier handmatig een leerdoel toe als het nog niet automatisch gevonden is.',
          },
          {
            target: '.walkthrough-learning-goals-toggle',
            title: 'Activeren Of Uitschakelen',
            content: 'Via dit nummer kun je een leerdoel tijdelijk uitschakelen of opnieuw activeren.',
          },
          {
            target: '.walkthrough-learning-goals-table',
            title: 'Voortgang',
            content:
              'Hier zie je je beoordeling per leerdoel. Bij uitgeschakelde doelen verschijnt rechts een vuilbakje om te verwijderen.',
          },
          {
            target: '.walkthrough-open-settings',
            title: 'Instellingen',
            content:
              'Open nu instellingen. Daar kun je leerdoel-ondervraging, AI-beoordeling en extractie verder instellen.',
          },
          {
            target: '.walkthrough-settings-leerdoelen-paneel',
            title: 'Leerdoelen Instellingen',
            content:
              'In dit paneel beheer je alle leerdoelopties, zoals AI-beoordeling, tabel-extractie en startwoorden.',
          },
        ];
      }

      return [
        {
          target: '.walkthrough-open-library',
          title: 'Bibliotheek',
          content:
            'Dit is de knop voor je bibliotheek. Klik straks hier om lesmateriaal of leerdoelen te kiezen.',
          disableBeacon: true,
        },
      ];
    },
    [hasLearningGoalsSidebar, props.appWalkthroughStream]
  );

  const toNarrationText = (value: React.ReactNode): string => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  };

  const speakWalkthroughStep = (title?: React.ReactNode, content?: React.ReactNode) => {
    if (!props.isWalkthroughNarrationEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const titleText = toNarrationText(title).trim();
    const contentText = toNarrationText(content).trim();
    const fullText = [titleText, contentText].filter(Boolean).join('. ');
    if (!fullText) return;
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'nl-NL';
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleAppWalkthroughEvent = ({ status, type, index, step }: EventData) => {
    if (
      type === EVENTS.STEP_AFTER &&
      props.appWalkthroughStream === 'volledig' &&
      index === 0
    ) {
      setRunAppWalkthrough(false);
      props.onOpenUpload();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (type === EVENTS.TOOLTIP) {
      const stepTarget = String(step.target ?? '');
      if (
        props.appWalkthroughStream === 'leerdoelen' &&
        (stepTarget === '.walkthrough-open-settings' ||
          stepTarget === '.walkthrough-settings-leerdoelen-paneel')
      ) {
        props.onOpenSettings();
        props.onSettingsTabChange('leerdoelen');
      }
      const stepKey = `${index}-${toNarrationText(step.title)}`;
      if (lastNarratedStepKeyRef.current !== stepKey) {
        lastNarratedStepKeyRef.current = stepKey;
        speakWalkthroughStep(step.title, step.content);
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunAppWalkthrough(false);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  React.useEffect(() => {
    if (props.appWalkthroughResetToken < 1) return;
    setRunAppWalkthrough(false);
    const timer = window.setTimeout(() => {
      setRunAppWalkthrough(true);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [props.appWalkthroughResetToken]);

  React.useEffect(() => {
    if (runAppWalkthrough) return;
    if (props.showWelcomeTourPrompt) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [props.showWelcomeTourPrompt, runAppWalkthrough]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (!props.showWelcomeTourPrompt) {
      hasNarratedWelcomePromptRef.current = false;
      window.speechSynthesis.cancel();
      return;
    }

    if (hasNarratedWelcomePromptRef.current) return;

    return;
  }, [props.showWelcomeTourPrompt]);

  React.useEffect(() => {
    if (props.isWalkthroughNarrationEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [props.isWalkthroughNarrationEnabled]);

  const speakWelcomePrompt = React.useCallback((onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    hasNarratedWelcomePromptRef.current = true;
    const utterance = new SpeechSynthesisUtterance(
      `Welkom bij StudyBuddy, ${props.currentUser.firstName}. We starten zo meteen met een volledige rondleiding. Volg de zwarte knoppen om de rondleiding te doorlopen. Je kunt deze rondleiding later herbekijken via de instellingen.`
    );
    utterance.lang = 'nl-NL';
    utterance.rate = 1;
    utterance.onend = () => onEnd?.();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [props.currentUser.firstName]);

  const handleWelcomeNarrationToggle = React.useCallback(
    (enabled: boolean) => {
      props.onWalkthroughNarrationChange(enabled);

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      if (!enabled) {
        window.speechSynthesis.cancel();
        return;
      }

      speakWelcomePrompt();
    },
    [props.onWalkthroughNarrationChange, speakWelcomePrompt]
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col transition-colors duration-300">
      <Joyride
        run={runAppWalkthrough}
        steps={appWalkthroughSteps}
        continuous
        showProgress
        showSkipButton
        disableScrolling
        onEvent={handleAppWalkthroughEvent}
        locale={{
          back: 'Vorige',
          close: 'Sluiten',
          last: 'Klaar',
          next: 'Volgende',
          skip: 'Overslaan',
        }}
        styles={{
          options: {
            primaryColor: '#0ea5e9',
            zIndex: 110,
          },
        }}
      />
      {props.showAdmin && <AdminPanel onClose={props.onCloseAdmin} />}
      {props.showWelcomeTourPrompt && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white px-8 py-10 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-studybuddy-blue/10 text-studybuddy-blue">
              <i className="fa-solid fa-hand-sparkles text-2xl"></i>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-studybuddy-blue">
              Welkom
            </p>
            <h2 className="mt-3 text-3xl font-black text-studybuddy-dark dark:text-white">
              Klaar voor je rondleiding?
            </h2>
            <p className="mt-4 text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">
              Welkom bij StudyBuddy, {props.currentUser.firstName}. Klik hieronder en we tonen je
              stap voor stap hoe de volledige app werkt. Gebruik tijdens de rondleiding telkens de
              {' '}<span className="font-black text-slate-700 dark:text-slate-100">zwarte knop</span>{' '}
              om verder te gaan.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={props.isWalkthroughNarrationEnabled}
                onClick={() =>
                  handleWelcomeNarrationToggle(!props.isWalkthroughNarrationEnabled)
                }
                className={`flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                  props.isWalkthroughNarrationEnabled
                    ? 'border-studybuddy-blue bg-studybuddy-blue/10 text-studybuddy-blue'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-current/10">
                  <i className="fa-solid fa-volume-high text-base"></i>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-black">Voorlezen</span>
                </span>
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    props.isWalkthroughNarrationEnabled
                      ? 'bg-studybuddy-blue'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      props.isWalkthroughNarrationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </span>
              </button>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={props.onStartWelcomeTour}
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-black text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Start rondleiding
                </button>
                <button
                  onClick={props.onDismissWelcomeTourPrompt}
                  className="rounded-2xl border border-slate-200 px-6 py-4 text-base font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Misschien later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        firstName={props.currentUser.firstName}
        selectedCount={props.selectedCount}
        isVoiceActive={props.isVoiceActive}
        isAdmin={props.currentUser.role === Role.ADMIN}
        onOpenUpload={props.onOpenUpload}
        onStartVoice={props.onStartVoice}
        onOpenAdmin={props.onOpenAdmin}
        onOpenSettings={props.onOpenSettings}
      />

      <SettingsModal
        isOpen={props.showSettings}
        settingsTab={props.settingsTab}
        onSettingsTabChange={props.onSettingsTabChange}
        isDarkMode={props.isDarkMode}
        onToggleDarkMode={props.onToggleDarkMode}
        engineMode={props.engineMode === 'classic' ? ModeAccess.CLASSIC : ModeAccess.NATIVE}
        classicSttMode={props.classicSttMode}
        onClassicSttModeChange={props.onClassicSttModeChange}
        isClassicTtsEnabled={props.isClassicTtsEnabled}
        onToggleClassicTts={props.onToggleClassicTts}
        classicTtsMode={props.classicTtsMode}
        onClassicTtsModeChange={props.onClassicTtsModeChange}
        isNativeTtsEnabled={props.isNativeTtsEnabled}
        onToggleNativeTts={props.onToggleNativeTts}
        isLearningGoalsQuestioningEnabled={props.isLearningGoalsQuestioningEnabled}
        onToggleLearningGoalsQuestioning={props.onToggleLearningGoalsQuestioning}
        isLearningGoalAiEnabled={props.isLearningGoalAiEnabled}
        onToggleLearningGoalAi={props.onToggleLearningGoalAi}
        learningGoalStarters={props.learningGoalStarters}
        onAddLearningGoalStarter={props.onAddLearningGoalStarter}
        onSetLearningGoalStarter={props.onSetLearningGoalStarter}
        onRemoveLearningGoalStarter={props.onRemoveLearningGoalStarter}
        isLearningGoalTableExtractionEnabled={props.isLearningGoalTableExtractionEnabled}
        onToggleLearningGoalTableExtraction={props.onToggleLearningGoalTableExtraction}
        learningGoalTableColumnIndex={props.learningGoalTableColumnIndex}
        onSetLearningGoalTableColumnIndex={props.onSetLearningGoalTableColumnIndex}
        onRestartWalkthrough={props.onRestartWalkthrough}
        onLogout={props.onLogout}
        onClose={props.onCloseSettings}
      />

      <UploadLibraryModal
        isOpen={props.showUpload}
        onClose={props.onCloseUpload}
        currentFolderId={props.currentFolderId}
        onOpenFolder={props.onOpenFolder}
        breadcrumbs={props.breadcrumbs}
        movingItemId={props.movingItemId}
        onSetMovingItemId={props.onSetMovingItemId}
        onMoveItem={props.onMoveItem}
        onCreateFolder={props.onCreateFolder}
        onFileUpload={props.onFileUpload}
        onLearningGoalsFileUpload={props.onLearningGoalsFileUpload}
        onFileDrop={props.onFileDrop}
        isExtracting={props.isExtracting}
        currentItems={props.currentItems}
        onRenameItem={props.onRenameItem}
        onDeleteItem={props.onDeleteItem}
        onToggleFileSelection={props.onToggleFileSelection}
        onToggleFolderSelection={props.onToggleFolderSelection}
        isFolderSelected={props.isFolderSelected}
        hasSelectableFilesInFolder={props.hasSelectableFilesInFolder}
        onSetItemIconColor={props.onSetItemIconColor}
        selectedCount={props.selectedCount}
        walkthroughResetToken={props.uploadWalkthroughResetToken}
        walkthroughMode={props.uploadWalkthroughMode}
        narrateWalkthrough={props.isWalkthroughNarrationEnabled}
        onWalkthroughCompleted={props.onUploadWalkthroughCompleted}
      />

      <div
        className={`flex-1 min-h-0 w-full mx-auto px-4 md:px-8 pt-24 pb-4 flex flex-col ${
          hasLearningGoalsSidebar ? 'max-w-[58rem]' : 'max-w-5xl'
        }`}
      >
        <main className="flex-1 min-h-0 flex flex-col">
          {props.engineMode === ModeAccess.NATIVE ? (
            <VoiceInterface
              isActive={props.isVoiceActive}
              onClose={props.onCloseVoice}
              onTranscriptionUpdate={props.onTranscriptionUpdate}
              onTurnComplete={props.onTurnComplete}
              onBotSpeakingChange={props.onBotSpeakingChange}
              studyMaterial={props.activeStudyContext}
              ttsEnabled={props.isNativeTtsEnabled}
              ragUserId={props.currentUser.id}
              ragSelectedStudyItems={props.ragSelectedStudyItems}
            />
          ) : (
            <ClassicVoiceInterface
              isActive={props.isVoiceActive}
              onClose={props.onCloseVoice}
              onTranscriptionUpdate={props.onTranscriptionUpdate}
              onTurnComplete={props.onTurnComplete}
              onBotSpeakingChange={props.onBotSpeakingChange}
              studyMaterial={props.activeStudyContext}
              sttMode={props.classicSttMode}
              ttsMode={props.classicTtsMode}
              ttsEnabled={props.isClassicTtsEnabled}
            />
          )}
          <div className="flex flex-col flex-1 min-h-0">
            <ChatWindow
              messages={props.messages}
              isTyping={props.isTyping}
              streamingUserText={props.streamingUserText}
              streamingBotText={props.streamingBotText}
            />
          </div>
        </main>

        <div className="shrink-0 mt-4">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-[1.75rem] shadow-xl border-2 border-slate-50 dark:border-slate-700 flex items-center gap-3">
            <input
              type="text"
              value={props.inputText}
              onChange={(e) => props.onInputTextChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && props.onSend()}
              placeholder={
                props.selectedCount > 0
                  ? `Vraag iets over je ${props.selectedCount} document(en)...`
                  : 'Stel een vraag of kies je lesstof!'
              }
              className="walkthrough-chat-input flex-1 px-5 py-3.5 bg-slate-50 dark:bg-slate-900 rounded-[1.25rem] border-none focus:ring-4 focus:ring-studybuddy-blue/5 outline-none text-base md:text-lg dark:text-white transition-all placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={props.onToggleInputRecording}
              disabled={props.isTyping || props.isVoiceActive}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-[1.25rem] flex items-center justify-center transition-all shadow-lg active:scale-90 ${
                props.isInputRecording
                  ? 'bg-rose-100 border-2 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-studybuddy-blue disabled:bg-slate-100 disabled:text-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600'
              }`}
              title={props.isInputRecording ? 'Stop opname' : 'Neem spraak op naar tekstveld'}
            >
              <i
                className={`fa-solid ${
                  props.isInputRecording ? 'fa-stop text-base' : 'fa-microphone text-lg'
                }`}
              ></i>
            </button>
            <button
              onClick={props.onSend}
              disabled={!props.inputText.trim() || props.isTyping || props.isVoiceActive}
              className="walkthrough-send-chat w-12 h-12 md:w-14 md:h-14 bg-studybuddy-blue hover:bg-blue-600 disabled:bg-slate-100 text-white rounded-[1.25rem] flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <i className="fa-solid fa-paper-plane text-xl md:text-2xl"></i>
            </button>
          </div>
        </div>

        <footer className="relative shrink-0 mt-4 py-4 flex flex-col sm:flex-row justify-between items-center text-slate-300 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] gap-4">
          <span>Eureka Expert</span>
          <div className="absolute left-1/2 -translate-x-1/2 flex space-x-4">
            <div className="w-3 h-3 bg-studybuddy-blue rounded-full"></div>
            <div className="w-3 h-3 bg-studybuddy-magenta rounded-full"></div>
            <div className="w-3 h-3 bg-studybuddy-yellow rounded-full"></div>
          </div>
          <span>(c) 2026 Eureka StudyBuddy</span>
        </footer>
      </div>

      {hasLearningGoalsSidebar && (
        <div className="hidden xl:block fixed right-8 top-24 z-30 w-[320px] 2xl:w-[350px]">
          <LearningGoalsPanel
            goals={props.detectedLearningGoals}
            disabledGoalTexts={props.disabledLearningGoalTexts}
            ratings={props.learningGoalRatings}
            aiSuggestions={props.learningGoalAiSuggestions}
            columns={props.learningGoalColumns}
            isAiEnabled={props.isLearningGoalAiEnabled}
            activeGoalText={props.activeLearningGoalText}
            onSetCellRating={props.onSetLearningGoalCellRating}
            onAddColumn={props.onAddLearningGoalColumn}
            onRemoveColumn={props.onRemoveLearningGoalColumn}
            onAddGoal={props.onAddLearningGoal}
            onToggleGoalDisabled={props.onToggleLearningGoalDisabled}
            onRemoveGoal={props.onRemoveLearningGoal}
            onResetAiEvaluation={props.onResetLearningGoalAiEvaluation}
          />
        </div>
      )}
    </div>
  );
};
