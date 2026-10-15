import { useState, type ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';
import { differentiate, definiteIntegral, indefiniteIntegral, solveSignum, evaluateExpression } from '../utils/mathEngine';

type CalcTab = 'derivative' | 'definite' | 'indefinite' | 'signum';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'derivative', label: 'd/dx' },
  { id: 'definite', label: '∫ Definite' },
  { id: 'indefinite', label: '∫ Indefinite' },
  { id: 'signum', label: 'Signum' },
];

/**
 * Calculus tools: symbolic differentiation of any order, numeric definite
 * integration with user-supplied limits, a scoped term-by-term symbolic
 * indefinite integrator, and an exact solver for ∫ sign(f(x)) dx between
 * user-supplied limits. Everything here operates in radians, independent
 * of the Deg/Rad toggle, since that's the only convention under which the
 * standard derivative/integral identities hold.
 */
export default function CalculusPanel() {
  const theme = useTheme();
  const [tab, setTab] = useState<CalcTab>('derivative');

  const panelClass = theme === 'dark' ? 'bg-panel-900/50 border-white/10' : 'bg-white border-slate-200';
  const tabActiveClass = theme === 'dark' ? 'bg-violet-signal text-panel-950 font-semibold' : 'bg-violet-600 text-white font-semibold';
  const tabInactiveClass = theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100';
  const labelClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const inputClass =
    theme === 'dark'
      ? 'bg-panel-800/60 border-white/10 text-slate-100 placeholder:text-slate-600'
      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400';
  const btnClass = theme === 'dark' ? 'bg-phosphor text-panel-950 hover:bg-phosphor-bright' : 'bg-teal-500 text-white hover:bg-teal-600';
  const resultClass = theme === 'dark' ? 'bg-panel-800/40 border-white/5 text-phosphor-bright' : 'bg-teal-50 border-teal-100 text-teal-700';
  const errorClass = theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-100 text-red-600';
  const noteClass = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`rounded-2xl border backdrop-blur-md shadow-glass p-3 mb-2 animate-fade-in ${panelClass}`}>
      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs font-mono rounded-lg px-2.5 py-1.5 transition-colors ${tab === t.id ? tabActiveClass : tabInactiveClass}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'derivative' && (
        <DerivativeForm labelClass={labelClass} inputClass={inputClass} btnClass={btnClass} resultClass={resultClass} errorClass={errorClass} noteClass={noteClass} />
      )}
      {tab === 'definite' && (
        <DefiniteForm labelClass={labelClass} inputClass={inputClass} btnClass={btnClass} resultClass={resultClass} errorClass={errorClass} noteClass={noteClass} />
      )}
      {tab === 'indefinite' && (
        <IndefiniteForm labelClass={labelClass} inputClass={inputClass} btnClass={btnClass} resultClass={resultClass} errorClass={errorClass} noteClass={noteClass} />
      )}
      {tab === 'signum' && (
        <SignumForm labelClass={labelClass} inputClass={inputClass} btnClass={btnClass} resultClass={resultClass} errorClass={errorClass} noteClass={noteClass} />
      )}
    </div>
  );
}

interface FormClasses {
  labelClass: string;
  inputClass: string;
  btnClass: string;
  resultClass: string;
  errorClass: string;
  noteClass: string;
}

function Field({ label, labelClass, children }: { label: string; labelClass: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-[11px] font-mono uppercase tracking-wide ${labelClass}`}>{label}</span>
      {children}
    </label>
  );
}

function DerivativeForm({ labelClass, inputClass, btnClass, resultClass, errorClass, noteClass }: FormClasses) {
  const [expr, setExpr] = useState('x^3 + sin(x)');
  const [order, setOrder] = useState('1');
  const [output, setOutput] = useState<{ result: string | null; error: string | null } | null>(null);

  const run = () => {
    const n = parseInt(order, 10) || 1;
    setOutput(differentiate(expr, n));
  };

  return (
    <div className="space-y-2">
      <Field label="f(x)" labelClass={labelClass}>
        <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm focus:outline-none ${inputClass}`} />
      </Field>
      <Field label="Order" labelClass={labelClass}>
        <input
          type="number"
          min={1}
          step={1}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm w-24 focus:outline-none ${inputClass}`}
        />
      </Field>
      <button type="button" onClick={run} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${btnClass}`}>
        Differentiate
      </button>
      {output?.error && <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${errorClass}`}>{output.error}</div>}
      {output?.result && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-mono break-all ${resultClass}`}>d{order === '1' ? '' : `^${order}`}/dx = {output.result}</div>
      )}
      <p className={`text-[11px] ${noteClass}`}>Symbolic differentiation, any order, in radians.</p>
    </div>
  );
}

