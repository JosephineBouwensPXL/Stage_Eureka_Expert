import React from 'react';

interface SettingsTabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SettingsTabButton: React.FC<SettingsTabButtonProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
        isActive ? 'bg-studybuddy-blue text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  );
};

export default SettingsTabButton;
