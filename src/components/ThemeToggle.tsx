interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
}

/**
 * A sliding pill switch for dark/light mode — the knob slides across the
 * track and swaps icon, rather than a plain button. Fully interactive:
 * clickable, keyboard-focusable, and exposes proper switch semantics.
 */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title="Toggle theme"
      onClick={onToggle}
      className={[
        'relative inline-flex items-center shrink-0',
        'w-16 h-8 rounded-full border transition-colors duration-300 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60',
        isDark ? 'bg-panel-800 border-white/10' : 'bg-amber-100 border-amber-300/60',
      ].join(' ')}
    >
      {/* Track icons, dimmed behind the knob */}
      <span className="absolute left-1.5 text-xs select-none opacity-70">🌙</span>
      <span className="absolute right-1.5 text-xs select-none opacity-70">☀️</span>

      {/* Sliding knob */}
      <span
        className={[
          'absolute top-1 w-6 h-6 rounded-full shadow-md transition-transform duration-300 ease-out',
          'flex items-center justify-center text-[11px]',
          isDark ? 'translate-x-1 bg-panel-950 text-phosphor' : 'translate-x-9 bg-white text-amber-500',
        ].join(' ')}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
