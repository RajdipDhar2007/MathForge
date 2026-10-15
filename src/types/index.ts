// Central type definitions shared across the app.

export type CalculatorMode = 'basic' | 'scientific' | 'graphing';

export type AngleUnit = 'deg' | 'rad';

/** One entry in the calculation history log (Basic + Scientific modes). */
export interface HistoryEntry {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

/** A single plotted function in the Graphing mode. */
export interface GraphFunction {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  error?: string;
}

/** Viewport/camera state for the graph canvas. */
export interface GraphViewport {
  centerX: number;
  centerY: number;
  /** Number of graph units visible across the canvas width. */
  scale: number;
}
