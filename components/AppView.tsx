import React from 'react';
import { type WalkthroughStream, type SettingsTab } from './settings/SettingsModal';
import { Role, ModeAccess, ClassicSttMode, ClassicTtsMode, NativeSttMode, NativeTtsMode, Message, StudyItem } from '../types';
import AppHeader from './layout/AppHeader';
import SettingsModal from './settings/SettingsModal';
import UploadLibraryModal from './UploadLibrary';
import VoiceInterface from './VoiceInterface';
import ClassicVoiceInterface from './ClassicVoiceInterface';
import ChatWindow from './ChatWindow';
import LearningGoalsPanel, { LearningGoal, LearningGoalRating } from './LearningGoalsPanel';
import AdminPanel from './AdminPanel';
import AppWalkthrough from './walkthrough/AppWalkthrough';

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
  onOpenUploadFromWalkthrough: () => void;
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
  nativeSttMode: NativeSttMode;
  onNativeSttModeChange: (mode: NativeSttMode) => void;
  nativeTtsMode: NativeTtsMode;
  onNativeTtsModeChange: (mode: NativeTtsMode) => void;
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
  showLibraryIntroStep: boolean;
  isLearningGoalsUploadPending: boolean;
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
  const chatInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const hasLearningGoalsSidebar =
    props.hasSelectedLearningGoalsDocument || props.isLearningGoalsQuestioningEnabled;

  const resizeChatInput = React.useCallback(() => {
    const textarea = chatInputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 176);
    textarea.style.height = `${Math.max(nextHeight, 56)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 176 ? 'auto' : 'hidden';
  }, []);

  React.useLayoutEffect(() => {
    resizeChatInput();
  }, [props.inputText, resizeChatInput]);

  return (
    <div className="h-screen overflow-hidden flex flex-col transition-colors duration-300">
      <AppWalkthrough
        firstName={props.currentUser.firstName}
        isDarkMode={props.isDarkMode}
        showWelcomeTourPrompt={props.showWelcomeTourPrompt}
        isWalkthroughNarrationEnabled={props.isWalkthroughNarrationEnabled}
        onWalkthroughNarrationChange={props.onWalkthroughNarrationChange}
        onStartWelcomeTour={props.onStartWelcomeTour}
        onDismissWelcomeTourPrompt={props.onDismissWelcomeTourPrompt}
        showSettings={props.showSettings}
        onCloseSettings={props.onCloseSettings}
        showUpload={props.showUpload}
        onCloseUpload={props.onCloseUpload}
        isLearningGoalsQuestioningEnabled={props.isLearningGoalsQuestioningEnabled}
        onToggleLearningGoalsQuestioning={props.onToggleLearningGoalsQuestioning}
        onSettingsTabChange={props.onSettingsTabChange}
        onOpenUploadFromWalkthrough={props.onOpenUploadFromWalkthrough}
        appWalkthroughStream={props.appWalkthroughStream}
        appWalkthroughResetToken={props.appWalkthroughResetToken}
        showLibraryIntroStep={props.showLibraryIntroStep}
        isLearningGoalsUploadPending={props.isLearningGoalsUploadPending}
        hasLearningGoalsSidebar={hasLearningGoalsSidebar}
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
        nativeSttMode={props.nativeSttMode}
        onNativeSttModeChange={props.onNativeSttModeChange}
        nativeTtsMode={props.nativeTtsMode}
        onNativeTtsModeChange={props.onNativeTtsModeChange}
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
        isDarkMode={props.isDarkMode}
        onWalkthroughCompleted={props.onUploadWalkthroughCompleted}
      />

      <div
        className={`flex-1 min-h-0 w-full mx-auto px-4 md:px-6 pt-20 pb-3 flex flex-col ${
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
          <div className="flex flex-col flex-1 min-h-0 items-center">
            <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0">
              <ChatWindow
                messages={props.messages}
                isTyping={props.isTyping}
                streamingUserText={props.streamingUserText}
                streamingBotText={props.streamingBotText}
              />
            </div>
          </div>
        </main>

        <div className="shrink-0 mt-3 flex justify-center">
          <div className="w-full max-w-3xl bg-white/95 dark:bg-slate-800/95 p-2 rounded-[1.2rem] shadow-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <textarea
              ref={chatInputRef}
              value={props.inputText}
              onChange={(e) => {
                props.onInputTextChange(e.target.value);
                resizeChatInput();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  props.onSend();
                }
              }}
              rows={1}
              placeholder={
                props.selectedCount > 0
                  ? `Vraag iets over je ${props.selectedCount} document(en)...`
                  : 'Stel een vraag of kies je lesstof!'
              }
              className="walkthrough-chat-input flex-1 min-h-[48px] max-h-32 resize-none px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-[0.95rem] border-none focus:ring-2 focus:ring-studybuddy-blue/10 outline-none text-base md:text-lg dark:text-white transition-all placeholder:text-slate-400 leading-5"
            />
            <button
              type="button"
              onClick={props.onToggleInputRecording}
              disabled={props.isTyping || props.isVoiceActive}
              className={`walkthrough-chat-voice w-10 h-10 md:w-11 md:h-11 rounded-[0.95rem] flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                props.isInputRecording
                  ? 'bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-studybuddy-blue disabled:bg-slate-100 disabled:text-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600'
              }`}
              title={props.isInputRecording ? 'Stop opname' : 'Start opname'}
            >
              <i
                className={`fa-solid ${
                  props.isInputRecording ? 'fa-stop text-sm' : 'fa-microphone text-sm'
                }`}
              ></i>
            </button>
            <button
              type="button"
              onClick={props.onSend}
              disabled={!props.inputText.trim() || props.isTyping || props.isVoiceActive}
              className="walkthrough-send-chat w-10 h-10 md:w-11 md:h-11 bg-studybuddy-blue hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-300 dark:disabled:bg-slate-700/70 dark:disabled:text-slate-500 text-white rounded-[0.95rem] flex items-center justify-center transition-all shadow-sm active:scale-90"
            >
              <i className="fa-solid fa-paper-plane text-sm md:text-base"></i>
            </button>
          </div>
        </div>

        <footer className="shrink-0 mt-3 py-2.5">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between text-slate-300 dark:text-slate-600 text-[9px] font-medium uppercase tracking-[0.22em]">
            <span className="whitespace-nowrap">Eureka Expert</span>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-studybuddy-blue rounded-full"></div>
              <div className="w-2.5 h-2.5 bg-studybuddy-magenta rounded-full"></div>
              <div className="w-2.5 h-2.5 bg-studybuddy-yellow rounded-full"></div>
            </div>
            <span className="whitespace-nowrap">&copy; 2026 Eureka StudyBuddy</span>
          </div>
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
