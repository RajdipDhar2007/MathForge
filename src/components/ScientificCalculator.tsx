import { useState } from 'react';
import { useCalculatorEngine } from '../hooks/useCalculatorEngine';
import Display from './Display';
import CalcButton from './CalcButton';
import HistoryPanel from './HistoryPanel';
import CalculusPanel from './CalculusPanel';
import { useTheme } from '../context/ThemeContext';
import { HistoryEntry } from '../types';

interface ScientificCalculatorProps {
  history: HistoryEntry[];
  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

/**
 * Scientific Mode: adds trigonometry (with a Deg/Rad toggle), logarithms,
 * powers/roots, factorial, absolute value, constants, and parentheses on
 * top of the basic arithmetic keypad, all backed by the same live
 * expression-parsing engine. Function keys (sin, cos, sqrt, ...) insert
 * both parentheses at once with the caret placed between them. A Calculus
 * panel (derivatives, integrals, signum solving) can be toggled on below the keypad.
 */
export default function ScientificCalculator({ history, addHistoryEntry, clearHistory }: ScientificCalculatorProps) {
  const engine = useCalculatorEngine({ history, addHistoryEntry });
  const theme = useTheme();
  const [showCalculus, setShowCalculus] = useState(false);

  const inactiveToggleClass =
    theme === 'dark' ? 'bg-panel-800/50 text-slate-400' : 'bg-slate-100 text-slate-500';
  const activeToggleClass =
    theme === 'dark' ? 'bg-phosphor text-panel-950 font-semibold' : 'bg-teal-500 text-white font-semibold';
  const calcToggleClass = showCalculus
    ? activeToggleClass
    : theme === 'dark'
    ? 'bg-violet-signal/15 text-violet-signal hover:bg-violet-signal/25'
    : 'bg-violet-50 text-violet-700 hover:bg-violet-100';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 animate-fade-in">
      <div>
        <Display
          expression={engine.expression}
          cursorPos={engine.cursorPos}
          onChange={engine.setExpressionAndCursor}
          onKeyDown={engine.handleDisplayKeyDown}
          result={engine.liveResult.formatted}
          error={engine.liveResult.error}
        />

        <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => engine.setAngleUnit('deg')}
              className={`px-3 py-1.5 transition-colors ${engine.angleUnit === 'deg' ? activeToggleClass : inactiveToggleClass}`}
            >
              DEG
            </button>
            <button
              type="button"
              onClick={() => engine.setAngleUnit('rad')}
              className={`px-3 py-1.5 transition-colors ${engine.angleUnit === 'rad' ? activeToggleClass : inactiveToggleClass}`}
            >
              RAD
            </button>
          </div>
          <div className="flex gap-2">
            <CalcButton size="compact" variant="memory" label="MC" onClick={engine.memoryClear} span={1} title="Memory Clear" />
            <CalcButton size="compact" variant="memory" label="MR" onClick={engine.memoryRecall} span={1} title="Memory Recall" />
            <CalcButton size="compact" variant="memory" label="M+" onClick={engine.memoryAdd} span={1} title="Memory Add" />
            <CalcButton size="compact" variant="memory" label="M-" onClick={engine.memorySubtract} span={1} title="Memory Subtract" />
          </div>
          <button
            type="button"
            onClick={() => setShowCalculus((v) => !v)}
            className={`text-xs font-mono rounded-lg px-3 py-1.5 transition-colors ${calcToggleClass}`}
            title="Derivatives, integrals, signum function"
          >
            ∫ Calculus
          </button>
        </div>

        {showCalculus && <CalculusPanel />}

        {/* Scientific function row — function keys auto-insert both
            parentheses with the caret placed between them. */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          <CalcButton variant="function" label="sin" onClick={() => engine.insertFunction('sin')} />
          <CalcButton variant="function" label="cos" onClick={() => engine.insertFunction('cos')} />
          <CalcButton variant="function" label="tan" onClick={() => engine.insertFunction('tan')} />
          <CalcButton variant="function" label="(" onClick={() => engine.input('(')} title="Open bracket (manual grouping)" />
          <CalcButton variant="function" label=")" onClick={() => engine.input(')')} title="Close bracket (manual grouping)" />

          <CalcButton variant="function" label="asin" onClick={() => engine.insertFunction('asin')} />
          <CalcButton variant="function" label="acos" onClick={() => engine.insertFunction('acos')} />
          <CalcButton variant="function" label="atan" onClick={() => engine.insertFunction('atan')} />
          <CalcButton variant="function" label="π" onClick={() => engine.input('pi')} />
          <CalcButton variant="function" label="e" onClick={() => engine.input('e')} title="Euler's number" />

          <CalcButton variant="function" label="log" onClick={() => engine.insertFunction('log')} title="Base-10 log" />
          <CalcButton variant="function" label="ln" onClick={() => engine.insertFunction('ln')} title="Natural log" />
          <CalcButton variant="function" label="x²" onClick={() => engine.input('^2')} />
          <CalcButton variant="function" label="x³" onClick={() => engine.input('^3')} />
          <CalcButton variant="function" label="xʸ" onClick={() => engine.input('^')} title="Power" />

          <CalcButton variant="function" label="√" onClick={() => engine.insertFunction('sqrt')} />
          <CalcButton variant="function" label="∛" onClick={() => engine.insertFunction('cbrt')} />
          <CalcButton variant="function" label="ⁿ√" onClick={() => engine.insertRaw('nthRoot(,)', 8)} title="nth root — nthRoot(value, n)" />
          <CalcButton variant="function" label="x!" onClick={() => engine.input('!')} title="Factorial" />
          <CalcButton variant="function" label="|x|" onClick={() => engine.insertFunction('abs')} />
        </div>

        {/* Standard keypad */}
        <div className="grid grid-cols-4 gap-2">
          <CalcButton variant="danger" label="C" onClick={engine.clear} title="Clear" />
          <CalcButton variant="function" label="⌫" onClick={engine.backspace} title="Backspace" />
          <CalcButton variant="function" label="%" onClick={engine.percent} title="Percent" />
          <CalcButton variant="operator" label="÷" onClick={() => engine.input('/')} />

          <CalcButton label="7" onClick={() => engine.input('7')} />
          <CalcButton label="8" onClick={() => engine.input('8')} />
          <CalcButton label="9" onClick={() => engine.input('9')} />
          <CalcButton variant="operator" label="×" onClick={() => engine.input('*')} />

          <CalcButton label="4" onClick={() => engine.input('4')} />
          <CalcButton label="5" onClick={() => engine.input('5')} />
          <CalcButton label="6" onClick={() => engine.input('6')} />
          <CalcButton variant="operator" label="−" onClick={() => engine.input('-')} />

          <CalcButton label="1" onClick={() => engine.input('1')} />
          <CalcButton label="2" onClick={() => engine.input('2')} />
          <CalcButton label="3" onClick={() => engine.input('3')} />
          <CalcButton variant="operator" label="+" onClick={() => engine.input('+')} />

          <CalcButton variant="function" label="±" onClick={engine.toggleSign} title="Toggle sign" />
          <CalcButton label="0" onClick={() => engine.input('0')} />
          <CalcButton label="." onClick={() => engine.input('.')} />
          <CalcButton variant="accent" label="=" onClick={engine.evaluate} title="Evaluate" />
        </div>
      </div>

      <div className="hidden lg:block">
        <HistoryPanel history={history} onSelect={engine.loadFromHistory} onClear={clearHistory} />
      </div>
    </div>
  );
}
