import { useLayoutEffect, useRef, useState } from 'react';
import { CalculatorMode } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  mode: CalculatorMode;
  onChange: (mode: CalculatorMode) => void;
}

const TABS: { id: CalculatorMode; label: string; icon: string }[] = [
  { id: 'basic', label: 'Basic', icon: '123' },
  { id: 'scientific', label: 'Scientific', icon: 'ƒx' },
  { id: 'graphing', label: 'Graphing', icon: '⌁' },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Mode switcher. Renders as a left rail on desktop and a bottom tab bar on
 * mobile. An animated highlight slides between tabs (measured against the
 * actual button positions, so it works correctly whether the layout is
 * horizontal or vertical) rather than just recoloring instantly.
 */
export default function Sidebar({ mode, onChange }: SidebarProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<Partial<Record<CalculatorMode, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<Rect | null>(null);

  const measure = () => {
    const container = containerRef.current;
    const btn = btnRefs.current[mode];
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({ top: bRect.top - cRect.top, left: bRect.left - cRect.left, width: bRect.width, height: bRect.height });
  };

  useLayoutEffect(() => {
    measure();
    // Re-measure on resize, since the layout flips between a horizontal tab
    // bar (mobile) and a vertical rail (desktop) at the sm: breakpoint.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const navClass = theme === 'dark' ? 'bg-panel-900/50 border-white/10' : 'bg-white border-slate-200';
  const inactiveClass =
    theme === 'dark' ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900';
  const activeTextClass = theme === 'dark' ? 'text-panel-950 font-semibold' : 'text-white font-semibold';
  const indicatorClass = theme === 'dark' ? 'bg-phosphor shadow-glow' : 'bg-teal-500 shadow-glow';

  return (
    <nav
      ref={containerRef}
      className={`relative flex sm:flex-col gap-2 rounded-2xl border backdrop-blur-md shadow-glass p-2 sm:p-3 sm:w-44 w-full ${navClass}`}
    >
      {indicator && (
        <div
          className={`absolute rounded-xl transition-all duration-300 ease-out ${indicatorClass}`}
          style={{ top: indicator.top, left: indicator.left, width: indicator.width, height: indicator.height }}
        />
      )}
      {TABS.map((tab) => {
        const active = tab.id === mode;
        return (
          <button
            key={tab.id}
            ref={(el) => (btnRefs.current[tab.id] = el)}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'relative z-10 flex-1 sm:flex-none flex sm:flex-row items-center justify-center sm:justify-start gap-2',
              'rounded-xl px-3 py-2.5 transition-colors duration-150 font-display text-sm',
              active ? activeTextClass : inactiveClass,
            ].join(' ')}
          >
            <span className="font-mono text-xs opacity-80">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
