import { useEffect, useRef } from 'react';
import GraphCanvas, { GraphCanvasHandle } from './GraphCanvas';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { compileGraphExpression, extractGraphParameters } from '../utils/mathEngine';
import { GraphFunction, GraphViewport } from '../types';

interface GraphingCalculatorProps {
  theme: 'dark' | 'light';
}

const PALETTE = ['#4fe3c1', '#a78bfa', '#ffb454', '#f472b6', '#60a5fa', '#fb7185'];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextColor(existing: GraphFunction[]): string {
  return PALETTE[existing.length % PALETTE.length];
}

const DEFAULT_FUNCTIONS: GraphFunction[] = [
  { id: makeId(), expression: 'sin(x)', color: PALETTE[0], visible: true },
];

/**
 * Graphing Mode: a Desmos-style multi-function plotter. Equations persist
 * across sessions via localStorage, each gets its own color and a live
 * validity check, and the canvas updates in real time as you type.
 */
export default function GraphingCalculator({ theme }: GraphingCalculatorProps) {
  const panelClass = theme === 'dark' ? 'bg-panel-900/50 border-white/10' : 'bg-white border-slate-200';
  const headingClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const addBtnClass = theme === 'dark' ? 'bg-phosphor/15 hover:bg-phosphor/25 text-phosphor' : 'bg-teal-50 hover:bg-teal-100 text-teal-700';
  const rowClass = theme === 'dark' ? 'border-white/5 bg-panel-800/40' : 'border-slate-200 bg-slate-50';
  const rowLabelClass = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';
  const inputClass = theme === 'dark' ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400';
  const removeBtnClass = theme === 'dark' ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500';
  const emptyClass = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';
  const footerClass = theme === 'dark' ? 'border-white/5 text-slate-500' : 'border-slate-200 text-slate-500';
  const exportBtnClass =
    theme === 'dark'
      ? 'bg-panel-800/70 hover:bg-panel-700/80 text-slate-200 border-white/5'
      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200';

  const [functions, setFunctions] = useLocalStorage<GraphFunction[]>('graph-functions', DEFAULT_FUNCTIONS);
  const [viewport, setViewport] = useLocalStorage<GraphViewport>('graph-viewport', {
    centerX: 0,
    centerY: 0,
    scale: 20,
  });
  const [params, setParams] = useLocalStorage<Record<string, number>>('graph-params', {});
  const canvasHandleRef = useRef<GraphCanvasHandle>(null);

  const paramSliderClass = theme === 'dark' ? 'accent-phosphor' : 'accent-teal-500';
  const paramValueClass = theme === 'dark' ? 'text-phosphor-bright' : 'text-teal-700';
  const paramNameClass = theme === 'dark' ? 'text-slate-300' : 'text-slate-700';

  // Any symbol used in an equation that isn't x, y, a constant, or a known
  // function name becomes a user-adjustable slider parameter — any number
  // of them, across any number of equations.
  useEffect(() => {
    const needed = new Set<string>();
    functions.forEach((fn) => extractGraphParameters(fn.expression).forEach((p) => needed.add(p)));
    setParams((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      needed.forEach((name) => {
        next[name] = name in prev ? prev[name] : 1;
        if (!(name in prev)) changed = true;
      });
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(functions.map((f) => f.expression))]);

  // Validate every function whenever its expression changes, so bad input
  // (unbalanced parens, unknown symbols) shows an inline error instead of
  // silently failing or crashing the render loop.
  useEffect(() => {
    setFunctions((prev) =>
      prev.map((fn) => {
        if (!fn.expression.trim()) return { ...fn, error: undefined };
        try {
          // A throw here means the expression itself is malformed (bad syntax,
          // unknown symbol, unbalanced parens). Domain issues at specific
          // points (e.g. sqrt(x) for x<0) are NOT errors — those just produce
          // NaN samples that the canvas renderer skips over when plotting.
          const graphFn = compileGraphExpression(fn.expression, 'rad', params);
          if (graphFn.kind === 'explicit-y') graphFn.evaluate(1);
          else if (graphFn.kind === 'explicit-x') graphFn.evaluate(1);
          else graphFn.evaluate(1, 1);
          return fn.error ? { ...fn, error: undefined } : fn;
        } catch (err) {
          return { ...fn, error: err instanceof Error ? err.message : 'Invalid expression' };
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(functions.map((f) => f.expression)), params]);

  const addFunction = () => {
    setFunctions((prev) => [...prev, { id: makeId(), expression: '', color: nextColor(prev), visible: true }]);
  };

  const updateExpression = (id: string, expression: string) => {
    setFunctions((prev) => prev.map((fn) => (fn.id === id ? { ...fn, expression } : fn)));
  };

  const toggleVisible = (id: string) => {
    setFunctions((prev) => prev.map((fn) => (fn.id === id ? { ...fn, visible: !fn.visible } : fn)));
  };

  const removeFunction = (id: string) => {
    setFunctions((prev) => prev.filter((fn) => fn.id !== id));
  };

  const setParam = (name: string, value: number) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 animate-fade-in h-full">
      {/* Equation list */}
      <div className={`rounded-2xl border backdrop-blur-md shadow-glass p-4 flex flex-col max-h-[70vh] lg:max-h-none ${panelClass}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs uppercase tracking-widest font-display ${headingClass}`}>Functions</h3>
          <button
            type="button"
            onClick={addFunction}
            className={`text-xs rounded-lg px-2.5 py-1 transition-colors ${addBtnClass}`}
          >
            + Add
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {functions.map((fn) => (
            <div key={fn.id} className={`rounded-xl border p-2 ${rowClass}`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleVisible(fn.id)}
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                  style={{ backgroundColor: fn.visible ? fn.color : 'transparent' }}
                  title={fn.visible ? 'Hide' : 'Show'}
                />
                <span className={`font-mono text-sm shrink-0 ${rowLabelClass}`}>ƒ</span>
                <input
                  type="text"
                  value={fn.expression}
                  onChange={(e) => updateExpression(fn.id, e.target.value)}
                  placeholder="x^2 - 1, or y^2 = x^3, or x^2+y^2=25"
                  spellCheck={false}
                  className={`flex-1 min-w-0 bg-transparent font-mono text-sm focus:outline-none ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeFunction(fn.id)}
                  className={`transition-colors text-sm shrink-0 ${removeBtnClass}`}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
              {fn.error && <p className="text-[11px] text-red-400 mt-1 pl-5">{fn.error}</p>}
            </div>
          ))}
          {functions.length === 0 && (
            <p className={`text-xs italic ${emptyClass}`}>Add a function to start plotting.</p>
          )}
        </div>

        {Object.keys(params).length > 0 && (
          <div className={`mt-3 pt-3 border-t space-y-2.5 ${footerClass}`}>
            <h3 className={`text-xs uppercase tracking-widest font-display ${headingClass}`}>Parameters</h3>
            {Object.entries(params).map(([name, value]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`font-mono text-sm w-6 shrink-0 ${paramNameClass}`}>{name}</span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={value}
                  onChange={(e) => setParam(name, parseFloat(e.target.value))}
                  className={`flex-1 min-w-0 ${paramSliderClass}`}
                />
                <span className={`font-mono text-xs w-12 text-right shrink-0 ${paramValueClass}`}>{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        <div className={`mt-3 pt-3 border-t space-y-2 ${footerClass}`}>
          <p className="text-[11px]">
            Type "y = ...", "x = ...", a bare expression (implies y = ...), or a
            full relation like "y^2 = x^3" or "x^2 + y^2 = 25". Supports sin,
            cos, tan, log (base-10), ln, sqrt, cbrt, abs, exp, ^, π, e. Any
            other letter (e.g. "a*sin(x)+b") becomes an adjustable slider above.
          </p>
          <button
            type="button"
            onClick={() => canvasHandleRef.current?.exportPNG()}
            className={`w-full text-xs rounded-lg px-3 py-2 transition-colors border ${exportBtnClass}`}
          >
            Export graph as PNG
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="min-h-[400px] h-[60vh] lg:h-auto">
        <GraphCanvas ref={canvasHandleRef} functions={functions} viewport={viewport} onViewportChange={setViewport} theme={theme} params={params} />
      </div>
    </div>
  );
}
