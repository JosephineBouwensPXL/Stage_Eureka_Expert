import React from 'react';

export type LearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

export type LearningGoalRating = 'red' | 'blue' | 'green';

interface Props {
  goals: LearningGoal[];
  ratings: Record<string, (LearningGoalRating | null)[]>;
  columns: number;
  onSetCellRating: (goalText: string, columnIndex: number, rating: LearningGoalRating | null) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
}

const LearningGoalsPanel: React.FC<Props> = ({ goals, ratings, columns, onSetCellRating, onAddColumn, onRemoveColumn }) => {
  const MAX_COLUMNS = 5;
  const ratingClasses: Record<LearningGoalRating, string> = {
    red: 'bg-red-500 border-red-600',
    blue: 'bg-blue-500 border-blue-600',
    green: 'bg-emerald-500 border-emerald-600',
  };

  const nextRating = (current: LearningGoalRating | null): LearningGoalRating | null => {
    if (current === null) return 'red';
    if (current === 'red') return 'blue';
    if (current === 'blue') return 'green';
    return null;
  };

  return (
    <aside className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Leerdoelen</h3>
          <span className="text-xs font-bold text-slate-400">{goals.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRemoveColumn}
            disabled={columns <= 1}
            className={`w-6 h-6 rounded-md border transition-colors font-black ${
              columns <= 1
                ? 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Kolom verwijderen"
          >
            -
          </button>
          <button
            onClick={onAddColumn}
            disabled={columns >= MAX_COLUMNS}
            className={`w-6 h-6 rounded-md border transition-colors font-black ${
              columns >= MAX_COLUMNS
                ? 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={columns >= MAX_COLUMNS ? 'Maximum 5 kolommen' : 'Kolom toevoegen'}
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
        {goals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4 text-slate-400 text-sm font-semibold">
            Geen herkende leerdoelen gevonden in leerdoel-documenten.
          </div>
        ) : (
        <>
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="w-10 text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">#</th>
              <th className="text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">Leerdoel</th>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <th key={`col-${columnIndex}`} className="w-10 text-center px-1 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">
                  {columnIndex + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map((goal, index) => (
              <tr key={goal.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                <td className="px-3 py-2 font-bold text-slate-400 align-top">{index + 1}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200 break-words leading-snug">{goal.text}</td>
                {Array.from({ length: columns }).map((_, columnIndex) => {
                  const currentRating = ratings[goal.text]?.[columnIndex] ?? null;
                  return (
                    <td key={`${goal.id}-cell-${columnIndex}`} className="px-1 py-2 text-center">
                      <button
                        onClick={() => onSetCellRating(goal.text, columnIndex, nextRating(currentRating))}
                        className={`w-7 h-7 rounded-md border transition-all ${
                          currentRating ? `${ratingClasses[currentRating]} shadow-sm` : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                        }`}
                        title={currentRating ? `Kleur: ${currentRating}` : 'Klik om kleur te kiezen'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </>
        )}
      </div>
    </aside>
  );
};

export default LearningGoalsPanel;
