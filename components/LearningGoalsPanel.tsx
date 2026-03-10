import React, { useState } from 'react';

export type LearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

interface Props {
  goals: LearningGoal[];
  onAddGoal: (goalText: string) => void;
}

const LearningGoalsPanel: React.FC<Props> = ({ goals, onAddGoal }) => {
  const [draftGoal, setDraftGoal] = useState('');

  const submitGoal = () => {
    const text = draftGoal.trim();
    if (!text) return;
    onAddGoal(text);
    setDraftGoal('');
  };

  return (
    <aside className="w-full lg:w-96 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-lg p-4 flex flex-col min-h-[16rem] lg:min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Leerdoelen</h3>
        <span className="text-xs font-bold text-slate-400">{goals.length}</span>
      </div>

      <div className="overflow-auto flex-1 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">#</th>
              <th className="text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">Leerdoel</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal, index) => (
              <tr key={goal.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                <td className="px-3 py-2 font-bold text-slate-400 align-top">{index + 1}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{goal.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={draftGoal}
          onChange={(e) => setDraftGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitGoal()}
          placeholder='Bijv. "Ik ken de 3 aardlagen"'
          className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-studybuddy-blue/20"
        />
        <button
          onClick={submitGoal}
          className="px-4 py-3 rounded-xl bg-studybuddy-blue text-white font-black text-sm hover:bg-blue-600 transition-colors"
        >
          Toevoegen
        </button>
      </div>
    </aside>
  );
};

export default LearningGoalsPanel;
