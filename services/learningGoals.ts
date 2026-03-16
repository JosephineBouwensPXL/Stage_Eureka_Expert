import { StudyItem } from '../types';

export const DEFAULT_LEARNING_GOAL_STARTERS = ['Ik', '-', '*', '\u2022', '1.'];

export type DetectedLearningGoal = {
  id: string;
  text: string;
  createdAt: Date;
};

export type LearningGoalRatingValue = 'red' | 'blue' | 'green';

export function getLearningGoalRatingsStorageKey(userId: string | undefined): string | null {
  if (!userId) return null;
  return `studybuddy_learning_goal_ratings_${userId}`;
}

export function extractDetectedLearningGoals(
  studyItems: StudyItem[],
  learningGoalStarters: string[]
): DetectedLearningGoal[] {
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

  const addGoal = (raw: string) => {
    const clean = raw
      .trim()
      .replace(/^[-*\u2022]\s*/, '')
      .replace(/^\d+[).\s-]+/, '')
      .trim();
    if (clean.length < 4) return;
    if (/^(leerdoel(en)?|leerdoelen overzicht)$/i.test(clean)) return;
    if (/^item:/i.test(clean)) return;
    const key = clean.toLowerCase();
    if (normalized.has(key)) return;
    normalized.add(key);
    extracted.push({ id: `goal-${normalized.size}`, text: clean, createdAt: new Date() });
  };

  for (const doc of fromLearningGoalDocs) {
    if (doc.learningGoals?.length) {
      for (const goal of doc.learningGoals) addGoal(goal);
    }

    const content = doc.content ?? '';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const lowered = trimmed.toLowerCase();
      const looksLikeGoal = normalizedStarters.some((starter) => {
        if (/^\d+[.\-)]?$/.test(starter)) return /^\d+[).\s-]+/.test(trimmed);
        return lowered.startsWith(starter);
      });
      if (looksLikeGoal) addGoal(trimmed);
    }
  }

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
    'Volg daarna exact de quiz-flow uit de system prompt: juist/fout beoordeling, korte gestructureerde uitleg, daarna volgende vraag.',
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
