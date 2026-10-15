import { useCalculatorEngine } from '../hooks/useCalculatorEngine';
import Display from './Display';
import CalcButton from './CalcButton';
import HistoryPanel from './HistoryPanel';
import { HistoryEntry } from '../types';

interface BasicCalculatorProps {
  history: HistoryEntry[];
  addHistoryEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

/**
 * Basic Mode: the everyday arithmetic calculator — four operations,
 * percentage, decimals, and memory (MC / MR / M+ / M-), laid out on a
 * responsive grid that works equally well with touch or a mouse.
 */
export default function BasicCalculator({ history, addHistoryEntry, clearHistory }: BasicCalculatorProps) {
  const engine = useCalculatorEngine({ history, addHistoryEntry });

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

        {/* Memory row */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <CalcButton size="compact" variant="memory" label="MC" onClick={engine.memoryClear} title="Memory Clear" />
          <CalcButton size="compact" variant="memory" label="MR" onClick={engine.memoryRecall} title="Memory Recall" />
          <CalcButton size="compact" variant="memory" label="M+" onClick={engine.memoryAdd} title="Memory Add" />
          <CalcButton size="compact" variant="memory" label="M-" onClick={engine.memorySubtract} title="Memory Subtract" />
        </div>

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
