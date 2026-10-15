import { HistoryEntry } from '../types';
import { useTheme } from '../context/ThemeContext';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

/**
 * Scrollable list of past calculations. Clicking an entry loads its result
 * back into the calculator so it can be reused in a new expression.
 * Explicitly themed so text and hover states stay legible in both modes.
 */
export default function HistoryPanel({ history, onSelect, onClear }: HistoryPanelProps) {
  const theme = useTheme();
  const panelClass = theme === 'dark' ? 'bg-panel-900/50 border-white/10' : 'bg-white border-slate-200';
  const headingClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const emptyClass = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';
  const rowHoverClass = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100';
  const exprClass = theme === 'dark' ? 'text-slate-500 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-500';
  const resultClass = theme === 'dark' ? 'text-phosphor' : 'text-teal-600';
  const clearClass = theme === 'dark' ? 'text-red-300/80 hover:text-red-300' : 'text-red-500/80 hover:text-red-600';

  return (
    <div className={`rounded-2xl border backdrop-blur-md shadow-glass p-4 h-full flex flex-col ${panelClass}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-xs uppercase tracking-widest font-display ${headingClass}`}>History</h3>
        {history.length > 0 && (
          <button type="button" onClick={onClear} className={`text-xs transition-colors ${clearClass}`}>
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {history.length === 0 && (
          <p className={`text-xs italic mt-2 ${emptyClass}`}>Your calculations will appear here.</p>
        )}
        {history.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry)}
            className={`w-full text-right rounded-lg px-2 py-1.5 transition-colors group ${rowHoverClass}`}
          >
            <div className={`text-[11px] font-mono truncate ${exprClass}`}>{entry.expression}</div>
            <div className={`text-sm font-mono truncate ${resultClass}`}>= {entry.result}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
