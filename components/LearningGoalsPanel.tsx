import React from 'react';

export type LearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

interface Props {
  goals: LearningGoal[];
}

const LearningGoalsPanel: React.FC<Props> = ({ goals }) => {
  return (
    <aside className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Leerdoelen</h3>
        <span className="text-xs font-bold text-slate-400">{goals.length}</span>
      </div>

      <div className="overflow-auto max-h-[360px] rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
        {goals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4 text-slate-400 text-sm font-semibold">
            Geen herkende leerdoelen gevonden in leerdoel-documenten.
          </div>
        ) : (
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
        )}
      </div>
    </aside>
  );
};

export default LearningGoalsPanel;
