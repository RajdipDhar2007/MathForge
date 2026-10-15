import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { evaluateExpression, formatNumber } from '../utils/mathEngine';
import { AngleUnit, HistoryEntry } from '../types';

interface UseCalculatorEngineOptions {
  history: HistoryEntry[];
  addHistoryEntry: (entry: HistoryEntry) => void;
}

interface EditorState {
  expression: string;
  cursorPos: number;
}

/**
 * Expression-based calculator engine. Rather than emulating a physical
 * calculator's running-total logic, the user builds up a full expression
 * string (supporting parentheses, precedence, functions, etc.) which is
 * live-evaluated on every keystroke via math.js — this is what makes
 * "accurate expression parsing" possible instead of naive left-to-right
 * button chaining.
 *
 * Expression and cursor position are tracked together (as one state object)
 * so every edit — whether typed directly into the display or inserted by a
 * button — lands exactly where the caret is, rather than always appending
 * to the end. That's what lets function buttons (sin, cos, sqrt, ...)
 * insert both parentheses at once with the caret placed in between.
 */
export function useCalculatorEngine({ history, addHistoryEntry }: UseCalculatorEngineOptions) {
  const [editor, setEditor] = useState<EditorState>({ expression: '', cursorPos: 0 });
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('deg');
  const [memory, setMemory] = useState<number>(0);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const { expression, cursorPos } = editor;

  const liveResult = useMemo(() => evaluateExpression(expression, angleUnit), [expression, angleUnit]);

  /**
   * Inserts `text` at the current cursor position and moves the cursor by
   * `caretOffset` characters (defaults to the length of the inserted text,
   * i.e. the caret lands right after what was typed). Passing a smaller
   * offset — e.g. inserting "sin()" with offset 4 — lands the caret between
   * the parentheses instead of after the closing one.
   */
  const insertAtCursor = useCallback((text: string, caretOffset?: number) => {
    setEditor((prev) => {
      const pos = Math.max(0, Math.min(prev.cursorPos, prev.expression.length));
      const nextExpression = prev.expression.slice(0, pos) + text + prev.expression.slice(pos);
      const nextPos = pos + (caretOffset ?? text.length);
      return { expression: nextExpression, cursorPos: nextPos };
    });
    setJustEvaluated(false);
  }, []);

  /** Plain token insertion (digits, operators, bare parentheses) — caret lands right after it. */
  const input = useCallback(
    (token: string) => {
      // Starting a fresh number right after '=' begins a new expression
      // instead of appending to the previous result.
      if (justEvaluated && /^[0-9.]$/.test(token)) {
        setEditor({ expression: token, cursorPos: token.length });
        setJustEvaluated(false);
        return;
      }
      insertAtCursor(token);
    },
    [justEvaluated, insertAtCursor]
  );

  /** Inserts a function call with both parentheses auto-closed, caret placed inside them. */
  const insertFunction = useCallback(
    (name: string) => {
      const call = `${name}()`;
      insertAtCursor(call, name.length + 1);
    },
    [insertAtCursor]
  );

  /** Inserts a raw snippet (e.g. "nthRoot(,)") with an explicit caret offset. */
  const insertRaw = useCallback(
    (text: string, caretOffset: number) => {
      insertAtCursor(text, caretOffset);
    },
    [insertAtCursor]
  );

  /** Directly sets expression + cursor — used when the user types into the display input natively. */
  const setExpressionAndCursor = useCallback((value: string, cursor: number) => {
    setEditor({ expression: value, cursorPos: cursor });
    setJustEvaluated(false);
  }, []);

  const clear = useCallback(() => {
    setEditor({ expression: '', cursorPos: 0 });
    setJustEvaluated(false);
  }, []);

  const backspace = useCallback(() => {
    setEditor((prev) => {
      const pos = Math.max(0, Math.min(prev.cursorPos, prev.expression.length));
      if (pos === 0) return prev;
      return {
        expression: prev.expression.slice(0, pos - 1) + prev.expression.slice(pos),
        cursorPos: pos - 1,
      };
    });
    setJustEvaluated(false);
  }, []);

  const toggleSign = useCallback(() => {
    setEditor((prev) => {
      if (!prev.expression) return prev;
      if (prev.expression.startsWith('-(') && prev.expression.endsWith(')')) {
        const next = prev.expression.slice(2, -1);
        return { expression: next, cursorPos: next.length };
      }
      const next = `-(${prev.expression})`;
      return { expression: next, cursorPos: next.length };
    });
  }, []);

  const percent = useCallback(() => {
    setEditor((prev) => {
      if (!prev.expression) return prev;
      const next = `(${prev.expression})/100`;
      return { expression: next, cursorPos: next.length };
    });
  }, []);

  const evaluate = useCallback(() => {
    if (!expression.trim()) return;
    const res = evaluateExpression(expression, angleUnit);
    if (res.error || res.value === null) return;

    addHistoryEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      expression,
      result: res.formatted,
      timestamp: Date.now(),
    });
    const clean = res.formatted.replace(/,/g, '');
    setEditor({ expression: clean, cursorPos: clean.length });
    setJustEvaluated(true);
  }, [expression, angleUnit, addHistoryEntry]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    const clean = entry.result.replace(/,/g, '');
    setEditor({ expression: clean, cursorPos: clean.length });
    setJustEvaluated(true);
  }, []);

  // --- Memory functions ---
  const memoryClear = useCallback(() => setMemory(0), []);
  const memoryRecall = useCallback(() => {
    input(formatNumber(memory).replace(/,/g, ''));
  }, [memory, input]);
  const memoryAdd = useCallback(() => {
    const val = liveResult.value ?? parseFloat(expression);
    if (!Number.isNaN(val) && val !== undefined) setMemory((m) => m + (val ?? 0));
  }, [liveResult.value, expression]);
  const memorySubtract = useCallback(() => {
    const val = liveResult.value ?? parseFloat(expression);
    if (!Number.isNaN(val) && val !== undefined) setMemory((m) => m - (val ?? 0));
  }, [liveResult.value, expression]);

  /** Handles Enter (evaluate) and Escape (clear) when the display input has focus. Other keys pass through natively. */
  const handleDisplayKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        evaluate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clear();
      }
    },
    [evaluate, clear]
  );

  return {
    expression,
    cursorPos,
    setExpressionAndCursor,
    liveResult,
    angleUnit,
    setAngleUnit,
    memory,
    input,
    insertFunction,
    insertRaw,
    clear,
    backspace,
    toggleSign,
    percent,
    evaluate,
    loadFromHistory,
    memoryClear,
    memoryRecall,
    memoryAdd,
    memorySubtract,
    handleDisplayKeyDown,
    history,
  };
}
