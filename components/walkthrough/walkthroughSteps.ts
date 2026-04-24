import { type Step } from 'react-joyride';
import { type WalkthroughStream } from '../settings/SettingsModal';

type WalkthroughStepsOptions = {
  appWalkthroughStream: WalkthroughStream;
  showLibraryIntroStep: boolean;
  isLearningGoalsUploadPending: boolean;
  hasLearningGoalsSidebar: boolean;
};

const chatWalkthroughSteps = [
  {
    target: '.walkthrough-chat-input',
    title: 'Chat invoer',
    content: 'Typ hier je vraag over je lesstof.',
    disableBeacon: true,
  },
  {
    target: '.walkthrough-chat-voice',
    title: 'Chat Via Voice',
    content:
      'Met dit microfoontje spreek je je vraag in voor de chat. Handig als je liever praat dan typt.',
  },
  {
    target: '.walkthrough-send-chat',
    title: 'Bericht versturen',
    content: 'Klik op verzenden of druk op Enter.',
  },
] as unknown as Step[];

const voiceWalkthroughSteps = [
  {
    target: '.walkthrough-start-voice',
    title: 'Voice starten',
    content:
      'Klik hier om een volledige voice-interactie te starten: jij spreekt, StudyBuddy antwoordt.',
    disableBeacon: true,
  },
  {
    target: '.walkthrough-open-settings',
    title: 'Voice instellingen',
    content: 'Via Instellingen > Audio kun je microfoon en geluid aanpassen aan je voorkeur.',
  },
] as unknown as Step[];

const libraryIntroSteps = [
  {
    target: '.walkthrough-open-library',
    title: 'Bibliotheek',
    content:
      'Klik op deze knop om je bibliotheek te openen. Daarna leggen we de uploadzone stap voor stap uit.',
    disableBeacon: true,
  },
] as unknown as Step[];

const settingsWalkthroughSteps = [
  {
    target: '.walkthrough-settings-modal',
    title: 'Instellingen',
    content:
      'Hier beheer je de voorkeuren van StudyBuddy, zoals thema, audio, rondleidingen en leerdoelen.',
    disableBeacon: true,
    placement: 'left',
  },
  {
    target: '.walkthrough-settings-tabs',
    title: 'Tabs',
    content:
      'Gebruik deze tabs om snel te wisselen tussen algemene instellingen, audio en leerdoelen.',
    placement: 'left',
  },
  {
    target: '.walkthrough-settings-darkmode',
    title: 'Donkere Modus',
    content:
      'Hier zet je StudyBuddy in lichte of donkere modus. Kies wat voor jou het rustigst leest.',
  },
  {
    target: '.walkthrough-settings-tour-list',
    title: 'Rondleidingen',
    content:
      'Hier kun je later elke korte rondleiding opnieuw starten wanneer je iets nog eens wilt bekijken.',
  },
  {
    target: '.walkthrough-settings-audio-tab',
    title: 'Audio',
    content: 'We gaan nu naar Audio. Daar stel je microfoon en geluid in voor chat en voice.',
  },
  {
    target: '.walkthrough-settings-audio-panel',
    title: 'Audio Instellingen',
    content:
      'Hier kies je hoe StudyBuddy luistert en antwoordt. Je kunt geluid aan- of uitzetten en de stembron aanpassen.',
  },
  {
    target: '.walkthrough-settings-leerdoelen-tab',
    title: 'Leerdoelen',
    content: 'We gaan nu naar Leerdoelen. Daar beheer je hoe StudyBuddy met leerdoelen werkt.',
  },
  {
    target: '.walkthrough-settings-leerdoelen-paneel',
    title: 'Leerdoelen Instellingen',
    content:
      'Hier zet je leerdoel-ondervraging aan of uit. Als dit aan staat, kan StudyBuddy je gerichter ondervragen op basis van je leerdoelen.',
  },
  {
    target: '.walkthrough-settings-learning-goals-ai',
    title: 'AI-beoordeling',
    content:
      'Met AI-beoordeling kan StudyBuddy voorstellen hoe goed een antwoord bij een leerdoel past. Jij kunt de beoordeling daarna nog aanpassen.',
  },
  {
    target: '.walkthrough-settings-learning-goals-table',
    title: 'Tabel Extractie',
    content:
      'Als je leerdoelen in een tabel staan, kan StudyBuddy ze ook daaruit proberen te halen. Geef eventueel aan in welke kolom de leerdoelen staan.',
  },
  {
    target: '.walkthrough-settings-learning-goals-starters',
    title: 'Voorvoegsels',
    content:
      'Hier beheer je startwoorden of tekens waaraan StudyBuddy leerdoelen herkent, bijvoorbeeld zinnen die beginnen met "Ik kan".',
  },
] as unknown as Step[];

