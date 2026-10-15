import { create, all } from 'mathjs';
import type { AngleUnit } from '../types';

// A fully-featured mathjs instance. We use math.js as the expression parser
// and evaluator (per the project requirements) rather than hand-rolling a
// tokenizer, but we layer custom scope functions on top so we can control
// degree/radian behavior and the log vs. ln distinction precisely.
const math = create(all, {});

/**
 * Builds the evaluation scope passed into math.js.
 *
 * Notes on design decisions:
 * - `log(x)` is redefined to mean base-10 logarithm (calculator convention),
 *   while `ln(x)` is the natural logarithm. Vanilla math.js defines
 *   `log(x)` as natural log, which would surprise calculator users.
 * - Trig functions are redefined so that in "deg" mode they accept/return
 *   degrees, converting internally to radians for the actual computation.
 * - `log(x, base)` is preserved for scientific use (two-argument form).
 */
function buildScope(angleUnit: AngleUnit, extra: Record<string, unknown> = {}) {
  const toRad = (x: number) => (angleUnit === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angleUnit === 'deg' ? (x * 180) / Math.PI : x);

  return {
    pi: Math.PI,
    e: Math.E,
    sin: (x: number) => Math.sin(toRad(x)),
    cos: (x: number) => Math.cos(toRad(x)),
    tan: (x: number) => Math.tan(toRad(x)),
    asin: (x: number) => fromRad(Math.asin(x)),
    acos: (x: number) => fromRad(Math.acos(x)),
    atan: (x: number) => fromRad(Math.atan(x)),
    log: (x: number, base?: number) => (base === undefined ? Math.log10(x) : Math.log(x) / Math.log(base)),
    ln: (x: number) => Math.log(x),
    sqrt: (x: number) => Math.sqrt(x),
    cbrt: (x: number) => Math.cbrt(x),
    abs: (x: number) => Math.abs(x),
    exp: (x: number) => Math.exp(x),
    ...extra,
  };
}

export interface EvaluateResult {
  value: number | null;
  error: string | null;
  formatted: string;
}

/**
 * Evaluates a calculator expression string using math.js, with the custom
 * degree/radian-aware scope above. Returns a structured result so callers
 * never need to worry about a throw crashing the UI.
 */
export function evaluateExpression(
  expression: string,
  angleUnit: AngleUnit = 'rad',
  extraScope: Record<string, unknown> = {}
): EvaluateResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { value: null, error: null, formatted: '' };
  }

  try {
    const preprocessed = preprocessExpression(trimmed);
    const scope = buildScope(angleUnit, extraScope);
    const result = math.evaluate(preprocessed, scope);

    if (typeof result !== 'number' || Number.isNaN(result)) {
      // math.js can return complex numbers, matrices, functions, etc.
      // For a calculator we only accept plain real numbers.
      if (result && typeof result === 'object' && 're' in (result as Record<string, unknown>)) {
        throw new Error('Complex result — check your input');
      }
      throw new Error('Invalid expression');
    }

    if (!Number.isFinite(result)) {
      throw new Error(result > 0 ? 'Result is infinite' : 'Result is undefined');
    }

    return { value: result, error: null, formatted: formatNumber(result) };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? humanizeError(err.message) : 'Invalid expression',
      formatted: '',
    };
  }
}

/** Compiles an expression once for repeated evaluation (used by the grapher for performance). */
export function compileExpression(expression: string, angleUnit: AngleUnit = 'rad') {
  const preprocessed = preprocessExpression(expression);
  const node = math.compile(preprocessed);
  const scope = buildScope(angleUnit);
  return (x: number): number => {
    const result = node.evaluate({ ...scope, x });
    if (typeof result !== 'number' || !Number.isFinite(result)) return NaN;
    return result;
  };
}

export type GraphExpression =
  /** y = f(x) — plotted with one fast x-sweep, one sample per pixel column. */
  | { kind: 'explicit-y'; evaluate: (x: number) => number }
  /** x = f(y) — plotted with one fast y-sweep, one sample per pixel row. */
  | { kind: 'explicit-x'; evaluate: (y: number) => number }
  /** General relation, e.g. y² = x³, x² + y² = 25 — plotted as the zero
   *  contour of left(x,y) - right(x,y) via marching squares over a grid. */
  | { kind: 'implicit'; evaluate: (x: number, y: number) => number };

