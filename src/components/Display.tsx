import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTheme } from '../context/ThemeContext';

interface DisplayProps {
  expression: string;
  cursorPos: number;
  onChange: (value: string, cursor: number) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  result: string;
  error: string | null;
}

/**
 * The glass "LCD" readout shared by Basic and Scientific modes. The
 * expression line is a real text input (not a static div) so the caret can
 * sit anywhere in the middle of the expression — that's what makes
 * function buttons able to insert both parentheses at once and land the
 * caret between them, and lets the user freely navigate/edit with arrow
 * keys, Home/End, etc. Below it: the evaluated result (or error) with a
 * one-click copy-to-clipboard button.
 */
export default function Display({ expression, cursorPos, onChange, onKeyDown, result, error }: DisplayProps) {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the DOM input's value/selection in sync with engine state — needed
  // because button clicks update `expression`/`cursorPos` from outside the
  // input itself, so the browser doesn't know to move the caret on its own.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (el.value !== expression) el.value = expression;
    const pos = Math.max(0, Math.min(cursorPos, expression.length));
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    if (el.selectionStart !== pos || el.selectionEnd !== pos) {
      el.setSelectionRange(pos, pos);
    }
  }, [expression, cursorPos]);

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API may be blocked; fail silently rather than crash.
    }
  };

  const panelClass = theme === 'dark' ? 'bg-panel-900/60 border-white/10' : 'bg-white border-slate-200';
  const expressionClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const resultClass = theme === 'dark' ? 'text-slate-50' : 'text-slate-900';
  const errorClass = theme === 'dark' ? 'text-red-400' : 'text-red-600';
  const copyBtnClass =
    theme === 'dark'
      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-phosphor'
      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-teal-600';

  return (
    <div className={`relative rounded-2xl border backdrop-blur-md shadow-glass px-4 py-4 sm:px-6 sm:py-6 mb-4 animate-fade-in ${panelClass}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        defaultValue={expression}
        onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyUp={(e) => onChange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
        onClick={(e) => onChange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete="off"
        placeholder="0"
        className={`w-full bg-transparent text-right font-mono text-sm sm:text-base tracking-wide focus:outline-none ${expressionClass}`}
      />
      <div className="mt-1 flex items-start justify-end gap-2">
        <div
          className={[
            'text-right font-mono font-semibold break-all',
            error ? `${errorClass} text-lg sm:text-xl` : `${resultClass} text-3xl sm:text-4xl`,
          ].join(' ')}
        >
          {error ? error : result || '0'}
        </div>
        {!error && result && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy result"
            className={`mt-1 shrink-0 rounded-lg border px-2 py-1 text-xs transition-colors ${copyBtnClass}`}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
