import { ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';

export type ButtonVariant = 'digit' | 'operator' | 'function' | 'accent' | 'danger' | 'memory';
export type ButtonSize = 'normal' | 'compact';

interface CalcButtonProps {
  label: ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  span?: 1 | 2;
  size?: ButtonSize;
  title?: string;
  disabled?: boolean;
}

// Explicit per-theme color classes for every variant. Defined directly here
// (rather than relying on a global CSS override of Tailwind's opacity-slash
// utility classes) so every key stays legible in both themes with no risk
// of a selector/specificity mismatch making a button unreadable.
const VARIANT_CLASSES: Record<'dark' | 'light', Record<ButtonVariant, string>> = {
  dark: {
    digit: 'bg-panel-800/70 hover:bg-panel-700/80 text-slate-100 border-white/5',
    operator: 'bg-phosphor/15 hover:bg-phosphor/25 text-phosphor-bright border-white/5',
    function: 'bg-panel-800/40 hover:bg-panel-700/60 text-violet-signal border-white/5',
    accent: 'bg-phosphor text-panel-950 hover:bg-phosphor-bright font-semibold border-white/5',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border-white/5',
    memory: 'bg-amber-signal/10 hover:bg-amber-signal/20 text-amber-signal border-white/5',
  },
  light: {
    digit: 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200',
    operator: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200',
    function: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200',
    accent: 'bg-teal-500 hover:bg-teal-600 text-white font-semibold border-teal-500',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200',
    memory: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
  },
};

// "normal" matches the main keypad; "compact" is shorter and smaller-type —
// used for the MC / MR / M+ / M- row so it reads as a secondary row.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  normal: 'h-12 sm:h-14 text-sm sm:text-base',
  compact: 'h-8 sm:h-9 text-[11px] sm:text-xs px-3',
};

/**
 * A single calculator key. Shared by Basic and Scientific modes so both
 * keypads look and behave consistently. Reads the active theme from
 * context so colors stay correct in both dark and light mode.
 */
export default function CalcButton({
  label,
  onClick,
  variant = 'digit',
  span = 1,
  size = 'normal',
  title,
  disabled = false,
}: CalcButtonProps) {
  const theme = useTheme();

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'select-none rounded-xl border backdrop-blur-xs',
        'flex items-center justify-center',
        'font-mono transition-colors duration-100',
        'active:animate-pop disabled:opacity-30 disabled:cursor-not-allowed',
        SIZE_CLASSES[size],
        span === 2 ? 'col-span-2' : 'col-span-1',
        VARIANT_CLASSES[theme][variant],
      ].join(' ')}
    >
      {label}
    </button>
  );
}