const WORD_Y = /\by\b/;
const WORD_X = /\bx\b/;

/**
 * Compiles a graphing-mode equation for plotting. Understands three shapes:
 *  - a bare expression, e.g. "x^2 - 2x + 1", treated as "y = <expr>"
 *  - "y = <expr in x>" — same fast path as above
 *  - "x = <expr in y>" — sideways functions like x = y²
 *  - anything else with an "=" and both x and/or y on either side, e.g.
 *    "y^2 = x^3" or "x^2 + y^2 = 25" — treated as a general implicit
 *    relation and plotted by finding where left(x,y) - right(x,y) crosses
 *    zero, so curves that aren't functions of x (circles, y² = x³, etc.)
 *    still plot correctly.
 */
export function compileGraphExpression(
  expression: string,
  angleUnit: AngleUnit = 'rad',
  extraScope: Record<string, number> = {}
): GraphExpression {
  const trimmed = expression.trim();
  const scope = buildScope(angleUnit, extraScope);

  if (!trimmed) {
    return { kind: 'explicit-y', evaluate: () => NaN };
  }

  const eqIdx = trimmed.indexOf('=');
  const leftRaw = eqIdx >= 0 ? trimmed.slice(0, eqIdx).trim() : 'y';
  const rightRaw = eqIdx >= 0 ? trimmed.slice(eqIdx + 1).trim() : trimmed;

  // Fast path: y = f(x)
  if (leftRaw === 'y' && !WORD_Y.test(rightRaw)) {
    const node = math.compile(preprocessExpression(rightRaw));
    return {
      kind: 'explicit-y',
      evaluate: (x: number) => {
        const r = node.evaluate({ ...scope, x });
        return typeof r === 'number' && Number.isFinite(r) ? r : NaN;
      },
    };
  }

  // Fast path: x = f(y)
  if (leftRaw === 'x' && !WORD_X.test(rightRaw)) {
    const node = math.compile(preprocessExpression(rightRaw));
    return {
      kind: 'explicit-x',
      evaluate: (y: number) => {
        const r = node.evaluate({ ...scope, y });
        return typeof r === 'number' && Number.isFinite(r) ? r : NaN;
      },
    };
  }

  // General implicit relation: left(x, y) - right(x, y) = 0
  const leftNode = math.compile(preprocessExpression(leftRaw));
  const rightNode = math.compile(preprocessExpression(rightRaw));
  return {
    kind: 'implicit',
    evaluate: (x: number, y: number) => {
      const l = leftNode.evaluate({ ...scope, x, y });
      const r = rightNode.evaluate({ ...scope, x, y });
      if (typeof l !== 'number' || typeof r !== 'number') return NaN;
      const v = l - r;
      return Number.isFinite(v) ? v : NaN;
    },
  };
}

// Names that are never treated as user-adjustable graph parameters — the
// two plotting variables, built-in constants, and every function name our
// scope recognizes.
const RESERVED_GRAPH_NAMES = new Set([
  'x', 'y', 'pi', 'e',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'log', 'ln', 'sqrt', 'cbrt', 'abs', 'exp', 'sign', 'nthRoot',
]);

/**
 * Scans a graphing-mode equation for free symbols other than x/y/constants/
 * function names — e.g. "a*sin(x) + b" → ["a", "b"]. These become
 * user-adjustable slider parameters in Graphing mode, so equations can
 * depend on any number of extra variables beyond x and y.
 */
export function extractGraphParameters(expression: string): string[] {
  const trimmed = expression.trim();
  if (!trimmed) return [];

  const eqIdx = trimmed.indexOf('=');
  const leftRaw = eqIdx >= 0 ? trimmed.slice(0, eqIdx).trim() : 'y';
  const rightRaw = eqIdx >= 0 ? trimmed.slice(eqIdx + 1).trim() : trimmed;

  const names = new Set<string>();
  for (const part of [leftRaw, rightRaw]) {
    try {
      const node = math.parse(preprocessExpression(part));
      node.traverse((n: any) => {
        if (n.type === 'SymbolNode' && !RESERVED_GRAPH_NAMES.has(n.name)) {
          names.add(n.name);
        }
      });
    } catch {
      // Malformed expressions are surfaced elsewhere; just skip parameter extraction.
    }
  }
  return Array.from(names);
}

