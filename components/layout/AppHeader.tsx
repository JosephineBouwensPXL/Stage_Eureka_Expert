import React from 'react';
import StudyBuddyLogo from '../StudyBuddyLogo';

interface AppHeaderProps {
  firstName: string;
  selectedCount: number;
  isVoiceActive: boolean;
  isAdmin: boolean;
  onOpenUpload: () => void;
  onStartVoice: () => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  firstName,
  selectedCount,
  isVoiceActive,
  isAdmin,
  onOpenUpload,
  onStartVoice,
  onOpenAdmin,
  onOpenSettings,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="w-full px-4 md:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <StudyBuddyLogo className="w-14 h-14" />
          <div>
            <h1 className="text-3xl font-black text-studybuddy-dark dark:text-white tracking-tight">
              StudyBuddy
            </h1>
            <p className="text-studybuddy-blue font-bold text-xs uppercase tracking-widest">
              Hi, {firstName}
            </p>
          </div>
        </div>

        <div className="walkthrough-header-actions flex items-center space-x-3">
          <button
            onClick={onStartVoice}
            className={`walkthrough-start-voice px-6 py-3 rounded-2xl transition-all active:scale-95 flex items-center font-black border ${
              isVoiceActive
                ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/60 text-red-500 dark:text-red-300 shadow-sm hover:bg-red-50/60 dark:hover:bg-red-950/20'
                : 'bg-studybuddy-blue hover:bg-blue-600 text-white border-studybuddy-blue shadow-lg hover:scale-[1.02]'
            }`}
            title={isVoiceActive ? 'Stop babbel modus' : 'Start babbel modus'}
          >
            {!isVoiceActive && <i className="fa-solid fa-comments mr-2"></i>}
            <span className="hidden sm:inline">
              {isVoiceActive ? 'Stop babbel modus' : 'Babbel modus'}
            </span>
          </button>
          <button
            onClick={onOpenUpload}
            className={`walkthrough-open-library px-5 py-3 rounded-2xl shadow-sm transition-all flex items-center space-x-2 font-bold ${
              selectedCount > 0
                ? 'bg-studybuddy-yellow text-studybuddy-dark'
                : 'bg-white dark:bg-slate-800 text-studybuddy-magenta border-2 border-slate-100 dark:border-slate-700'
            }`}
          >
            <i className="fa-solid fa-folder-tree"></i>
            <span className="hidden sm:inline">
              {selectedCount > 0 ? `${selectedCount} Gekozen` : 'Bibliotheek'}
            </span>
          </button>

          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-12 h-12 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-lg"
              title="Admin"
            >
              <i className="fa-solid fa-user-shield text-xl"></i>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="walkthrough-open-settings w-12 h-12 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 rounded-2xl flex items-center justify-center hover:text-studybuddy-blue transition-all"
          >
            <i className="fa-solid fa-gear text-xl"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
