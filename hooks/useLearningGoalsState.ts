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
    setLearningGoalStarter,
    removeLearningGoalStarter,
  };
}
