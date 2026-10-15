import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import BasicCalculator from './components/BasicCalculator';
import ScientificCalculator from './components/ScientificCalculator';
import GraphingCalculator from './components/GraphingCalculator';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ThemeContext } from './context/ThemeContext';
import { CalculatorMode, HistoryEntry } from './types';

const MODE_TITLES: Record<CalculatorMode, string> = {
  basic: 'Basic Calculator',
  scientific: 'Scientific Calculator',
  graphing: 'Graphing Calculator',
};

export default function App() {
  const [mode, setMode] = useLocalStorage<CalculatorMode>('calc-mode', 'basic');
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('calc-theme', 'dark');
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>('calc-history', []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const addHistoryEntry = (entry: HistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, 100));
  };
  const clearHistory = () => setHistory([]);

  return (
    <ThemeContext.Provider value={theme}>
      <div className="min-h-screen w-full bg-panel-950 text-slate-100 relative overflow-x-hidden">
        {/* Ambient background glow — purely decorative, sits behind the glass panels */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 w-96 h-96 bg-phosphor/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-32 -right-24 w-96 h-96 bg-violet-signal/10 blur-[120px] rounded-full" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-6 sm:py-10">
          <header className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
                🧮 MathForge
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{MODE_TITLES[mode]}</p>
            </div>
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </header>

          <div className="flex flex-col sm:flex-row gap-4">
            <Sidebar mode={mode} onChange={setMode} />

            <main className="flex-1 min-w-0">
              {mode === 'basic' && (
                <BasicCalculator history={history} addHistoryEntry={addHistoryEntry} clearHistory={clearHistory} />
              )}
              {mode === 'scientific' && (
                <ScientificCalculator history={history} addHistoryEntry={addHistoryEntry} clearHistory={clearHistory} />
              )}
              {mode === 'graphing' && <GraphingCalculator theme={theme} />}
            </main>
          </div>

          <footer className="mt-8 text-center text-[11px] text-slate-600 font-mono">
            A <span className="font-bold text-phosphor drop-shadow-[0_0_6px_rgba(12, 194, 222, 0.75)]">RAJDIP DHAR</span> PROJECT
          </footer>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