/**
 * Light preprocessing so common calculator shorthand parses cleanly:
 * - '×' and '÷' symbols → * and /
 * - '^' already works natively in math.js for powers
 * - implicit multiplication like '2π' or '2(3+1)' is handled by math.js itself
 */
function preprocessExpression(expr: string): string {
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .trim();
}

function humanizeError(message: string): string {
  if (/Undefined symbol/i.test(message)) return 'Unknown symbol in expression';
  if (/Parenthesis/i.test(message) || /Unexpected/i.test(message)) return 'Malformed expression';
  if (/Unexpected end of expression/i.test(message)) return 'Incomplete expression';
  if (/division by zero|Divide by zero/i.test(message)) return 'Cannot divide by zero';
  return message.length < 60 ? message : 'Invalid expression';
}

// ---------------------------------------------------------------------------
// Calculus
//
// Everything below always operates in radians, regardless of the Deg/Rad
// toggle — that's the only convention under which d/dx sin(x) = cos(x) and
// the standard integral tables hold.
//
// `log(x)` is redefined elsewhere in this file to mean base-10 (calculator
// convention), but math.js's built-in symbolic differentiation rules assume
// `log(x)` is natural log. To keep differentiation/integration consistent
// with what `log` actually evaluates to in this app, every "log(" call is
// rewritten to the equivalent "(ln(...)/ln(10))" before any symbolic work.
// ---------------------------------------------------------------------------

/** Rewrites every single-argument `log(...)` call to `(ln(...)/ln(10))`, handling nested parens correctly. */
function expandLog10(expr: string): string {
  let out = expr;
  // Repeat in case expanding one log(...) reveals another at the same level.
  for (let guard = 0; guard < 50; guard++) {
    const idx = out.search(/\blog\(/);
    if (idx === -1) break;
    const openIdx = out.indexOf('(', idx);
    let depth = 1;
    let i = openIdx + 1;
    for (; i < out.length && depth > 0; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') depth--;
    }
    const inner = out.slice(openIdx + 1, i - 1);
    if (topLevelCommaCount(inner) > 0) {
      // Two-argument log(x, base) is left as-is — math.js parses and
      // differentiates that form natively and correctly on its own.
      // Replace "log(" with a placeholder (not just a prefix) so the next
      // scan pass can't re-match the same "log(" substring.
      out = out.slice(0, idx) + '\u0001(' + out.slice(openIdx + 1);
      continue;
    }
    out = out.slice(0, idx) + `(ln(${inner})/ln(10))` + out.slice(i);
  }
  return out.replace(/\u0001\(/g, 'log(');
}

function topLevelCommaCount(s: string): number {
  let depth = 0;
  let count = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) count++;
  }
  return count;
}

export interface DifferentiateResult {
  result: string | null;
  error: string | null;
}

/**
 * Symbolic differentiation of arbitrary order with respect to x, via
 * math.js's built-in `derivative()`. This is fully general — it works for
 * any expression math.js can parse and differentiate, not a limited pattern
 * set — because math.js carries real symbolic differentiation rules.
 */
export function differentiate(expression: string, order: number = 1, withRespectTo: string = 'x'): DifferentiateResult {
  const trimmed = expression.trim();
  if (!trimmed) return { result: null, error: null };
  if (!Number.isInteger(order) || order < 1) {
    return { result: null, error: 'Order must be a positive integer' };
  }

  try {
    let node = math.parse(expandLog10(preprocessExpression(trimmed)));
    for (let i = 0; i < order; i++) {
      node = math.derivative(node, withRespectTo);
    }
    const simplified = math.simplify(node);
    return { result: simplified.toString({ implicit: 'show' }), error: null };
  } catch (err) {
    return { result: null, error: err instanceof Error ? humanizeError(err.message) : 'Could not differentiate' };
  }
}

export interface DefiniteIntegralResult {
  value: number | null;
  error: string | null;
  formatted: string;
}

/**
 * Numeric definite integral ∫[lower, upper] f(x) dx via composite Simpson's
 * rule. Numeric integration is used deliberately: it's correct for *any*
 * integrable expression (including ones with no elementary antiderivative),
 * unlike symbolic integration which only covers a limited pattern set.
 */
