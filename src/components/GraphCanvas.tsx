import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { compileGraphExpression } from '../utils/mathEngine';
import { GraphFunction, GraphViewport } from '../types';

interface GraphCanvasProps {
  functions: GraphFunction[];
  viewport: GraphViewport;
  onViewportChange: (viewport: GraphViewport) => void;
  theme: 'dark' | 'light';
  params: Record<string, number>;
}

export interface GraphCanvasHandle {
  exportPNG: () => void;
}

// Color palettes for the canvas itself — kept separate from Tailwind classes
// since these are drawn imperatively via the Canvas 2D API, not CSS.
const PALETTES = {
  dark: {
    background: '#0f1320',
    gridMinor: 'rgba(148, 163, 184, 0.08)',
    gridMajor: 'rgba(148, 163, 184, 0.18)',
    axis: 'rgba(226, 232, 240, 0.55)',
    label: 'rgba(148, 163, 184, 0.9)',
    crosshair: 'rgba(226, 232, 240, 0.35)',
  },
  light: {
    background: '#f8fafc',
    gridMinor: 'rgba(51, 65, 85, 0.08)',
    gridMajor: 'rgba(51, 65, 85, 0.16)',
    axis: 'rgba(30, 41, 59, 0.6)',
    label: 'rgba(51, 65, 85, 0.85)',
    crosshair: 'rgba(30, 41, 59, 0.35)',
  },
} as const;

/**
 * A from-scratch Desmos-style graphing engine built directly on the Canvas
 * 2D API (no charting library) — draws an adaptive grid + axes, plots each
 * function by sampling per device pixel, supports drag-to-pan, wheel/button
 * zoom, hover readouts, and PNG export.
 */
