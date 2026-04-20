import React from 'react';
import { ClassicSttMode, ClassicTtsMode, ModeAccess } from '../../types';
import SettingsTabButton from './SettingsTabButton';
import ToggleSwitch from './ToggleSwitch';

export type SettingsTab = 'algemeen' | 'audio' | 'leerdoelen';
export type WalkthroughStream =
  | 'volledig'
  | 'volledig-na-bibliotheek'
  | 'bibliotheek'
  | 'chat'
  | 'voice'
  | 'leerdoelen';

interface SettingsModalProps {
  isOpen: boolean;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  engineMode: ModeAccess;
  classicSttMode: ClassicSttMode;
  onClassicSttModeChange: (mode: ClassicSttMode) => void;
  isClassicTtsEnabled: boolean;
  onToggleClassicTts: () => void;
  classicTtsMode: ClassicTtsMode;
  onClassicTtsModeChange: (mode: ClassicTtsMode) => void;
  isNativeTtsEnabled: boolean;
  onToggleNativeTts: () => void;
  isLearningGoalsQuestioningEnabled: boolean;
  onToggleLearningGoalsQuestioning: () => void;
  isLearningGoalAiEnabled: boolean;
  onToggleLearningGoalAi: () => void;
  learningGoalStarters: string[];
  onAddLearningGoalStarter: () => void;
  onSetLearningGoalStarter: (index: number, value: string) => void;
  onRemoveLearningGoalStarter: (index: number) => void;
  isLearningGoalTableExtractionEnabled: boolean;
  onToggleLearningGoalTableExtraction: () => void;
  learningGoalTableColumnIndex: number;
  onSetLearningGoalTableColumnIndex: (value: number) => void;
  onRestartWalkthrough: (stream: WalkthroughStream) => void;
  onLogout: () => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settingsTab,
  onSettingsTabChange,
  isDarkMode,
  onToggleDarkMode,
  engineMode,
  classicSttMode,
  onClassicSttModeChange,
  isClassicTtsEnabled,
  onToggleClassicTts,
  classicTtsMode,
  onClassicTtsModeChange,
  isNativeTtsEnabled,
  onToggleNativeTts,
  isLearningGoalsQuestioningEnabled,
  onToggleLearningGoalsQuestioning,
  isLearningGoalAiEnabled,
  onToggleLearningGoalAi,
  learningGoalStarters,
  onAddLearningGoalStarter,
  onSetLearningGoalStarter,
  onRemoveLearningGoalStarter,
  isLearningGoalTableExtractionEnabled,
  onToggleLearningGoalTableExtraction,
  learningGoalTableColumnIndex,
  onSetLearningGoalTableColumnIndex,
  onRestartWalkthrough,
  onLogout,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-700 p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-studybuddy-dark dark:text-white">Instellingen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <SettingsTabButton
            label="Algemeen"
            isActive={settingsTab === 'algemeen'}
            onClick={() => onSettingsTabChange('algemeen')}
          />
          <SettingsTabButton
            label="Audio"
            isActive={settingsTab === 'audio'}
            onClick={() => onSettingsTabChange('audio')}
          />
          <div className="walkthrough-settings-leerdoelen-tab">
            <SettingsTabButton
              label="Leerdoelen"
              isActive={settingsTab === 'leerdoelen'}
              onClick={() => onSettingsTabChange('leerdoelen')}
            />
          </div>
        </div>

