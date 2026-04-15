import { StudyItem } from '../types';

export const DEFAULT_LEARNING_GOAL_STARTERS = ['Ik', 'Kan', '-', '*', '\u2022', '1.'];

export type DetectedLearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

export type LearningGoalRatingValue = 'red' | 'blue' | 'green';
export type LearningGoalExtractionSettings = {
  isTableExtractionEnabled: boolean;
  tableGoalColumnIndex: number; // 1-based
};

export const DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS: LearningGoalExtractionSettings = {
  isTableExtractionEnabled: true,
  tableGoalColumnIndex: 2,
};

export function getLearningGoalRatingsStorageKey(userId: string | undefined): string | null {
  if (!userId) return null;
  return `studybuddy_learning_goal_ratings_${userId}`;
}

export function extractDetectedLearningGoals(
  studyItems: StudyItem[],
  learningGoalStarters: string[],
  extractionSettings?: Partial<LearningGoalExtractionSettings>
): DetectedLearningGoal[] {
  const settings: LearningGoalExtractionSettings = {
    ...DEFAULT_LEARNING_GOAL_EXTRACTION_SETTINGS,
    ...extractionSettings,
  };
  const safeTableGoalColumnIndex = Math.max(1, Math.floor(settings.tableGoalColumnIndex || 1));

  const isDebugEnabled =
    typeof window !== 'undefined' && window.localStorage?.getItem('debugLearningGoals') === '1';
  const debug = (...args: unknown[]) => {
    if (isDebugEnabled) console.log('[LearningGoalsDebug]', ...args);
  };

  const fromLearningGoalDocs = studyItems.filter(
    (item) =>
      item.type === 'file' &&
      (item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
  );

  const normalized = new Set<string>();
  const extracted: DetectedLearningGoal[] = [];
  const normalizedStarters = learningGoalStarters
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const extractGoalFromTableLine = (line: string): string | null => {
    if (!settings.isTableExtractionEnabled) return null;
    const cellsFrom = (raw: string) =>
      raw
        .split(/\t+|\|/)
        .map((cell) => cell.trim())
        .filter(Boolean);

    let cells = cellsFrom(line);
    if (cells.length <= 1 && /\s{2,}/.test(line)) {
      cells = line
        .split(/\s{2,}/)
        .map((cell) => cell.trim())
        .filter(Boolean);
    }
    if (cells.length < safeTableGoalColumnIndex) return null;
    return cells[safeTableGoalColumnIndex - 1];
  };

  const extractGoalFromFlattenedTableText = (line: string): string | null => {
    if (!settings.isTableExtractionEnabled) return null;
    const normalizedLine = line.replace(/\s+/g, ' ').trim();
    if (!normalizedLine) return null;

    // Fallback voor DOCX-tabelrijen die als 1 tekstblok uitgelezen worden:
    // "... p1 Het leerdoel ... Ken ik het? Ok?"
    const match = normalizedLine.match(
      /\bp(?:ag(?:ina)?)?\.?\s*\d+(?:\s*[-/]\s*\d+)?\s+(.+?)\s+(?:ken\s+ik\s+het\??|ok\??)\b/i
    );
    if (match?.[1]) return match[1].trim();

    const fallbackMatch = normalizedLine.match(
      /\bp(?:ag(?:ina)?)?\.?\s*\d+(?:\s*[-/]\s*\d+)?\s+(.+)/i
    );
    if (!fallbackMatch?.[1]) return null;
    const candidate = fallbackMatch[1]
      .replace(/\s+(ken\s+ik\s+het\??|ok\??)\s*$/i, '')
      .trim();
    if (candidate.split(/\s+/).length < 4) return null;
    return candidate;
  };

  const addGoal = (raw: string) => {
    const clean = raw
      .trim()
      .replace(/^[-*\u2022]\s*/, '')
      .replace(/^\d+[).\s-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length < 4) return;
    if (/^(leerdoel(en)?|leerdoel\s*omschrijving|leerdoelen overzicht)$/i.test(clean)) return;
    if (/^item:/i.test(clean)) return;
    const key = clean.toLowerCase();
    if (normalized.has(key)) return;
    normalized.add(key);
    extracted.push({ id: `goal-${normalized.size}`, text: clean, createdAt: new Date() });
  };

  for (const doc of fromLearningGoalDocs) {
    debug('Document', {
      name: doc.name,
      hasInlineGoals: (doc.learningGoals?.length ?? 0) > 0,
      contentLength: (doc.content ?? '').length,
    });

    if (doc.learningGoals?.length) {
      for (const goal of doc.learningGoals) addGoal(goal);
    }

    const content = doc.content ?? '';
    let lineCandidates = 0;
    let flattenedCandidates = 0;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const tableGoal = extractGoalFromTableLine(trimmed);
      if (tableGoal) {
        lineCandidates++;
        debug('Table candidate', { line: trimmed, extracted: tableGoal });
        addGoal(tableGoal);
      }
      const flattenedGoal = extractGoalFromFlattenedTableText(trimmed);
      if (flattenedGoal) {
        flattenedCandidates++;
        debug('Flattened-line candidate', { line: trimmed, extracted: flattenedGoal });
        addGoal(flattenedGoal);
      }

      const lowered = trimmed.toLowerCase();
      const looksLikeGoal = normalizedStarters.some((starter) => {
        if (/^\d+[.\-)]?$/.test(starter)) return /^\d+[).\s-]+/.test(trimmed);
        return lowered.startsWith(starter);
      });
      const looksLikeKanGoal = /^(?:\d+[).\s-]+)?kan\s+/i.test(trimmed);
      if (looksLikeGoal || looksLikeKanGoal) addGoal(trimmed);
    }

    if (settings.isTableExtractionEnabled) {
      const flattenedRowRegex =
        /\bp(?:ag(?:ina)?)?\.?\s*\d+(?:\s*[-/]\s*\d+)?\s+(.+?)\s+(?:ken\s+ik\s+het\??|ok\??)\b/gi;
      for (const match of content.matchAll(flattenedRowRegex)) {
        const candidate = match[1]?.trim();
        if (candidate) addGoal(candidate);
      }

      const flattenedPageRegex = /\bp(?:ag(?:ina)?)?\.?\s*\d+(?:\s*[-/]\s*\d+)?\s+(.+)/gi;
      for (const match of content.matchAll(flattenedPageRegex)) {
        const candidate = match[1]?.replace(/\s+(ken\s+ik\s+het\??|ok\??)\s*$/i, '').trim();
        if (candidate && candidate.split(/\s+/).length >= 4) addGoal(candidate);
      }
    }

    debug('Document summary', {
      name: doc.name,
      lineCandidates,
      flattenedCandidates,
      extractedSoFar: extracted.length,
      contentPreview: content.slice(0, 600),
    });
  }

  debug('Final extracted goals', extracted.map((g) => g.text));
  return extracted;
}