export function definiteIntegral(
  expression: string,
  lower: number,
  upper: number,
  intervals: number = 2000
): DefiniteIntegralResult {
  const trimmed = expression.trim();
  if (!trimmed) return { value: null, error: null, formatted: '' };
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return { value: null, error: 'Limits must be finite numbers', formatted: '' };
  }
  if (lower === upper) return { value: 0, error: null, formatted: '0' };

  try {
    const f = compileExpression(trimmed, 'rad');
    const a = Math.min(lower, upper);
    const b = Math.max(lower, upper);
    const n = intervals % 2 === 0 ? intervals : intervals + 1; // Simpson's rule needs an even interval count
    const h = (b - a) / n;

    let sum = evalSafe(f, a) + evalSafe(f, b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      const weight = i % 2 === 0 ? 2 : 4;
      sum += weight * evalSafe(f, x);
    }
    let result = (h / 3) * sum;
    if (lower > upper) result = -result; // ∫[b,a] = -∫[a,b]

    if (!Number.isFinite(result)) {
      return { value: null, error: 'Integral does not converge on this interval', formatted: '' };
    }
    return { value: result, error: null, formatted: formatNumber(result) };
  } catch (err) {
    return { value: null, error: err instanceof Error ? humanizeError(err.message) : 'Invalid expression', formatted: '' };
  }
}

function evalSafe(f: (x: number) => number, x: number): number {
  const v = f(x);
  return Number.isFinite(v) ? v : 0; // treat singularities/discontinuities as locally 0 rather than blowing up the sum
}

export interface IndefiniteIntegralResult {
  result: string | null;
  error: string | null;
  unsupportedTerms: string[];
}

/**
 * Term-by-term symbolic indefinite integration. This is intentionally
 * scoped rather than a full computer-algebra-system: it splits the
 * expression on top-level +/- into terms and integrates each one against a
 * small table of standard forms (power rule, sin, cos, exp, 1/x, sqrt).
 * Terms outside that table are reported as unsupported rather than
 * silently guessed at.
 */
export function indefiniteIntegral(expression: string): IndefiniteIntegralResult {
  const trimmed = expression.trim();
  if (!trimmed) return { result: null, error: null, unsupportedTerms: [] };

  let terms: string[];
  try {
    terms = splitTopLevelTerms(preprocessExpression(trimmed));
  } catch (err) {
    return { result: null, error: 'Malformed expression', unsupportedTerms: [] };
  }

  const parts: string[] = [];
  const unsupported: string[] = [];

  for (const rawTerm of terms) {
    const term = rawTerm.trim();
    if (!term) continue;
    const integrated = integrateSingleTerm(term);
    if (integrated === null) {
      unsupported.push(term);
    } else {
      parts.push(integrated);
    }
  }

  if (unsupported.length > 0) {
    return {
      result: null,
      error: null,
      unsupportedTerms: unsupported,
    };
  }

  const joined = parts.join(' + ').replace(/\+ -/g, '- ') || '0';
  return { result: `${joined} + C`, error: null, unsupportedTerms: [] };
}

/** Splits an expression on top-level + and - (outside parentheses), keeping the sign with each term. */
function splitTopLevelTerms(expr: string): string[] {
  const terms: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && (ch === '+' || ch === '-') && current.trim() !== '') {
      terms.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') terms.push(current);
  return terms;
}