        <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
          {settingsTab === 'algemeen' && (
            <>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-studybuddy-yellow' : 'bg-studybuddy-blue text-white'}`}
                  >
                    <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'} text-xl`}></i>
                  </div>
                  <span className="font-bold text-studybuddy-dark dark:text-white">
                    Donkere Modus
                  </span>
                </div>
                <ToggleSwitch
                  checked={isDarkMode}
                  onClick={onToggleDarkMode}
                  className={!isDarkMode ? 'bg-slate-200' : ''}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-studybuddy-magenta/15 text-studybuddy-magenta flex items-center justify-center">
                    <i className="fa-solid fa-route text-lg"></i>
                  </div>
                  <div>
                    <p className="font-bold text-studybuddy-dark dark:text-white">Rondleidingen</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Kies welk onderdeel je opnieuw uitgelegd wilt krijgen.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => onRestartWalkthrough('volledig')}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-studybuddy-blue transition-all text-left"
                  >
                    Volledige app
                  </button>
                  <button
                    onClick={() => onRestartWalkthrough('bibliotheek')}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-studybuddy-blue transition-all text-left"
                  >
                    Bibliotheek
                  </button>
                  <button
                    onClick={() => onRestartWalkthrough('chat')}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-studybuddy-blue transition-all text-left"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => onRestartWalkthrough('voice')}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-studybuddy-blue transition-all text-left"
                  >
                    Voice
                  </button>
                  <button
                    onClick={() => onRestartWalkthrough('leerdoelen')}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:border-studybuddy-blue transition-all text-left"
                  >
                    Leerdoelen
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Tip: kies "Volledige app" voor een complete rondleiding met chat en voice.
                </p>
              </div>
            </>
          )}

          {settingsTab === 'audio' && engineMode === ModeAccess.CLASSIC && (
            <>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-studybuddy-dark dark:text-white">
                    Microfoon
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Invoer
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onClassicSttModeChange('local')}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      classicSttMode === 'local'
                        ? 'bg-studybuddy-blue text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Local
                  </button>
                  <button
                    onClick={() => onClassicSttModeChange('browser')}
                    className={`py-2 rounded-xl font-bold transition-all ${
                      classicSttMode === 'browser'
                        ? 'bg-studybuddy-blue text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Browser
                  </button>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-studybuddy-dark dark:text-white">
                    Geluid
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Uitvoer
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {isClassicTtsEnabled ? 'Geluid aan' : 'Geluid uit'}
                  </span>
                  <ToggleSwitch checked={isClassicTtsEnabled} onClick={onToggleClassicTts} />
                </div>
              </div>
              {isClassicTtsEnabled && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-studybuddy-dark dark:text-white">
                      Geluid bron
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Stem
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onClassicTtsModeChange('local')}
                      className={`py-2 rounded-xl font-bold transition-all ${
                        classicTtsMode === 'local'
                          ? 'bg-studybuddy-blue text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Local
                    </button>
                    <button
                      onClick={() => onClassicTtsModeChange('browser')}
                      className={`py-2 rounded-xl font-bold transition-all ${
                        classicTtsMode === 'browser'
                          ? 'bg-studybuddy-blue text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Browser
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {settingsTab === 'audio' && engineMode === ModeAccess.NATIVE && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-studybuddy-dark dark:text-white">Geluid</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Uitvoer
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {isNativeTtsEnabled ? 'Geluid aan' : 'Geluid uit'}
                </span>
                <ToggleSwitch checked={isNativeTtsEnabled} onClick={onToggleNativeTts} />
              </div>
            </div>
          )}

          {settingsTab === 'leerdoelen' && (
            <>
              <div className="walkthrough-settings-leerdoelen-paneel p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-studybuddy-dark dark:text-white">
                    Leerdoel-ondervraging
                  </span>
                  <ToggleSwitch
                    checked={isLearningGoalsQuestioningEnabled}
                    onClick={onToggleLearningGoalsQuestioning}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isLearningGoalsQuestioningEnabled
                    ? 'Leerdoelen worden gebruikt in de ondervraging.'
                    : 'Leerdoelen worden niet gebruikt in de ondervraging.'}
                </p>
              </div>
              {isLearningGoalsQuestioningEnabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-studybuddy-dark dark:text-white">
                          AI-beoordeling
                        </span>
                        <ToggleSwitch
                          checked={isLearningGoalAiEnabled}
                          onClick={onToggleLearningGoalAi}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isLearningGoalAiEnabled
                          ? 'AI-beoordeling staat aan.'
                          : 'AI-beoordeling staat uit.'}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-studybuddy-dark dark:text-white">
                          Tabel extractie
                        </span>
                        <ToggleSwitch
                          checked={isLearningGoalTableExtractionEnabled}
                          onClick={onToggleLearningGoalTableExtraction}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isLearningGoalTableExtractionEnabled
                          ? 'Leerdoelen worden ook uit tabellen gehaald.'
                          : 'Tabel extractie staat uit.'}
                      </p>
                      {isLearningGoalTableExtractionEnabled && (
                        <div className="mt-3">
                          <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                            Kolomnummer met leerdoel
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={learningGoalTableColumnIndex}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              if (!Number.isFinite(next)) return;
                              onSetLearningGoalTableColumnIndex(Math.max(1, Math.floor(next)));
                            }}
                            className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-studybuddy-blue/20"
                          />
                          <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Voorbeeld: zet op 2 als het leerdoel in de tweede kolom staat.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-studybuddy-dark dark:text-white">
                          Leerdoel-voorzetsels
                        </span>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Startwoorden die we herkennen als leerdoel.
                        </p>
                      </div>
                      <button
                        onClick={onAddLearningGoalStarter}
                        className="w-8 h-8 rounded-lg bg-studybuddy-blue text-white hover:bg-blue-600 transition-colors"
                        title="Voorzetsel toevoegen"
                      >
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {learningGoalStarters.map((starter, index) => (
                        <div key={`starter-${index}`} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={starter}
                            onChange={(e) => onSetLearningGoalStarter(index, e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-studybuddy-blue/20"
                            placeholder="Bijv. Ik of -"
                          />
                          <button
                            onClick={() => onRemoveLearningGoalStarter(index)}
                            disabled={learningGoalStarters.length <= 1}
                            className={`w-9 h-9 rounded-xl transition-colors ${
                              learningGoalStarters.length <= 1
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-red-50 text-red-500 hover:bg-red-100'
                            }`}
                            title="Verwijderen"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <button
            onClick={onLogout}
            className="w-full py-4 bg-slate-100 dark:bg-slate-900 hover:bg-red-50 text-slate-600 rounded-2xl font-black transition-all flex items-center justify-center space-x-2"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Uitloggen</span>
          </button>
          <button
            onClick={onClose}
            className="w-full mt-4 py-4 bg-studybuddy-magenta text-white rounded-2xl font-black shadow-lg"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
