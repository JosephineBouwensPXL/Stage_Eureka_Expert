import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onClick: () => void;
  className?: string;
  ariaPressed?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onClick,
  className = '',
  ariaPressed,
}) => {
  return (
    <button
      onClick={onClick}
      aria-pressed={ariaPressed ?? checked}
      className={`w-14 h-8 rounded-full relative transition-colors ${checked ? 'bg-studybuddy-blue' : 'bg-slate-200 dark:bg-slate-700'} ${className}`}
    >
      <div
        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  );
};

export default ToggleSwitch;
