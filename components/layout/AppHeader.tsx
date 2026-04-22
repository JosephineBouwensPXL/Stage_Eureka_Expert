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
      <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <StudyBuddyLogo className="w-11 h-11" />
          <div>
            <h1 className="text-[1.7rem] font-semibold text-studybuddy-dark dark:text-white tracking-tight">
              StudyBuddy
            </h1>
            <p className="text-studybuddy-blue font-medium text-[11px] uppercase tracking-[0.18em]">
              Hi, {firstName}
            </p>
          </div>
        </div>

        <div className="walkthrough-header-actions flex items-center space-x-2.5">
          <button
            type="button"
            onClick={onStartVoice}
            className={`walkthrough-start-voice px-4 py-2.5 rounded-[1rem] transition-all active:scale-95 flex items-center font-semibold border ${
              isVoiceActive
                ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/60 text-red-500 dark:text-red-300 shadow-sm hover:bg-red-50/60 dark:hover:bg-red-950/20'
                : 'bg-studybuddy-blue hover:bg-blue-600 text-white border-studybuddy-blue shadow-sm hover:scale-[1.01]'
            }`}
            title={isVoiceActive ? 'Stop babbel modus' : 'Start babbel modus'}
          >
            {!isVoiceActive && <i className="fa-solid fa-comments mr-2"></i>}
            <span className="hidden sm:inline">
              {isVoiceActive ? 'Stop babbel modus' : 'Babbel modus'}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className={`walkthrough-open-library px-4 py-2.5 rounded-[1rem] shadow-sm transition-all flex items-center space-x-2 font-medium ${
              selectedCount > 0
                ? 'bg-studybuddy-yellow text-studybuddy-dark'
                : 'bg-white dark:bg-slate-800 text-studybuddy-magenta border border-slate-100 dark:border-slate-700'
            }`}
          >
            <i className="fa-solid fa-folder-tree"></i>
            <span className="hidden sm:inline">
              {selectedCount > 0 ? `${selectedCount} Gekozen` : 'Bibliotheek'}
            </span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-10 h-10 bg-slate-900 dark:bg-slate-700 text-white rounded-[1rem] flex items-center justify-center hover:bg-black transition-all shadow-sm"
              title="Admin"
            >
              <i className="fa-solid fa-user-shield text-base"></i>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="walkthrough-open-settings w-10 h-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 rounded-[1rem] flex items-center justify-center hover:text-studybuddy-blue transition-all"
          >
            <i className="fa-solid fa-gear text-base"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
