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

  const appWalkthroughSteps = React.useMemo<Step[]>(
    () => {
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

      return [
        {
          target: '.walkthrough-open-library',
          title: 'Bibliotheek',
          content: 'Open hier je bibliotheek om lesmateriaal of leerdoelen te kiezen.',
          disableBeacon: true,
        },
        {
          target: '.walkthrough-start-voice',
          title: 'Voice starten',
          content:
            'Klik op "Start Voice" voor een volledige steminteractie: praten, luisteren en direct feedback.',
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
        ...(props.hasSelectedLearningGoalsDocument
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
    },
    [props.appWalkthroughStream, props.hasSelectedLearningGoalsDocument]
  );

  const toNarrationText = (value: React.ReactNode): string => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  };

  const speakWalkthroughStep = (title?: React.ReactNode, content?: React.ReactNode) => {
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
    if (type === EVENTS.TOOLTIP) {
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
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [runAppWalkthrough]);

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
        onWalkthroughCompleted={props.onUploadWalkthroughCompleted}
      />

      <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-4 md:px-8 pt-24 pb-4 flex flex-col">
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
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-xl border-2 border-slate-50 dark:border-slate-700 flex items-center gap-3">
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
              className="walkthrough-chat-input flex-1 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-4 focus:ring-studybuddy-blue/5 outline-none text-lg dark:text-white transition-all placeholder:text-slate-400"
            />
            <button
              onClick={props.onSend}
              disabled={!props.inputText.trim() || props.isTyping || props.isVoiceActive}
              className="walkthrough-send-chat w-16 h-16 bg-studybuddy-blue hover:bg-blue-600 disabled:bg-slate-100 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <i className="fa-solid fa-paper-plane text-2xl"></i>
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

      {props.hasSelectedLearningGoalsDocument && (
        <div className="hidden xl:block fixed right-8 top-24 z-30 w-[460px] 2xl:w-[520px]">
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
