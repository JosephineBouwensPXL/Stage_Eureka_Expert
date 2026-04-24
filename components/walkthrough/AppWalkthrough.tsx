import React from 'react';
import { EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { type SettingsTab, type WalkthroughStream } from '../settings/SettingsModal';
import WelcomeTourPrompt from './WelcomeTourPrompt';
import WalkthroughCompletionPrompt from './WalkthroughCompletionPrompt';
import { getAppWalkthroughSteps } from './walkthroughSteps';

const JoyrideComponent = Joyride as React.ComponentType<any>;

type AppWalkthroughProps = {
  firstName: string;
  isDarkMode: boolean;
  showWelcomeTourPrompt: boolean;
  isWalkthroughNarrationEnabled: boolean;
  onWalkthroughNarrationChange: (enabled: boolean) => void;
  onStartWelcomeTour: () => void;
  onDismissWelcomeTourPrompt: () => void;
  showSettings: boolean;
  onCloseSettings: () => void;
  showUpload: boolean;
  onCloseUpload: () => void;
  isLearningGoalsQuestioningEnabled: boolean;
  onToggleLearningGoalsQuestioning: () => void;
  onSettingsTabChange: (tab: SettingsTab) => void;
  onOpenUploadFromWalkthrough: () => void;
  appWalkthroughStream: WalkthroughStream;
  appWalkthroughResetToken: number;
  showLibraryIntroStep: boolean;
  isLearningGoalsUploadPending: boolean;
  hasLearningGoalsSidebar: boolean;
};

const AppWalkthrough: React.FC<AppWalkthroughProps> = ({
  firstName,
  isDarkMode,
  showWelcomeTourPrompt,
  isWalkthroughNarrationEnabled,
  onWalkthroughNarrationChange,
  onStartWelcomeTour,
  onDismissWelcomeTourPrompt,
  showSettings,
  onCloseSettings,
  showUpload,
  onCloseUpload,
  isLearningGoalsQuestioningEnabled,
  onToggleLearningGoalsQuestioning,
  onSettingsTabChange,
  onOpenUploadFromWalkthrough,
  appWalkthroughStream,
  appWalkthroughResetToken,
  showLibraryIntroStep,
  isLearningGoalsUploadPending,
  hasLearningGoalsSidebar,
}) => {
  const [runAppWalkthrough, setRunAppWalkthrough] = React.useState(false);
  const [showWalkthroughCompletionPrompt, setShowWalkthroughCompletionPrompt] =
    React.useState(false);
  const shouldShowFirstTimeCompletionPromptRef = React.useRef(false);
  const lastNarratedStepKeyRef = React.useRef<string | null>(null);
  const hasNarratedWelcomePromptRef = React.useRef(false);
  const blockingPanelsRef = React.useRef({
    onCloseSettings,
    onCloseUpload,
    showSettings,
    showUpload,
  });
  const settingsLearningGoalsRef = React.useRef({
    isLearningGoalsQuestioningEnabled,
    onToggleLearningGoalsQuestioning,
  });
  const didEnableLearningGoalsForSettingsWalkthroughRef = React.useRef(false);

  React.useEffect(() => {
    blockingPanelsRef.current = {
      onCloseSettings,
      onCloseUpload,
      showSettings,
      showUpload,
    };
  }, [onCloseSettings, onCloseUpload, showSettings, showUpload]);

  React.useEffect(() => {
    settingsLearningGoalsRef.current = {
      isLearningGoalsQuestioningEnabled,
      onToggleLearningGoalsQuestioning,
    };
  }, [isLearningGoalsQuestioningEnabled, onToggleLearningGoalsQuestioning]);

  const appWalkthroughSteps = React.useMemo(
    () =>
      getAppWalkthroughSteps({
        appWalkthroughStream,
        showLibraryIntroStep,
        isLearningGoalsUploadPending,
        hasLearningGoalsSidebar,
      }),
    [
      appWalkthroughStream,
      hasLearningGoalsSidebar,
      isLearningGoalsUploadPending,
      showLibraryIntroStep,
    ]
  );

  const toNarrationText = (value: React.ReactNode): string => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  };

  const hasReadyTarget = React.useCallback((target: Step['target']) => {
    if (typeof window === 'undefined') return false;
    if (typeof target !== 'string') return false;

    const element = document.querySelector<HTMLElement>(target);

    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, []);

  const isLearningGoalsWalkthroughTarget = (target: Step['target']) =>
    typeof target === 'string' && target.startsWith('.walkthrough-learning-goals');

  const closeBlockingPanelsForLearningGoals = React.useCallback(() => {
    const { onCloseSettings: closeSettings, onCloseUpload: closeUpload, showSettings: settingsOpen, showUpload: uploadOpen } =
      blockingPanelsRef.current;

    if (settingsOpen) closeSettings();
    if (uploadOpen) closeUpload();
  }, []);

  const prepareSettingsWalkthroughStep = React.useCallback(
    (target: Step['target']) => {
      if (appWalkthroughStream !== 'instellingen') return;
      if (typeof target !== 'string') return;

      const shouldShowLearningGoalOptions =
        target.includes('leerdoelen-paneel') || target.includes('learning-goals');

      if (target.includes('audio')) {
        onSettingsTabChange('audio');
      } else if (target.includes('leerdoelen') || target.includes('learning-goals')) {
        onSettingsTabChange('leerdoelen');
      } else {
        onSettingsTabChange('algemeen');
      }

      if (shouldShowLearningGoalOptions) {
        const {
          isLearningGoalsQuestioningEnabled: questioningEnabled,
          onToggleLearningGoalsQuestioning: toggleLearningGoals,
        } = settingsLearningGoalsRef.current;

        if (!questioningEnabled && !didEnableLearningGoalsForSettingsWalkthroughRef.current) {
          didEnableLearningGoalsForSettingsWalkthroughRef.current = true;
          toggleLearningGoals();
        }
      }

      window.setTimeout(() => {
        document.querySelector<HTMLElement>(target)?.scrollIntoView({
          block: 'center',
          inline: 'nearest',
        });
      }, 80);
    },
    [appWalkthroughStream, onSettingsTabChange]
  );

  const restoreSettingsWalkthroughLearningGoals = React.useCallback(() => {
    if (!didEnableLearningGoalsForSettingsWalkthroughRef.current) return;
    didEnableLearningGoalsForSettingsWalkthroughRef.current = false;

    const {
      isLearningGoalsQuestioningEnabled: questioningEnabled,
      onToggleLearningGoalsQuestioning: toggleLearningGoals,
    } = settingsLearningGoalsRef.current;

    if (questioningEnabled) {
      toggleLearningGoals();
    }
  }, []);

  const speakWalkthroughStep = React.useCallback(
    (title?: React.ReactNode, content?: React.ReactNode) => {
      if (!isWalkthroughNarrationEnabled) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const titleText = toNarrationText(title).trim();
      const contentText = toNarrationText(content).trim();
      const fullText = [titleText, contentText].filter(Boolean).join('. ');
      if (!fullText) return;
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = 'nl-NL';
      utterance.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [isWalkthroughNarrationEnabled]
  );

  const speakWalkthroughCompletionPrompt = React.useCallback(() => {
    if (!isWalkthroughNarrationEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(
      `Mooi zo, ${firstName}. De rondleiding is klaar. Je kunt nu beginnen met leren. Stel gerust je eerste vraag of start meteen met voice.`
    );
    utterance.lang = 'nl-NL';
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [firstName, isWalkthroughNarrationEnabled]);

  const speakWelcomePrompt = React.useCallback((onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    hasNarratedWelcomePromptRef.current = true;
    const utterance = new SpeechSynthesisUtterance(
      `Welkom bij StudyBuddy, ${firstName}. We starten zo meteen met een volledige rondleiding. Volg de zwarte knoppen om de rondleiding te doorlopen. Je kunt deze rondleiding later herbekijken via de instellingen.`
    );
    utterance.lang = 'nl-NL';
    utterance.rate = 1;
    utterance.onend = () => onEnd?.();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [firstName]);

  const handleWelcomeNarrationToggle = React.useCallback(
    (enabled: boolean) => {
      onWalkthroughNarrationChange(enabled);

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      if (!enabled) {
        window.speechSynthesis.cancel();
        return;
      }

      speakWelcomePrompt();
    },
    [onWalkthroughNarrationChange, speakWelcomePrompt]
  );

  const handleAppWalkthroughEvent = React.useCallback(({ status, type, index, step }: EventData) => {
    if (
      type === EVENTS.STEP_AFTER &&
      showLibraryIntroStep &&
      index === 0 &&
      (
        appWalkthroughStream === 'volledig' ||
        appWalkthroughStream === 'bibliotheek' ||
        appWalkthroughStream === 'leerdoelen'
      )
    ) {
      setRunAppWalkthrough(false);
      onOpenUploadFromWalkthrough();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (type === EVENTS.STEP_BEFORE) {
      prepareSettingsWalkthroughStep(step.target);
    }

    if (type === EVENTS.TOOLTIP) {
      prepareSettingsWalkthroughStep(step.target);

      if (isLearningGoalsWalkthroughTarget(step.target)) {
        closeBlockingPanelsForLearningGoals();
      }

      const stepKey = `${index}-${toNarrationText(step.title)}`;
      if (lastNarratedStepKeyRef.current !== stepKey) {
        lastNarratedStepKeyRef.current = stepKey;
        speakWalkthroughStep(step.title, step.content);
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunAppWalkthrough(false);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (appWalkthroughStream === 'instellingen') {
        restoreSettingsWalkthroughLearningGoals();
      }
      if (status === STATUS.FINISHED && shouldShowFirstTimeCompletionPromptRef.current) {
        shouldShowFirstTimeCompletionPromptRef.current = false;
        setShowWalkthroughCompletionPrompt(true);
      }
    }
  }, [
    appWalkthroughStream,
    closeBlockingPanelsForLearningGoals,
    onOpenUploadFromWalkthrough,
    prepareSettingsWalkthroughStep,
    restoreSettingsWalkthroughLearningGoals,
    showLibraryIntroStep,
    speakWalkthroughStep,
  ]);

  React.useEffect(() => {
    if (appWalkthroughResetToken < 1) return;
    if (appWalkthroughSteps.length === 0) {
      setRunAppWalkthrough(false);
      return;
    }

    const firstTarget = appWalkthroughSteps[0]?.target;
    if (!firstTarget) {
      setRunAppWalkthrough(false);
      return;
    }

    setRunAppWalkthrough(false);
    if (isLearningGoalsWalkthroughTarget(firstTarget)) {
      closeBlockingPanelsForLearningGoals();
    }

    let attempts = 0;
    let timer: number | null = null;

    const startWhenReady = () => {
      if (hasReadyTarget(firstTarget)) {
        setRunAppWalkthrough(true);
        return;
      }

      attempts += 1;
      if (attempts >= 40) {
        setRunAppWalkthrough(true);
        return;
      }

      timer = window.setTimeout(startWhenReady, 50);
    };

    timer = window.setTimeout(startWhenReady, 120);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    appWalkthroughResetToken,
    appWalkthroughSteps,
    closeBlockingPanelsForLearningGoals,
    hasReadyTarget,
  ]);

  React.useEffect(() => {
    if (runAppWalkthrough) return;
    if (showWelcomeTourPrompt) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [showWelcomeTourPrompt, runAppWalkthrough]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (!showWelcomeTourPrompt) {
      hasNarratedWelcomePromptRef.current = false;
      window.speechSynthesis.cancel();
    }
  }, [showWelcomeTourPrompt]);

  React.useEffect(() => {
    if (isWalkthroughNarrationEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [isWalkthroughNarrationEnabled]);

  React.useEffect(() => {
    if (!showWalkthroughCompletionPrompt) return;
    speakWalkthroughCompletionPrompt();
  }, [showWalkthroughCompletionPrompt, speakWalkthroughCompletionPrompt]);

  return (
    <>
      <JoyrideComponent
        key={`${appWalkthroughStream}-${appWalkthroughResetToken}-${showLibraryIntroStep ? 'library-intro' : 'main'}`}
        run={runAppWalkthrough}
        steps={appWalkthroughSteps}
        continuous
        showProgress
        showSkipButton
        disableScrolling
        onEvent={handleAppWalkthroughEvent}
        locale={{
          back: 'Vorige',
          close: 'Sluiten',
          last: 'Klaar',
          next: 'Volgende',
          skip: 'Overslaan',
        }}
        styles={{
          options: {
            primaryColor: '#0ea5e9',
            zIndex: 130,
          },
          beaconInner: {
            backgroundColor: isDarkMode ? '#ffffff' : '#111827',
          },
          beaconOuter: {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(17, 24, 39, 0.28)',
            borderColor: isDarkMode ? '#ffffff' : '#111827',
          },
        } as never}
      />
      {showWelcomeTourPrompt && (
        <WelcomeTourPrompt
          firstName={firstName}
          isWalkthroughNarrationEnabled={isWalkthroughNarrationEnabled}
          onToggleNarration={handleWelcomeNarrationToggle}
          onStart={() => {
            shouldShowFirstTimeCompletionPromptRef.current = true;
            onStartWelcomeTour();
          }}
          onDismiss={() => {
            shouldShowFirstTimeCompletionPromptRef.current = false;
            onDismissWelcomeTourPrompt();
          }}
        />
      )}
      {showWalkthroughCompletionPrompt && (
        <WalkthroughCompletionPrompt
          firstName={firstName}
          onClose={() => {
            setShowWalkthroughCompletionPrompt(false);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }}
        />
      )}
    </>
  );
};

export default AppWalkthrough;
