import React from 'react';

type WelcomeTourPromptProps = {
  firstName: string;
  isWalkthroughNarrationEnabled: boolean;
  onToggleNarration: (enabled: boolean) => void;
  onStart: () => void;
  onDismiss: () => void;
};

const WelcomeTourPrompt: React.FC<WelcomeTourPromptProps> = ({
  firstName,
  isWalkthroughNarrationEnabled,
  onToggleNarration,
  onStart,
  onDismiss,
}) => (
  <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white px-8 py-10 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-studybuddy-blue/10 text-studybuddy-blue">
        <i className="fa-solid fa-hand-sparkles text-2xl"></i>
      </div>
      <p className="text-xs font-black uppercase tracking-[0.35em] text-studybuddy-blue">Welkom</p>
      <h2 className="mt-3 text-3xl font-black text-studybuddy-dark dark:text-white">
        Klaar voor je rondleiding?
      </h2>
      <p className="mt-4 text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">
        Welkom bij StudyBuddy, {firstName}. We starten zo meteen met een volledige rondleiding.
        Volg de <span className="font-black text-slate-700 dark:text-slate-100"> zwarte knoppen</span>{' '}
        om de rondleiding te doorlopen. Je kunt deze rondleiding later herbekijken via de
        instellingen.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={isWalkthroughNarrationEnabled}
          onClick={() => onToggleNarration(!isWalkthroughNarrationEnabled)}
          className={`flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
            isWalkthroughNarrationEnabled
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
              isWalkthroughNarrationEnabled ? 'bg-studybuddy-blue' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                isWalkthroughNarrationEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onStart}
            className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-black text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Start rondleiding
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-2xl border border-slate-200 px-6 py-4 text-base font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Misschien later
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default WelcomeTourPrompt;
