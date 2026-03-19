import { useCallback, useEffect, useMemo, useState } from 'react';
import { LearningGoalRating } from '../components/LearningGoalsPanel';
import {
  DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS,
  DEFAULT_LEARNING_GOAL_STARTERS,
  getLearningGoalRatingsStorageKey,
} from '../services/learningGoals';

type UseLearningGoalsStateParams = {
  userId?: string;
  maxColumns: number;
};

export function useLearningGoalsState(params: UseLearningGoalsStateParams) {
  const [learningGoalRatings, setLearningGoalRatings] = useState<
    Record<string, (LearningGoalRating | null)[]>
  >({});
  const [learningGoalAiSuggestions, setLearningGoalAiSuggestions] = useState<
    Record<string, LearningGoalRating>
  >({});
  const [learningGoalColumns, setLearningGoalColumns] = useState<number>(1);
  const [isLearningGoalAiEnabled, setIsLearningGoalAiEnabled] = useState<boolean>(false);
  const [isLearningGoalsQuestioningEnabled, setIsLearningGoalsQuestioningEnabled] =
    useState<boolean>(true);
  const [learningGoalStarters, setLearningGoalStarters] = useState<string[]>(
    DEFAULT_LEARNING_GOAL_STARTERS
  );
  const [customLearningGoals, setCustomLearningGoals] = useState<string[]>([]);
  const [hiddenLearningGoals, setHiddenLearningGoals] = useState<string[]>([]);
  const [disabledLearningGoals, setDisabledLearningGoals] = useState<string[]>([]);
  const [isLearningGoalTableExtractionEnabled, setIsLearningGoalTableExtractionEnabled] =
    useState<boolean>(DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled);
  const [learningGoalTableColumnIndex, setLearningGoalTableColumnIndex] = useState<number>(
    DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex
  );
  const [activeLearningGoalText, setActiveLearningGoalText] = useState<string | null>(null);
  const [isLearningGoalRatingsReady, setIsLearningGoalRatingsReady] = useState(false);

  const learningGoalRatingsStorageKey = useMemo(
    () => getLearningGoalRatingsStorageKey(params.userId),
    [params.userId]
  );

  useEffect(() => {
    setIsLearningGoalRatingsReady(false);

    if (!learningGoalRatingsStorageKey) {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setCustomLearningGoals([]);
      setHiddenLearningGoals([]);
      setDisabledLearningGoals([]);
      setIsLearningGoalTableExtractionEnabled(
        DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled
      );
      setLearningGoalTableColumnIndex(DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex);
      setIsLearningGoalRatingsReady(true);
      return;
    }
    const raw = localStorage.getItem(learningGoalRatingsStorageKey);
    if (!raw) {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setCustomLearningGoals([]);
      setHiddenLearningGoals([]);
      setDisabledLearningGoals([]);
      setIsLearningGoalTableExtractionEnabled(
        DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled
      );
      setLearningGoalTableColumnIndex(DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex);
      setIsLearningGoalRatingsReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);

      if (parsed && !Array.isArray(parsed) && !parsed.ratings) {
        const migrated: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (value === 'red' || value === 'blue' || value === 'green') {
            migrated[goalText] = [value as LearningGoalRating];
          }
        }
        setLearningGoalRatings(migrated);
        setLearningGoalAiSuggestions({});
        setLearningGoalColumns(1);
        setIsLearningGoalAiEnabled(false);
        setIsLearningGoalsQuestioningEnabled(true);
        setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
        setCustomLearningGoals([]);
        setHiddenLearningGoals([]);
        setDisabledLearningGoals([]);
        setIsLearningGoalTableExtractionEnabled(
          DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled
        );
        setLearningGoalTableColumnIndex(
          DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex
        );
        setIsLearningGoalRatingsReady(true);
        return;
      }

      const parsedColumns = Number(parsed?.columns);
      const safeColumns =
        Number.isFinite(parsedColumns) && parsedColumns > 0
          ? Math.min(params.maxColumns, Math.floor(parsedColumns))
          : 1;
      const parsedAiEnabled = typeof parsed?.isAiEnabled === 'boolean' ? parsed.isAiEnabled : false;
      const parsedQuestioningEnabled =
        typeof parsed?.isQuestioningEnabled === 'boolean' ? parsed.isQuestioningEnabled : true;
      const parsedRatings = (parsed?.ratings ?? {}) as Record<string, unknown>;
      const parsedAiSuggestions = (parsed?.aiSuggestions ?? {}) as Record<string, unknown>;
      const parsedStarters = Array.isArray(parsed?.goalStarters) ? parsed.goalStarters : [];
      const parsedCustomGoals = Array.isArray(parsed?.customGoals) ? parsed.customGoals : [];
      const parsedHiddenGoals = Array.isArray(parsed?.hiddenGoals) ? parsed.hiddenGoals : [];
      const parsedDisabledGoals = Array.isArray(parsed?.disabledGoals) ? parsed.disabledGoals : [];
      const parsedTableExtractionEnabled =
        typeof parsed?.isTableExtractionEnabled === 'boolean'
          ? parsed.isTableExtractionEnabled
          : DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled;
      const parsedTableColumnIndex = Number(parsed?.tableGoalColumnIndex);
      const safeTableColumnIndex =
        Number.isFinite(parsedTableColumnIndex) && parsedTableColumnIndex >= 1
          ? Math.floor(parsedTableColumnIndex)
          : DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex;
      const normalizedStarters = parsedStarters
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
      const normalizedCustomGoals: string[] = [];
      const seenCustomGoals = new Set<string>();
      for (const value of parsedCustomGoals) {
        if (typeof value !== 'string') continue;
        const clean = value.trim().replace(/\s+/g, ' ');
        if (clean.length < 4) continue;
        const key = clean.toLowerCase();
        if (seenCustomGoals.has(key)) continue;
        seenCustomGoals.add(key);
        normalizedCustomGoals.push(clean);
      }
      const normalizedHiddenGoals: string[] = [];
      const seenHiddenGoals = new Set<string>();
      for (const value of parsedHiddenGoals) {
        if (typeof value !== 'string') continue;
        const clean = value.trim().replace(/\s+/g, ' ');
        if (clean.length < 4) continue;
        const key = clean.toLowerCase();
        if (seenHiddenGoals.has(key)) continue;
        seenHiddenGoals.add(key);
        normalizedHiddenGoals.push(clean);
      }
      const normalizedDisabledGoals: string[] = [];
      const seenDisabledGoals = new Set<string>();
      for (const value of parsedDisabledGoals) {
        if (typeof value !== 'string') continue;
        const clean = value.trim().replace(/\s+/g, ' ');
        if (clean.length < 4) continue;
        const key = clean.toLowerCase();
        if (seenDisabledGoals.has(key)) continue;
        seenDisabledGoals.add(key);
        normalizedDisabledGoals.push(clean);
      }
      const normalized: Record<string, (LearningGoalRating | null)[]> = {};
      const normalizedAiSuggestions: Record<string, LearningGoalRating> = {};

      for (const [goalText, row] of Object.entries(parsedRatings)) {
        const rowArray = Array.isArray(row) ? row : [];
        normalized[goalText] = Array.from({ length: safeColumns }, (_, idx) => {
          const value = rowArray[idx];
          return value === 'red' || value === 'blue' || value === 'green' ? value : null;
        });
      }
      for (const [goalText, value] of Object.entries(parsedAiSuggestions)) {
        if (value === 'red' || value === 'blue' || value === 'green') {
          normalizedAiSuggestions[goalText] = value;
        }
      }

      setLearningGoalRatings(normalized);
      setLearningGoalAiSuggestions(normalizedAiSuggestions);
      setLearningGoalColumns(safeColumns);
      setIsLearningGoalAiEnabled(parsedAiEnabled);
      setIsLearningGoalsQuestioningEnabled(parsedQuestioningEnabled);
      setLearningGoalStarters(
        normalizedStarters.length > 0 ? normalizedStarters : DEFAULT_LEARNING_GOAL_STARTERS
      );
      setCustomLearningGoals(normalizedCustomGoals);
      setHiddenLearningGoals(normalizedHiddenGoals);
      setDisabledLearningGoals(normalizedDisabledGoals);
      setIsLearningGoalTableExtractionEnabled(parsedTableExtractionEnabled);
      setLearningGoalTableColumnIndex(safeTableColumnIndex);
      setIsLearningGoalRatingsReady(true);
    } catch {
      setLearningGoalRatings({});
      setLearningGoalAiSuggestions({});
      setLearningGoalColumns(1);
      setIsLearningGoalAiEnabled(false);
      setIsLearningGoalsQuestioningEnabled(true);
      setLearningGoalStarters(DEFAULT_LEARNING_GOAL_STARTERS);
      setCustomLearningGoals([]);
      setHiddenLearningGoals([]);
      setDisabledLearningGoals([]);
      setIsLearningGoalTableExtractionEnabled(
        DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.isTableExtractionEnabled
      );
      setLearningGoalTableColumnIndex(DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS.tableGoalColumnIndex);
      setIsLearningGoalRatingsReady(true);
    }
  }, [learningGoalRatingsStorageKey, params.maxColumns]);

  useEffect(() => {
    if (!learningGoalRatingsStorageKey || !isLearningGoalRatingsReady) return;
    localStorage.setItem(
      learningGoalRatingsStorageKey,
      JSON.stringify({
        columns: learningGoalColumns,
        isAiEnabled: isLearningGoalAiEnabled,
        isQuestioningEnabled: isLearningGoalsQuestioningEnabled,
        goalStarters: learningGoalStarters.map((value) => value.trim()).filter(Boolean),
        customGoals: customLearningGoals.map((value) => value.trim()).filter(Boolean),
        hiddenGoals: hiddenLearningGoals.map((value) => value.trim()).filter(Boolean),
        disabledGoals: disabledLearningGoals.map((value) => value.trim()).filter(Boolean),
        isTableExtractionEnabled: isLearningGoalTableExtractionEnabled,
        tableGoalColumnIndex: learningGoalTableColumnIndex,
        aiSuggestions: learningGoalAiSuggestions,
        ratings: learningGoalRatings,
      })
    );
  }, [
    learningGoalRatings,
    learningGoalAiSuggestions,
    learningGoalColumns,
    isLearningGoalAiEnabled,
    isLearningGoalsQuestioningEnabled,
    learningGoalStarters,
    customLearningGoals,
    hiddenLearningGoals,
    disabledLearningGoals,
    isLearningGoalTableExtractionEnabled,
    learningGoalTableColumnIndex,
    learningGoalRatingsStorageKey,
    isLearningGoalRatingsReady,
  ]);

  const setLearningGoalCellRating = useCallback(
    (goalText: string, columnIndex: number, rating: LearningGoalRating | null) => {
      setLearningGoalRatings((prev) => {
        const currentRow =
          prev[goalText] ?? Array.from({ length: learningGoalColumns }, () => null);
        const nextRow = [...currentRow];
        while (nextRow.length < learningGoalColumns) nextRow.push(null);
        nextRow[columnIndex] = rating;
        return { ...prev, [goalText]: nextRow };
      });
    },
    [learningGoalColumns]
  );

  const addLearningGoalColumn = useCallback(() => {
    setLearningGoalColumns((prevColumns) => {
      if (prevColumns >= params.maxColumns) return params.maxColumns;
      const nextColumns = prevColumns + 1;
      setLearningGoalRatings((prevRatings: Record<string, (LearningGoalRating | null)[]>) => {
        const expanded: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, row] of Object.entries(prevRatings) as [
          string,
          (LearningGoalRating | null)[],
        ][]) {
          const nextRow = [...row];
          while (nextRow.length < nextColumns) nextRow.push(null);
          expanded[goalText] = nextRow;
        }
        return expanded;
      });
      return nextColumns;
    });
  }, [params.maxColumns]);

  const removeLearningGoalColumn = useCallback(() => {
    setLearningGoalColumns((prevColumns) => {
      if (prevColumns <= 1) return 1;
      const nextColumns = prevColumns - 1;
      setLearningGoalRatings((prevRatings: Record<string, (LearningGoalRating | null)[]>) => {
        const trimmed: Record<string, (LearningGoalRating | null)[]> = {};
        for (const [goalText, row] of Object.entries(prevRatings) as [
          string,
          (LearningGoalRating | null)[],
        ][]) {
          trimmed[goalText] = row.slice(0, nextColumns);
        }
        return trimmed;
      });
      return nextColumns;
    });
  }, []);

  const addLearningGoalStarter = useCallback(() => {
    setLearningGoalStarters((prev) => [...prev, '']);
  }, []);

  const addCustomLearningGoal = useCallback((value: string) => {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (clean.length < 4) return;

    setCustomLearningGoals((prev) => {
      const exists = prev.some((goal) => goal.toLowerCase() === clean.toLowerCase());
      if (exists) return prev;
      return [...prev, clean];
    });
    setDisabledLearningGoals((prev) => prev.filter((goal) => goal.toLowerCase() !== clean.toLowerCase()));
  }, []);

  const toggleLearningGoalDisabled = useCallback((goalText: string) => {
    const clean = goalText.trim().replace(/\s+/g, ' ');
    if (clean.length < 4) return;
    const key = clean.toLowerCase();
    setDisabledLearningGoals((prev) => {
      if (prev.some((goal) => goal.toLowerCase() === key)) {
        return prev.filter((goal) => goal.toLowerCase() !== key);
      }
      return [...prev, clean];
    });
  }, []);

  const removeLearningGoal = useCallback((goalText: string) => {
    const clean = goalText.trim().replace(/\s+/g, ' ');
    if (clean.length < 4) return;
    const key = clean.toLowerCase();

    setCustomLearningGoals((prev) => prev.filter((goal) => goal.toLowerCase() !== key));
    setHiddenLearningGoals((prev) => {
      if (prev.some((goal) => goal.toLowerCase() === key)) return prev;
      return [...prev, clean];
    });
    setDisabledLearningGoals((prev) => prev.filter((goal) => goal.toLowerCase() !== key));
    setLearningGoalRatings((prev) => {
      const next = { ...prev };
      delete next[goalText];
      for (const existingKey of Object.keys(next)) {
        if (existingKey.toLowerCase() === key) delete next[existingKey];
      }
      return next;
    });
    setLearningGoalAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[goalText];
      for (const existingKey of Object.keys(next)) {
        if (existingKey.toLowerCase() === key) delete next[existingKey];
      }
      return next;
    });
  }, []);

  const setLearningGoalStarter = useCallback((index: number, value: string) => {
    setLearningGoalStarters((prev) => prev.map((starter, i) => (i === index ? value : starter)));
  }, []);

  const removeLearningGoalStarter = useCallback((index: number) => {
    setLearningGoalStarters((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return {
    learningGoalRatings,
    setLearningGoalRatings,
    learningGoalAiSuggestions,
    setLearningGoalAiSuggestions,
    learningGoalColumns,
    isLearningGoalAiEnabled,
    setIsLearningGoalAiEnabled,
    isLearningGoalsQuestioningEnabled,
    setIsLearningGoalsQuestioningEnabled,
    learningGoalStarters,
    customLearningGoals,
    hiddenLearningGoals,
    disabledLearningGoals,
    isLearningGoalTableExtractionEnabled,
    setIsLearningGoalTableExtractionEnabled,
    learningGoalTableColumnIndex,
    setLearningGoalTableColumnIndex,
    activeLearningGoalText,
    setActiveLearningGoalText,
    setLearningGoalCellRating,
    addLearningGoalColumn,
    removeLearningGoalColumn,
    addLearningGoalStarter,
    addCustomLearningGoal,
    toggleLearningGoalDisabled,
    removeLearningGoal,
    setLearningGoalStarter,
    removeLearningGoalStarter,
  };
}