function DefiniteForm({ labelClass, inputClass, btnClass, resultClass, errorClass, noteClass }: FormClasses) {
  const [expr, setExpr] = useState('sin(x)');
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('pi');
  const [output, setOutput] = useState<{ value: number | null; error: string | null; formatted: string } | null>(null);

  const run = () => {
    const a = evaluateExpression(lower, 'rad');
    const b = evaluateExpression(upper, 'rad');
    if (a.value === null) { setOutput({ value: null, error: 'Invalid lower limit', formatted: '' }); return; }
    if (b.value === null) { setOutput({ value: null, error: 'Invalid upper limit', formatted: '' }); return; }
    setOutput(definiteIntegral(expr, a.value, b.value));
  };

  return (
    <div className="space-y-2">
      <Field label="f(x)" labelClass={labelClass}>
        <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm focus:outline-none ${inputClass}`} />
      </Field>
      <div className="flex gap-2">
        <Field label="Lower limit" labelClass={labelClass}>
          <input value={lower} onChange={(e) => setLower(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm w-28 focus:outline-none ${inputClass}`} />
        </Field>
        <Field label="Upper limit" labelClass={labelClass}>
          <input value={upper} onChange={(e) => setUpper(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm w-28 focus:outline-none ${inputClass}`} />
        </Field>
      </div>
      <button type="button" onClick={run} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${btnClass}`}>
        Integrate
      </button>
      {output?.error && <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${errorClass}`}>{output.error}</div>}
      {output?.value !== null && output?.value !== undefined && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${resultClass}`}>∫ ≈ {output.formatted}</div>
      )}
      <p className={`text-[11px] ${noteClass}`}>
        Computed numerically (Simpson's rule) — works for any integrable f(x), including ones with no closed-form
        antiderivative, and for discontinuous functions like sign(x).
      </p>
    </div>
  );
}

function IndefiniteForm({ labelClass, inputClass, btnClass, resultClass, errorClass, noteClass }: FormClasses) {
  const [expr, setExpr] = useState('3*x^2 + sin(x)');
  const [output, setOutput] = useState<{ result: string | null; error: string | null; unsupportedTerms: string[] } | null>(null);

  const run = () => setOutput(indefiniteIntegral(expr));

  return (
    <div className="space-y-2">
      <Field label="f(x)" labelClass={labelClass}>
        <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm focus:outline-none ${inputClass}`} />
      </Field>
      <button type="button" onClick={run} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${btnClass}`}>
        Integrate
      </button>
      {output?.error && <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${errorClass}`}>{output.error}</div>}
      {output && output.unsupportedTerms.length > 0 && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${errorClass}`}>
          Can't symbolically integrate: {output.unsupportedTerms.join(', ')}. Try Definite Integral for a numeric value instead.
        </div>
      )}
      {output?.result && <div className={`rounded-lg border px-3 py-2 text-sm font-mono break-all ${resultClass}`}>∫f(x)dx = {output.result}</div>}
      <p className={`text-[11px] ${noteClass}`}>
        Term-by-term symbolic integration (power rule, sin, cos, exp, 1/x, √x). Not a full computer-algebra system —
        complex compositions may be reported as unsupported rather than guessed at.
      </p>
    </div>
  );
}

function SignumForm({ labelClass, inputClass, btnClass, resultClass, errorClass, noteClass }: FormClasses) {
  const [expr, setExpr] = useState('x');
  const [lower, setLower] = useState('-2');
  const [upper, setUpper] = useState('3');
  const [output, setOutput] = useState<{ value: number | null; error: string | null; formatted: string; breakpoints: number[] } | null>(null);

  const run = () => {
    const a = evaluateExpression(lower, 'rad');
    const b = evaluateExpression(upper, 'rad');
    if (a.value === null) { setOutput({ value: null, error: 'Invalid lower limit', formatted: '', breakpoints: [] }); return; }
    if (b.value === null) { setOutput({ value: null, error: 'Invalid upper limit', formatted: '', breakpoints: [] }); return; }
    setOutput(solveSignum(expr, a.value, b.value));
  };

  return (
    <div className="space-y-2">
      <Field label="f(x) — sign(f(x)) is solved" labelClass={labelClass}>
        <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm focus:outline-none ${inputClass}`} />
      </Field>
      <div className="flex gap-2">
        <Field label="Lower limit" labelClass={labelClass}>
          <input value={lower} onChange={(e) => setLower(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm w-28 focus:outline-none ${inputClass}`} />
        </Field>
        <Field label="Upper limit" labelClass={labelClass}>
          <input value={upper} onChange={(e) => setUpper(e.target.value)} spellCheck={false} className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm w-28 focus:outline-none ${inputClass}`} />
        </Field>
      </div>
      <button type="button" onClick={run} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${btnClass}`}>
        Solve
      </button>
      {output?.error && <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${errorClass}`}>{output.error}</div>}
      {output?.value !== null && output?.value !== undefined && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-mono ${resultClass}`}>
          ∫ sign(f(x)) dx = {output.formatted}
          {output.breakpoints.length > 0 && (
            <div className="mt-1 text-xs opacity-80">Sign changes at x ≈ {output.breakpoints.map((v) => formatBreakpoint(v)).join(', ')}</div>
          )}
        </div>
      )}
      <p className={`text-[11px] ${noteClass}`}>
        Solves the signum function of f(x) between the given lower and upper limits — locates every zero-crossing
        exactly, then sums ±(segment length) across the resulting intervals.
      </p>
    </div>
  );
}

function formatBreakpoint(v: number): string {
  return Math.round(v * 1e6) / 1e6 + '';
}
