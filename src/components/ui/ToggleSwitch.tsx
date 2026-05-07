interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: ToggleSwitchProps) {
  const trackColor = checked ? 'bg-primary' : 'bg-secondary';
  const thumbPosition = checked ? 'translate-x-6' : 'translate-x-1';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${trackColor} ${disabledClass}`}
    >
      <span
        className={`inline-block size-4 transform rounded-full bg-white transition-transform ${thumbPosition}`}
      />
    </button>
  );
}