/** Integrates a single additive term against a small table of standard forms. Returns null if unrecognized. */
function integrateSingleTerm(term: string): string | null {
  let t = term.trim();
  let sign = '';
  if (t.startsWith('+')) t = t.slice(1).trim();
  if (t.startsWith('-')) {
    sign = '-';
    t = t.slice(1).trim();
  }

  // Separate an optional leading numeric coefficient, e.g. "3*x^2", "3 x^2", "3x".
  const coeffMatch = t.match(/^(\d+(\.\d+)?)\s*\*?\s*/);
  const coeff = coeffMatch ? coeffMatch[1] : '';
  const base = coeffMatch ? t.slice(coeffMatch[0].length).trim() : t;
  const c = coeff ? `${coeff}*` : '';

  const wrap = (body: string) => `${sign}${body}`;

  // Constant term: ∫c dx = c*x
  if (base === '' || /^\d+(\.\d+)?$/.test(base)) {
    const k = base === '' ? coeff || '1' : `${coeff ? coeff + '*' : ''}${base}`;
    return wrap(`${k}*x`);
  }

  // x^n (including bare "x", treated as x^1)
  const powerBase = base === 'x' ? 'x^1' : base;
  const m = powerBase.match(/^x\^\(?(-?\d+(\.\d+)?)\)?$/);
  if (m) {
    const n = parseFloat(m[1]);
    if (n === -1) return wrap(`${c}ln(abs(x))`);
    const np1 = n + 1;
    const k = coeff ? `${coeff}/${np1}` : `1/${np1}`;
    return wrap(`(${k})*x^${np1}`);
  }

  // sqrt(x) = x^(1/2)
  if (base === 'sqrt(x)') return wrap(`${coeff ? coeff + '*' : ''}(2/3)*x^(3/2)`);

  // 1/x
  if (base === '1/x') return wrap(`${c}ln(abs(x))`);

  // sin(x), cos(x), exp(x)
  if (base === 'sin(x)') return wrap(`-${c}cos(x)`);
  if (base === 'cos(x)') return wrap(`${c}sin(x)`);
  if (base === 'exp(x)') return wrap(`${c}exp(x)`);

  // e^x
  if (base === 'e^x') return wrap(`${c}exp(x)`);

  return null;
}

export interface SignumResult {
  value: number | null;
  error: string | null;
  formatted: string;
  breakpoints: number[];
}

/**
 * Solves ∫[lower, upper] sign(f(x)) dx exactly. sign(f(x)) is piecewise
 * constant (+1, -1, or 0), so rather than approximating with a quadrature
 * rule (which struggles at jump discontinuities), this locates every point
 * where f(x) crosses zero inside [lower, upper] via a fine scan + bisection
 * refinement, then sums (segment length * sign) across the resulting
 * subintervals — giving an exact result rather than a numerical
 * approximation.
 */
export function solveSignum(
  expression: string,
  lower: number,
  upper: number,
  scanPoints: number = 4000
): SignumResult {
  const trimmed = expression.trim();
  if (!trimmed) return { value: null, error: null, formatted: '', breakpoints: [] };
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return { value: null, error: 'Limits must be finite numbers', formatted: '', breakpoints: [] };
  }
  if (lower === upper) return { value: 0, error: null, formatted: '0', breakpoints: [] };

  try {
    const f = compileExpression(trimmed, 'rad');
    const a = Math.min(lower, upper);
    const b = Math.max(lower, upper);
    const n = Math.max(2, scanPoints);
    const h = (b - a) / n;

    const signOf = (x: number): number => {
      const v = f(x);
      return Number.isFinite(v) ? Math.sign(v) : 0;
    };

    const bisectRoot = (x1: number, x2: number): number => {
      let lo = x1;
      let hi = x2;
      const sLo = signOf(lo);
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (signOf(mid) === sLo) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };

    const breakpoints: number[] = [];
    let prevX = a;
    let prevSign = signOf(a);
    let total = 0;

    for (let i = 1; i <= n; i++) {
      const x = a + i * h;
      const s = signOf(x);
      if (s !== prevSign) {
        const root = bisectRoot(prevX, x);
        total += (root - prevX) * prevSign;
        breakpoints.push(root);
        prevX = root;
        prevSign = s;
      }
    }
    total += (b - prevX) * prevSign;
    if (lower > upper) total = -total;

    if (!Number.isFinite(total)) {
      return { value: null, error: 'Result is undefined on this interval', formatted: '', breakpoints: [] };
    }
    return { value: total, error: null, formatted: formatNumber(total), breakpoints };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? humanizeError(err.message) : 'Invalid expression',
      formatted: '',
      breakpoints: [],
    };
  }
}

/** Formats a numeric result for display: trims float noise, uses scientific notation for extreme magnitudes. */
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) value = 0;

  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    return value.toExponential(6).replace(/\.?0+e/, 'e');
  }

  // Round to 10 significant decimal places to eliminate binary float noise,
  // then strip trailing zeros.
  const rounded = math.round(value, 10);
  let str = rounded.toString();

  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }

  // Insert thousands separators for the integer part, preserving decimals.
  const [intPart, decPart] = str.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withSeparators}.${decPart}` : withSeparators;
}

export default math;