const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { functions, viewport, onViewportChange, theme, params },
  ref
) {
  const palette = PALETTES[theme];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [hover, setHover] = useState<{ px: number; py: number; gx: number; gy: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startCenter: GraphViewport } | null>(null);

  // Keep canvas sized to its container (responsive across devices).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.max(width, 200), height: Math.max(height, 200) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Converts a graph-space coordinate to a canvas pixel coordinate. */
  const toPixel = useCallback(
    (gx: number, gy: number) => {
      const unitsPerPixel = viewport.scale / size.width;
      const px = size.width / 2 + (gx - viewport.centerX) / unitsPerPixel;
      const py = size.height / 2 - (gy - viewport.centerY) / unitsPerPixel;
      return [px, py] as const;
    },
    [viewport, size]
  );

  /** Converts a canvas pixel coordinate back to graph space. */
  const toGraph = useCallback(
    (px: number, py: number) => {
      const unitsPerPixel = viewport.scale / size.width;
      const gx = viewport.centerX + (px - size.width / 2) * unitsPerPixel;
      const gy = viewport.centerY - (py - size.height / 2) * unitsPerPixel;
      return [gx, gy] as const;
    },
    [viewport, size]
  );

  /** Picks a "nice" grid step (1, 2, 5 × 10^n) close to a target pixel spacing. */
  function niceStep(unitsPerPixel: number, targetPx: number): number {
    const rough = unitsPerPixel * targetPx;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;
    let step: number;
    if (residual >= 5) step = 5 * magnitude;
    else if (residual >= 2) step = 2 * magnitude;
    else step = magnitude;
    return step;
  }

  // Main render loop: redraws whenever viewport, size, or the function list changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, size.width, size.height);

    const unitsPerPixel = viewport.scale / size.width;
    const minorStep = niceStep(unitsPerPixel, 40);
    const majorStep = minorStep * 5;

    const [gxMin] = toGraph(0, 0);
    const [gxMax] = toGraph(size.width, 0);
    const [, gyMax] = toGraph(0, 0);
    const [, gyMin] = toGraph(0, size.height);

    // Minor grid lines
    ctx.strokeStyle = palette.gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(gxMin / minorStep) * minorStep; x <= gxMax; x += minorStep) {
      const [px] = toPixel(x, 0);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size.height);
    }
    for (let y = Math.ceil(gyMin / minorStep) * minorStep; y <= gyMax; y += minorStep) {
      const [, py] = toPixel(0, y);
      ctx.moveTo(0, py);
      ctx.lineTo(size.width, py);
    }
    ctx.stroke();

    // Major grid lines + labels
    ctx.strokeStyle = palette.gridMajor;
    ctx.beginPath();
    for (let x = Math.ceil(gxMin / majorStep) * majorStep; x <= gxMax; x += majorStep) {
      const [px] = toPixel(x, 0);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size.height);
    }
    for (let y = Math.ceil(gyMin / majorStep) * majorStep; y <= gyMax; y += majorStep) {
      const [, py] = toPixel(0, y);
      ctx.moveTo(0, py);
      ctx.lineTo(size.width, py);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = palette.axis;
    ctx.lineWidth = 1.5;
    const [originPx, originPy] = toPixel(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, originPy);
    ctx.lineTo(size.width, originPy);
    ctx.moveTo(originPx, 0);
    ctx.lineTo(originPx, size.height);
    ctx.stroke();

    // Axis tick labels (major grid)
    ctx.fillStyle = palette.label;
    ctx.font = '11px "JetBrains Mono", monospace';
    for (let x = Math.ceil(gxMin / majorStep) * majorStep; x <= gxMax; x += majorStep) {
      if (Math.abs(x) < majorStep / 2) continue; // skip label at origin (clutter)
      const [px] = toPixel(x, 0);
      const label = Number(x.toPrecision(6)).toString();
      ctx.fillText(label, px + 3, originPy - 4 >= 0 && originPy <= size.height ? originPy - 4 : 12);
    }
    for (let y = Math.ceil(gyMin / majorStep) * majorStep; y <= gyMax; y += majorStep) {
      if (Math.abs(y) < majorStep / 2) continue;
      const [, py] = toPixel(0, y);
      const label = Number(y.toPrecision(6)).toString();
      ctx.fillText(label, originPx >= 0 && originPx <= size.width - 28 ? originPx + 4 : size.width - 30, py - 3);
    }

    // Plot each visible function. Explicit y=f(x) / x=f(y) equations use a
    // fast single-sweep line trace; general implicit relations (curves that
    // aren't functions, like y² = x³ or x² + y² = 25) are plotted as the
    // zero contour of left(x,y) - right(x,y) via marching squares.
    functions.forEach((fn) => {
      if (!fn.visible || fn.error) return;
      try {
        const graphFn = compileGraphExpression(fn.expression, 'rad', params);
        ctx.strokeStyle = fn.color;
        ctx.lineWidth = 2.25;
        ctx.lineJoin = 'round';

        if (graphFn.kind === 'explicit-y') {
          plotExplicitY(ctx, graphFn.evaluate, size, toGraph, toPixel);
        } else if (graphFn.kind === 'explicit-x') {
          plotExplicitX(ctx, graphFn.evaluate, size, toGraph, toPixel);
        } else {
          plotImplicit(ctx, graphFn.evaluate, size, toGraph, toPixel);
        }
      } catch {
        // Compilation/evaluation errors are surfaced via fn.error upstream; skip drawing here.
      }
    });

  }, [functions, viewport, size, toPixel, toGraph, palette, params]);

  // Overlay layer: just the hover crosshair, on its own canvas so mouse
  // movement doesn't force a full re-sample of every plotted function.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const dpr = window.devicePixelRatio || 1;
    overlay.width = size.width * dpr;
    overlay.height = size.height * dpr;
    overlay.style.width = `${size.width}px`;
    overlay.style.height = `${size.height}px`;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);

    if (hover) {
      ctx.strokeStyle = palette.crosshair;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hover.px, 0);
      ctx.lineTo(hover.px, size.height);
      ctx.moveTo(0, hover.py);
      ctx.lineTo(size.width, hover.py);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [hover, size, palette]);

  // --- Interaction: drag to pan ---
  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startCenter: viewport };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const [gx, gy] = toGraph(px, py);
      setHover({ px, py, gx, gy });
    }

    if (dragState.current) {
      const unitsPerPixel = viewport.scale / size.width;
      const dx = (e.clientX - dragState.current.startX) * unitsPerPixel;
      const dy = (e.clientY - dragState.current.startY) * unitsPerPixel;
      onViewportChange({
        ...dragState.current.startCenter,
        centerX: dragState.current.startCenter.centerX - dx,
        centerY: dragState.current.startCenter.centerY + dy,
      });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
  };

  const handlePointerLeave = () => {
    setHover(null);
    dragState.current = null;
  };

  const handleWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    onViewportChange({ ...viewport, scale: viewport.scale * zoomFactor });
  };

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `graph-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
  }));

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden border border-white/10 shadow-glass">
      <canvas ref={canvasRef} className="block absolute inset-0" />
      <canvas
        ref={overlayRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        className="cursor-grab active:cursor-grabbing touch-none block absolute inset-0"
      />
      {hover && (
        <div className="absolute top-2 left-2 rounded-lg bg-panel-950/85 border border-white/10 px-2.5 py-1.5 text-xs font-mono text-phosphor-bright pointer-events-none">
          x: {hover.gx.toFixed(3)}, y: {hover.gy.toFixed(3)}
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button
          type="button"
          onClick={() => onViewportChange({ ...viewport, scale: viewport.scale * 0.8 })}
          className="w-8 h-8 rounded-lg bg-panel-950/85 border border-white/10 text-phosphor text-lg leading-none hover:bg-panel-800 transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onViewportChange({ ...viewport, scale: viewport.scale * 1.25 })}
          className="w-8 h-8 rounded-lg bg-panel-950/85 border border-white/10 text-phosphor text-lg leading-none hover:bg-panel-800 transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onViewportChange({ centerX: 0, centerY: 0, scale: 20 })}
          className="h-8 px-2 rounded-lg bg-panel-950/85 border border-white/10 text-slate-300 text-xs hover:bg-panel-800 transition-colors"
          title="Reset view"
        >
          Reset
        </button>
      </div>
    </div>
  );
});

export default GraphCanvas;

type CoordMapper = (a: number, b: number) => readonly [number, number];

/** Fast path for y = f(x): one sample per pixel column, swept left to right. */
function plotExplicitY(
  ctx: CanvasRenderingContext2D,
  evaluate: (x: number) => number,
  size: { width: number; height: number },
  toGraph: CoordMapper,
  toPixel: CoordMapper
) {
  ctx.beginPath();
  let penDown = false;
  let prevPy: number | null = null;
  for (let px = 0; px <= size.width; px++) {
    const [gx] = toGraph(px, 0);
    const gy = evaluate(gx);
    if (!Number.isFinite(gy)) {
      penDown = false;
      prevPy = null;
      continue;
    }
    const [, py] = toPixel(gx, gy);

    // Detect near-vertical asymptotes: if the y value jumps by more than the
    // full canvas height between adjacent pixels, treat it as a break rather
    // than drawing a connecting line straight across the graph.
    if (prevPy !== null && Math.abs(py - prevPy) > size.height * 1.5) {
      penDown = false;
    }

    if (!penDown) {
      ctx.moveTo(px, py);
      penDown = true;
    } else {
      ctx.lineTo(px, py);
    }
    prevPy = py;
  }
  ctx.stroke();
}

/** Fast path for x = f(y): mirror of plotExplicitY, swept top to bottom. */
function plotExplicitX(
  ctx: CanvasRenderingContext2D,
  evaluate: (y: number) => number,
  size: { width: number; height: number },
  toGraph: CoordMapper,
  toPixel: CoordMapper
) {
  ctx.beginPath();
  let penDown = false;
  let prevPx: number | null = null;
  for (let py = 0; py <= size.height; py++) {
    const [, gy] = toGraph(0, py);
    const gx = evaluate(gy);
    if (!Number.isFinite(gx)) {
      penDown = false;
      prevPx = null;
      continue;
    }
    const [px] = toPixel(gx, gy);

    if (prevPx !== null && Math.abs(px - prevPx) > size.width * 1.5) {
      penDown = false;
    }

    if (!penDown) {
      ctx.moveTo(px, py);
      penDown = true;
    } else {
      ctx.lineTo(px, py);
    }
    prevPx = px;
  }
  ctx.stroke();
}

/**
 * Marching squares: plots the zero contour of an implicit relation
 * G(x, y) = 0, which is how curves that aren't functions of x — circles,
 * y² = x³, x² + y² = 25, etc. — get drawn. The canvas is divided into a
 * grid of cells; each cell's four corners are sampled, and wherever the
 * sign of G flips between two corners, a crossing point is interpolated
 * and connected according to the standard 16-case marching-squares table.
 */
function plotImplicit(
  ctx: CanvasRenderingContext2D,
  evaluate: (x: number, y: number) => number,
  size: { width: number; height: number },
  toGraph: CoordMapper,
  toPixel: CoordMapper
) {
  const STEP = 4; // grid cell size in device pixels — smaller = smoother but slower

  const cols = Math.ceil(size.width / STEP) + 1;
  const rows = Math.ceil(size.height / STEP) + 1;

  // Pre-sample G at every grid vertex once, so each cell only does array lookups.
  const values: Float64Array = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const py = j * STEP;
    const [, gy] = toGraph(0, py);
    for (let i = 0; i < cols; i++) {
      const px = i * STEP;
      const [gx] = toGraph(px, 0);
      values[j * cols + i] = evaluate(gx, gy);
    }
  }

  const at = (i: number, j: number) => values[j * cols + i];

  ctx.beginPath();

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const vTL = at(i, j);
      const vTR = at(i + 1, j);
      const vBL = at(i, j + 1);
      const vBR = at(i + 1, j + 1);
      if (![vTL, vTR, vBL, vBR].every(Number.isFinite)) continue;
      if (vTL === 0 && vTR === 0 && vBL === 0 && vBR === 0) continue;

      const sTL = vTL > 0 ? 1 : 0;
      const sTR = vTR > 0 ? 1 : 0;
      const sBL = vBL > 0 ? 1 : 0;
      const sBR = vBR > 0 ? 1 : 0;
      const caseIndex = sTL * 8 + sTR * 4 + sBR * 2 + sBL;
      if (caseIndex === 0 || caseIndex === 15) continue; // cell entirely one sign — no crossing

      const px0 = i * STEP;
      const px1 = (i + 1) * STEP;
      const py0 = j * STEP;
      const py1 = (j + 1) * STEP;

      // Linear interpolation of the zero-crossing point along each of the 4 edges.
      const lerp = (v0: number, v1: number) => v0 / (v0 - v1);
      const T: [number, number] = [px0 + lerp(vTL, vTR) * STEP, py0];
      const B: [number, number] = [px0 + lerp(vBL, vBR) * STEP, py1];
      const L: [number, number] = [px0, py0 + lerp(vTL, vBL) * STEP];
      const R: [number, number] = [px1, py0 + lerp(vTR, vBR) * STEP];

      const drawSeg = (p1: [number, number], p2: [number, number]) => {
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      };

      // Standard marching-squares case table (ambiguous cases 5 & 10 each
      // pick one of the two possible diagonal pairings — a minor visual
      // simplification that's imperceptible at this grid resolution).
      switch (caseIndex) {
        case 1: drawSeg(L, B); break;
        case 2: drawSeg(B, R); break;
        case 3: drawSeg(L, R); break;
        case 4: drawSeg(T, R); break;
        case 5: drawSeg(T, L); drawSeg(B, R); break;
        case 6: drawSeg(T, B); break;
        case 7: drawSeg(T, L); break;
        case 8: drawSeg(T, L); break;
        case 9: drawSeg(T, B); break;
        case 10: drawSeg(T, R); drawSeg(L, B); break;
        case 11: drawSeg(T, R); break;
        case 12: drawSeg(L, R); break;
        case 13: drawSeg(B, R); break;
        case 14: drawSeg(L, B); break;
        default: break;
      }
    }
  }

  ctx.stroke();
}
