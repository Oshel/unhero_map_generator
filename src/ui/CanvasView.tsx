import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorView, RoomDoc } from '../types/editor';
import type { ValidationReport } from '../validate/validate';
import { drawRoom, type Fixture } from '../render/drawRoom';
import { BASE_TILE_PX } from '../render/palette';
import type { Tileset } from '../render/tileset';

export interface CanvasViewProps {
  doc: RoomDoc;
  view: EditorView;
  setView: (updater: (v: EditorView) => EditorView) => void;
  report: ValidationReport | null;
  tileset: Tileset | null;
  fixtures: Fixture[];
  onViewport?: (size: { w: number; h: number }) => void;
}

interface PanState {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
}

/** Read-only preview: pan, zoom, inspect. Rooms come from the generator. */
export function CanvasView(props: CanvasViewProps) {
  const { doc, view, setView, report, tileset, fixtures } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanState | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => setCanvasSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    // A pane that was hidden while it resized can leave the observer behind.
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    props.onViewport?.(canvasSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    // Self-heal: a pane that resizes while hidden can leave the observer behind,
    // and the canvas would stay at its stale size until something else changed.
    if (wrap.clientWidth !== canvasSize.w || wrap.clientHeight !== canvasSize.h) {
      setCanvasSize({ w: wrap.clientWidth, h: wrap.clientHeight });
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvasSize.w * dpr));
    canvas.height = Math.max(1, Math.floor(canvasSize.h * dpr));
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    drawRoom(g, { doc, view, report, tileset, hover, fixtures, dpr });
  }, [doc, view, report, tileset, hover, fixtures, canvasSize]);

  const toTile = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const tile = BASE_TILE_PX * view.zoom;
    return {
      x: Math.floor((e.clientX - rect.left - view.panX) / tile),
      y: Math.floor((e.clientY - rect.top - view.panY) / tile),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: view.panX,
      panY: view.panY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setHover(toTile(e));
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({
      ...v,
      panX: pan.panX + (e.clientX - pan.startX),
      panY: pan.panY + (e.clientY - pan.startY),
    }));
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const zoom = Math.max(0.25, Math.min(4, v.zoom * factor));
      const ratio = zoom / v.zoom;
      return { ...v, zoom, panX: mx - (mx - v.panX) * ratio, panY: my - (my - v.panY) * ratio };
    });
  };

  const tileAt = (x: number, y: number): string => {
    if (x < 0 || y < 0 || x >= doc.size.w || y >= doc.size.h) return 'outside';
    const ground = doc.layers.ground[y][x];
    const blocking = doc.layers.blocking[y][x];
    return blocking === 'void' ? ground : `${ground} + ${blocking}`;
  };

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          panRef.current = null;
        }}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="canvas-hud">
        {hover ? `${hover.x}, ${hover.y} · ${tileAt(hover.x, hover.y)}` : '-'} &middot; zoom{' '}
        {Math.round(view.zoom * 100)}%
      </div>
    </div>
  );
}
