import React from 'react';

type WalkthroughCompletionPromptProps = {
  firstName: string;
  onClose: () => void;
};

const WalkthroughCompletionPrompt: React.FC<WalkthroughCompletionPromptProps> = ({
  firstName,
  onClose,
}) => (
  <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white px-8 py-10 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
        <i className="fa-solid fa-graduation-cap text-2xl"></i>
      </div>
      <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-500">
        Helemaal Klaar
      </p>
      <h2 className="mt-3 text-3xl font-black text-studybuddy-dark dark:text-white">
        Je kunt nu beginnen met leren
      </h2>
      <p className="mt-4 text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">
        Super je bent klaar om te beginnen leren, {firstName}. Zeg hallo, om te starten met
        studeren. Als je lesmateriaal hebt geselecteerd en leerdoelen hebt ingesteld, zal de
        chatbot je ondervragen. Kleur zeker de vakjes rood, blauw of groen na elke vraag. Veel
        succes en plezier met leren!
      </p>
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-black text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Begin met leren
        </button>
      </div>
    </div>
  </div>
);

export default WalkthroughCompletionPrompt;