const learningGoalsWalkthroughSteps = [
  {
    target: '.walkthrough-learning-goals-panel',
    title: 'Leerdoelenpaneel',
    content:
      'Hier zie je alle leerdoelen als je klikt op de vierkantjes kun je ze rood, blauw of groen beoordelen beoordelen.',
    disableBeacon: true,
    placement: 'left',
  },
  {
    target: '.walkthrough-learning-goals-add',
    title: 'Leerdoel Toevoegen',
    content: 'Voeg hier handmatig een leerdoel toe als het nog niet automatisch gevonden is.',
  },
  {
    target: '.walkthrough-learning-goals-toggle',
    title: 'Activeren Of Uitschakelen',
    content: 'Via dit nummer kun je een leerdoel tijdelijk uitschakelen of opnieuw activeren.',
  },
  {
    target: '.walkthrough-learning-goals-table',
    title: 'Voortgang',
    content:
      'Hier zie je je beoordeling per leerdoel. Bij uitgeschakelde doelen verschijnt rechts een vuilbakje om te verwijderen.',
  },
] as unknown as Step[];

const getLearningGoalsOverviewSteps = (hasLearningGoalsSidebar: boolean): Step[] =>
  hasLearningGoalsSidebar
    ? [
        {
          target: '.walkthrough-learning-goals-panel',
          title: 'Leerdoelenpaneel',
          content:
            'Hier zie je herkende leerdoelen en je voortgang per doel. Dit helpt gericht oefenen.',
          placement: 'left',
        },
        {
          target: '.walkthrough-learning-goals-rating',
          title: 'Beoordeel Jezelf',
          content:
            'Kleur de vakjes rood, blauw of groen om voor jezelf aan te geven hoe goed je elk leerdoel al beheerst.',
          placement: 'left',
        },
        {
          target: '.walkthrough-learning-goals-add',
          title: 'Leerdoel Toevoegen',
          content:
            'Via deze knop voeg je zelf een extra leerdoel toe als het nog niet automatisch herkend werd.',
          placement: 'left',
        },
      ] as unknown as Step[]
    : [];

export const getAppWalkthroughSteps = ({
  appWalkthroughStream,
  showLibraryIntroStep,
  isLearningGoalsUploadPending,
  hasLearningGoalsSidebar,
}: WalkthroughStepsOptions): Step[] => {
  if (
    showLibraryIntroStep &&
    (
      appWalkthroughStream === 'volledig' ||
      appWalkthroughStream === 'bibliotheek' ||
      appWalkthroughStream === 'leerdoelen'
    )
  ) {
    return libraryIntroSteps;
  }

  if (appWalkthroughStream === 'leerdoelen' && isLearningGoalsUploadPending) {
    return [];
  }

  if (appWalkthroughStream === 'volledig') {
    return [
      ...chatWalkthroughSteps.map((step) =>
        step.target === '.walkthrough-chat-input'
          ? {
              ...step,
              title: 'Chatten',
              content: 'Typ hier je vraag. Je kunt chat gebruiken met of zonder voice.',
            }
          : step
      ),
      ...voiceWalkthroughSteps,
      ...getLearningGoalsOverviewSteps(hasLearningGoalsSidebar),
      {
        target: '.walkthrough-open-settings',
        title: 'Instellingen',
        content: 'Hier pas je microfoon, geluid, leerdoelen en rondleidingen per onderdeel aan.',
      },
    ];
  }

  if (appWalkthroughStream === 'chat') {
    return chatWalkthroughSteps;
  }

  if (appWalkthroughStream === 'voice') {
    return voiceWalkthroughSteps;
  }

  if (appWalkthroughStream === 'instellingen') {
    return settingsWalkthroughSteps;
  }

  if (appWalkthroughStream === 'leerdoelen') {
    return learningGoalsWalkthroughSteps;
  }

  return [];
};