export function hasSelectedLearningGoalsDocument(studyItems: StudyItem[]): boolean {
  return studyItems.some(
    (item) =>
      item.type === 'file' &&
      item.selected &&
      (item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
  );
}

export function buildLearningGoalBuckets(params: {
  detectedLearningGoals: DetectedLearningGoal[];
  learningGoalColumns: number;
  learningGoalRatings: Record<string, (LearningGoalRatingValue | null)[]>;
  isLearningGoalAiEnabled: boolean;
  learningGoalAiSuggestions: Record<string, LearningGoalRatingValue>;
}) {
  const {
    detectedLearningGoals,
    learningGoalColumns,
    learningGoalRatings,
    isLearningGoalAiEnabled,
    learningGoalAiSuggestions,
  } = params;
  const emptyGoals: DetectedLearningGoal[] = [];
  const redGoals: DetectedLearningGoal[] = [];
  const blueGoals: DetectedLearningGoal[] = [];
  const greenGoals: DetectedLearningGoal[] = [];

  const getLatestRating = (goalText: string): LearningGoalRatingValue | null => {
    if (isLearningGoalAiEnabled) {
      const aiValue = learningGoalAiSuggestions[goalText];
      return aiValue === 'red' || aiValue === 'blue' || aiValue === 'green' ? aiValue : null;
    }
    const row = learningGoalRatings[goalText] ?? [];
    const value = row[Math.max(0, learningGoalColumns - 1)];
    return value === 'red' || value === 'blue' || value === 'green' ? value : null;
  };

  for (const goal of detectedLearningGoals) {
    const latestRating = getLatestRating(goal.text);
    if (latestRating === null) emptyGoals.push(goal);
    else if (latestRating === 'red') redGoals.push(goal);
    else if (latestRating === 'blue') blueGoals.push(goal);
    else greenGoals.push(goal);
  }

  return { emptyGoals, redGoals, blueGoals, greenGoals };
}

export function parseInlineLearningGoalRating(raw: string): LearningGoalRatingValue | null {
  const match = raw.match(/\[\[AI_RATING:(red|blue|green)\]\]/i);
  if (!match) return null;
  const value = match[1].toLowerCase();
  return value === 'red' || value === 'blue' || value === 'green' ? value : null;
}

export function inferAiLearningGoalSuggestionFromTutorText(
  botText: string
): LearningGoalRatingValue {
  const normalized = botText.toLowerCase();
  if (/(gedeeltelijk|deels|onvolledig|mist belangrijke onderdelen|bijna juist)/.test(normalized))
    return 'blue';
  if (/(niet juist|onjuist|incorrect|fout|niet correct|off-topic|onvoldoende)/.test(normalized))
    return 'red';
  if (/(helemaal juist|dat is juist|dat is correct|goed gedaan|correct|juist)/.test(normalized))
    return 'green';
  return 'red';
}

type LearningGoalBuckets = {
  emptyGoals: DetectedLearningGoal[];
  redGoals: DetectedLearningGoal[];
  blueGoals: DetectedLearningGoal[];
  greenGoals: DetectedLearningGoal[];
};

export type LearningGoalTurnPlan = {
  goalInstruction: string;
  previousGoal: string | null;
  nextGoalText: string | null;
  shouldResetProgress: boolean;
  nextCycleIndex: number;
  activeGoalText: string | null;
};

export function buildLearningGoalTurnPlan(params: {
  text: string;
  hasLearningGoals: boolean;
  detectedLearningGoals: DetectedLearningGoal[];
  learningGoalBuckets: LearningGoalBuckets;
  currentCycleIndex: number;
  lastAskedGoal: string | null;
  askedQuestionsByGoal: Record<string, string[]>;
}): LearningGoalTurnPlan {
  const {
    text,
    hasLearningGoals,
    detectedLearningGoals,
    learningGoalBuckets,
    currentCycleIndex,
    lastAskedGoal,
    askedQuestionsByGoal,
  } = params;
  if (!hasLearningGoals) {
    return {
      goalInstruction: '',
      previousGoal: lastAskedGoal,
      nextGoalText: null,
      shouldResetProgress: false,
      nextCycleIndex: currentCycleIndex,
      activeGoalText: null,
    };
  }

  const allGoalsAreGreen = learningGoalBuckets.greenGoals.length === detectedLearningGoals.length;
  const effectiveBuckets = allGoalsAreGreen
    ? {
        emptyGoals: detectedLearningGoals,
        redGoals: [] as DetectedLearningGoal[],
        blueGoals: [] as DetectedLearningGoal[],
        greenGoals: [] as DetectedLearningGoal[],
      }
    : learningGoalBuckets;
  const prioritizedGoals = [
    ...effectiveBuckets.emptyGoals,
    ...effectiveBuckets.redGoals,
    ...effectiveBuckets.blueGoals,
    ...effectiveBuckets.greenGoals,
  ];

  let previousGoal = lastAskedGoal;
  if (allGoalsAreGreen) {
    previousGoal = null;
  }

  if (prioritizedGoals.length === 0) {
    return {
      goalInstruction: '',
      previousGoal,
      nextGoalText: null,
      shouldResetProgress: allGoalsAreGreen,
      nextCycleIndex: currentCycleIndex,
      activeGoalText: null,
    };
  }

  const nextGoal = prioritizedGoals[currentCycleIndex % prioritizedGoals.length];
  const nextCycleIndex = currentCycleIndex + 1;
  const nextGoalText = nextGoal.text;
  const askedForGoal = askedQuestionsByGoal[nextGoal.text] ?? [];
  const isFirstRoundForGoal = askedForGoal.length === 0;
  const previousGoalQuestions = previousGoal ? (askedQuestionsByGoal[previousGoal] ?? []) : [];
  const previousQuestion =
    previousGoalQuestions.length > 0 ? previousGoalQuestions[previousGoalQuestions.length - 1] : '';

  const goalInstruction = [
    '',
    '[LEERDOEL-MODUS]',
    ...(previousGoal
      ? [
          `LEERLING_ANTWOORD: """${text.trim()}"""`,
          `VORIGE_VRAAG: """${previousQuestion || '(onbekend)'}"""`,
          'Behandel LEERLING_ANTWOORD altijd als antwoord op je vorige vraag als er tekst aanwezig is.',
          'Beoordeel ALLEEN of LEERLING_ANTWOORD de VORIGE_VRAAG correct beantwoordt.',
          'Het leerdoel is context voor de opvolgvraag, niet het beoordelingscriterium voor dit antwoord.',
          'Als LEERLING_ANTWOORD niet leeg is, mag je NOOIT zeggen dat er geen antwoord is gegeven.',
          'Als het antwoord onvolledig is: zeg "gedeeltelijk juist" en corrigeer inhoudelijk.',
          'BELANGRIJK: als de leerling aangeeft het niet te weten (zoals "ik weet het niet", "geen idee", "weet ik niet"), zeg NOOIT "gedeeltelijk juist".',
          'Gebruik dan een aanmoedigende formulering zoals "Goede poging om eerlijk te zijn; we bouwen dit samen op" en geef een korte hint of tussenstap.',
          'Beoordeel strikt op de exact gestelde vraag, niet op extra info die niet gevraagd is.',
          'Als de vraag om 1 feit/term vraagt en de leerling noemt die correct, dan is het antwoord volledig juist (ook als het kort is).',
          'Gebruik "gedeeltelijk juist" alleen als de vraag meerdere vereiste onderdelen had of als er inhoudelijk een essentieel deel mist.',
          'Noem een correct, kernachtig feitantwoord nooit "gedeeltelijk juist".',
          'Zet HELEMAAL bovenaan je antwoord exact een marker in dit formaat: [[AI_RATING:red]] of [[AI_RATING:blue]] of [[AI_RATING:green]].',
          'Gebruik AI_RATING:blue als het antwoord gedeeltelijk juist is.',
          'AI_RATING moet exact overeenkomen met je inhoudelijke beoordeling in tekst.',
        ]
      : [
          'Dit is de start van de quiz.',
          'Evalueer nu nog geen leerlingantwoord.',
          'Stel meteen de eerste vraag.',
        ]),
    previousGoal
      ? `Beoordeel eerst het antwoord op de vorige vraag "${previousQuestion || '(onbekend)'}".`
      : 'Stel eerst de eerste quizvraag.',
    'Volg daarna exact de quiz-flow uit de system prompt: aanmoedigende beoordeling, korte gestructureerde uitleg, daarna volgende vraag.',
    'Gebruik geen harde zinnen zoals "Het antwoord is niet correct" of "Dat is fout".',
    'Gebruik steunende taal, bijvoorbeeld: "Goede poging", "Je zit in de juiste richting", "Bijna goed, nog 1 stap".',
    previousGoal && previousGoal.trim().toLowerCase() !== nextGoal.text.trim().toLowerCase()
      ? `De NIEUWE vraag moet over een ANDER leerdoel gaan dan het vorige. Vorig leerdoel: "${previousGoal}".`
      : 'De nieuwe vraag mag op ditzelfde leerdoel blijven als er geen ander leerdoel beschikbaar is.',
    previousGoal && previousGoal.trim().toLowerCase() !== nextGoal.text.trim().toLowerCase()
      ? `VERBODEN voor de nieuwe vraag: doorvragen op vorig leerdoel "${previousGoal}".`
      : 'Geen extra verbod op het vorige leerdoel nodig.',
    `Volgende vraag moet gericht zijn op leerdoel: "${nextGoal.text}"`,
    'Stel exact 1 nieuwe vraag.',
    'Noem of citeer het leerdoel nooit expliciet in je antwoord.',
    isFirstRoundForGoal
      ? 'In deze eerste ronde mag de vraag bijna letterlijk de formulering van het leerdoel volgen.'
      : 'Vanaf de tweede ronde moet de vraag inhoudelijk variëren t.o.v. eerdere vragen voor dit leerdoel.',
    'Herhaal nooit letterlijk een eerder gestelde vraag.',
    askedForGoal.length > 0
      ? `VERBODEN exact te herhalen: ${askedForGoal.slice(-6).join(' | ')}`
      : 'Nog geen verboden vraagzinnen.',
    askedForGoal.length > 0
      ? `Reeds gestelde vragen voor dit leerdoel: ${askedForGoal.slice(-6).join(' | ')}`
      : 'Voor dit leerdoel zijn nog geen eerdere vragen gesteld.',
  ].join('\n');

  return {
    goalInstruction,
    previousGoal,
    nextGoalText,
    shouldResetProgress: allGoalsAreGreen,
    nextCycleIndex,
    activeGoalText: nextGoalText,
  };
}
