import React, { useMemo, useState } from 'react';

export type LearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

export type LearningGoalRating = 'red' | 'blue' | 'green';

interface Props {
  goals: LearningGoal[];
  disabledGoalTexts: string[];
  ratings: Record<string, (LearningGoalRating | null)[]>;
  aiSuggestions: Record<string, LearningGoalRating>;
  columns: number;
  isAiEnabled: boolean;
  activeGoalText?: string | null;
  onSetCellRating: (
    goalText: string,
    columnIndex: number,
    rating: LearningGoalRating | null
  ) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onAddGoal: (goalText: string) => void;
  onToggleGoalDisabled: (goalText: string) => void;
  onRemoveGoals: (goalTexts: string[]) => void;
  onResetAiEvaluation: () => void;
}

const LearningGoalsPanel: React.FC<Props> = ({
  goals,
  disabledGoalTexts,
  ratings,
  aiSuggestions,
  columns,
  isAiEnabled,
  activeGoalText,
  onSetCellRating,
  onAddColumn,
  onRemoveColumn,
  onAddGoal,
  onToggleGoalDisabled,
  onRemoveGoals,
  onResetAiEvaluation,
}) => {
  const MAX_COLUMNS = 5;
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const hasAiEvaluations = Object.keys(aiSuggestions).length > 0;
  const disabledSet = useMemo(
    () => new Set(disabledGoalTexts.map((text) => text.trim().toLowerCase())),
    [disabledGoalTexts]
  );
  const disabledVisibleGoalTexts = useMemo(
    () => goals.map((goal) => goal.text).filter((text) => disabledSet.has(text.trim().toLowerCase())),
    [goals, disabledSet]
  );
  const ratingClasses: Record<LearningGoalRating, string> = {
    red: 'bg-red-500 border-red-600',
    blue: 'bg-blue-500 border-blue-600',
    green: 'bg-emerald-500 border-emerald-600',
  };
  const aiSuggestionClasses: Record<LearningGoalRating, string> = {
    red: 'bg-red-200 border-red-300',
    blue: 'bg-blue-200 border-blue-300',
    green: 'bg-emerald-200 border-emerald-300',
  };

  const nextRating = (current: LearningGoalRating | null): LearningGoalRating | null => {
    if (current === null) return 'red';
    if (current === 'red') return 'blue';
    if (current === 'blue') return 'green';
    return null;
  };

  const submitNewGoal = () => {
    const clean = newGoalText.trim();
    if (clean.length < 4) return;
    onAddGoal(clean);
    setNewGoalText('');
    setIsAddingGoal(false);
  };

  return (
    <aside className="walkthrough-learning-goals-panel w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
            Leerdoelen
          </h3>
          <span className="text-xs font-bold text-slate-400">{goals.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isAiEnabled && (
            <>
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
            </>
          )}
          {isAiEnabled && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAddingGoal((prev) => !prev)}
                className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-black"
                title={isAddingGoal ? 'Annuleer toevoegen' : 'Leerdoel toevoegen'}
              >
                {isAddingGoal ? 'x' : '+'}
              </button>
              <button
                onClick={() => {
                  if (disabledVisibleGoalTexts.length === 0) return;
                  const count = disabledVisibleGoalTexts.length;
                  const confirmDelete = window.confirm(
                    `Ben je zeker dat je ${count} leerdoel${count === 1 ? '' : 'en'} wilt verwijderen?`
                  );
                  if (!confirmDelete) return;
                  onRemoveGoals(disabledVisibleGoalTexts);
                }}
                disabled={disabledVisibleGoalTexts.length === 0}
                className={`w-6 h-6 rounded-md border transition-colors ${
                  disabledVisibleGoalTexts.length > 0
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                    : 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title={
                  disabledVisibleGoalTexts.length > 0
                    ? `Verwijder ${disabledVisibleGoalTexts.length} uitgeschakelde leerdoel(en)`
                    : 'Schakel eerst een leerdoel uit via het nummer'
                }
              >
                <i className="fa-solid fa-trash text-xs"></i>
              </button>
              <button
                onClick={onResetAiEvaluation}
                disabled={!hasAiEvaluations}
                className={`h-6 px-2 rounded-md border transition-colors text-[9px] font-black uppercase tracking-wide ${
                  hasAiEvaluations
                    ? 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title={
                  hasAiEvaluations ? 'AI-evaluatie resetten' : 'Geen AI-evaluatie om te resetten'
                }
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
      {isAiEnabled && isAddingGoal && (
        <div className="mb-3 p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
          <input
            type="text"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewGoal();
              if (e.key === 'Escape') {
                setIsAddingGoal(false);
                setNewGoalText('');
              }
            }}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-studybuddy-blue/20"
            placeholder="Nieuw leerdoel..."
            autoFocus
          />
          <button
            onClick={submitNewGoal}
            disabled={newGoalText.trim().length < 4}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${
              newGoalText.trim().length >= 4
                ? 'bg-studybuddy-blue text-white hover:bg-blue-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Voeg leerdoel toe"
          >
            Voeg toe
          </button>
        </div>
      )}

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
                  <th className="w-10 text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">
                    #
                  </th>
                  <th className="text-left px-3 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500">
                    Leerdoel
                  </th>
                  {!isAiEnabled &&
                    Array.from({ length: columns }).map((_, columnIndex) => (
                      <th
                        key={`col-${columnIndex}`}
                        className="w-10 text-center px-1 py-2 font-black text-[11px] uppercase tracking-wider text-slate-500"
                      >
                        {columnIndex + 1}
                      </th>
                    ))}
                  {isAiEnabled && (
                    <th className="w-12 text-center px-1 py-2 font-black text-[11px] uppercase tracking-wider text-studybuddy-blue">
                      AI
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {goals.map((goal, index) => (
                  <tr
                    key={goal.id}
                    className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                      activeGoalText === goal.text
                        ? 'bg-studybuddy-blue/5 dark:bg-studybuddy-blue/10'
                        : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-400 align-top">
                      {(() => {
                        const isDisabled = disabledSet.has(goal.text.trim().toLowerCase());
                        return (
                      <button
                        onClick={() => onToggleGoalDisabled(goal.text)}
                        className={`w-6 h-6 rounded-md border text-[11px] transition-colors ${
                          isDisabled
                            ? 'bg-red-500 text-white border-red-600'
                            : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={
                          isDisabled
                            ? 'Uitgeschakeld: klik om opnieuw te activeren'
                            : 'Klik om dit leerdoel uit te schakelen'
                        }
                      >
                        {isDisabled ? <i className="fa-solid fa-ban text-[10px]"></i> : index + 1}
                      </button>
                        );
                      })()}
                    </td>
                    <td
                      className={`px-3 py-2 break-words leading-snug ${
                        disabledSet.has(goal.text.trim().toLowerCase())
                          ? 'text-slate-400 dark:text-slate-500 line-through'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {goal.text}
                    </td>
                    {!isAiEnabled &&
                      Array.from({ length: columns }).map((_, columnIndex) => {
                        const currentRating = ratings[goal.text]?.[columnIndex] ?? null;
                        return (
                          <td
                            key={`${goal.id}-cell-${columnIndex}`}
                            className="px-1 py-2 text-center"
                          >
                            <button
                              onClick={() =>
                                onSetCellRating(goal.text, columnIndex, nextRating(currentRating))
                              }
                              className={`w-7 h-7 rounded-md border transition-all ${
                                currentRating
                                  ? `${ratingClasses[currentRating]} shadow-sm`
                                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                              }`}
                              title={
                                currentRating
                                  ? `Kleur: ${currentRating}`
                                  : 'Klik om kleur te kiezen'
                              }
                            />
                          </td>
                        );
                      })}
                    {isAiEnabled && (
                      <td className="px-1 py-2 text-center">
                        {(() => {
                          const aiColor = aiSuggestions[goal.text];
                          return (
                            <div
                              className={`w-7 h-7 mx-auto rounded-md border ${
                                aiColor
                                  ? aiSuggestionClasses[aiColor]
                                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                              }`}
                              title={aiColor ? `AI suggestie: ${aiColor}` : 'Nog geen AI suggestie'}
                            />
                          );
                        })()}
                      </td>
                    )}
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
