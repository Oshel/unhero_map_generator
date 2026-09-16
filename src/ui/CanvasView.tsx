import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorView, RoomDoc } from '../types/editor';
import type { ValidationReport } from '../validate/validate';
import { drawRoom, type Fixture } from '../render/drawRoom';
import { BASE_TILE_PX } from '../render/palette';
import type { Tileset } from '../render/tileset';
import { MAX_ZOOM, minZoom } from '../render/zoom';

export interface CanvasViewProps {
  doc: RoomDoc;
  view: EditorView;
  setView: (updater: (v: EditorView) => EditorView) => void;
  report: ValidationReport | null;
  tileset: Tileset | null;
  fixtures: Fixture[];
  /** The shortest way from the entrance to the exit, tile by tile. */
  route: Array<[number, number]>;
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
  const { doc, view, setView, report, tileset, fixtures, route } = props;
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
    drawRoom(g, { doc, view, report, tileset, hover, fixtures, route, dpr });
  }, [doc, view, report, tileset, hover, fixtures, route, canvasSize]);

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

  // A big map has to zoom out further than a small one, or half of it stays
  // off screen at the floor.
  const floor = minZoom(doc.size, canvasSize);

  /** Zoom about a point, keeping whatever is under it where it is. */
  const zoomTo = (next: number, ax: number, ay: number): void => {
    setView((v) => {
      const zoom = Math.max(floor, Math.min(MAX_ZOOM, next));
      const ratio = zoom / v.zoom;
      return { ...v, zoom, panX: ax - (ax - v.panX) * ratio, panY: ay - (ay - v.panY) * ratio };
    });
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    zoomTo(view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), mx, my);
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
      <div className="canvas-zoom">
        <input
          type="range"
          min={Math.round(Math.log2(floor) * 100)}
          max={Math.round(Math.log2(MAX_ZOOM) * 100)}
          value={Math.round(Math.log2(Math.max(floor, view.zoom)) * 100)}
          // The slider is logarithmic: 25% to 400% on a linear track spends most
          // of its length above 1x, where a nudge does nothing you can see.
          onChange={(e) => {
            const zoom = Math.pow(2, Number(e.target.value) / 100);
            zoomTo(zoom, canvasSize.w / 2, canvasSize.h / 2);
          }}
          aria-label="Zoom"
        />
        <button
          type="button"
          onClick={() => zoomTo(1, canvasSize.w / 2, canvasSize.h / 2)}
          title="Back to 100%"
        >
          {Math.round(view.zoom * 100)}%
        </button>
      </div>
      <div className="canvas-hud">
        {hover ? `${hover.x}, ${hover.y} · ${tileAt(hover.x, hover.y)}` : '-'}
      </div>
    </div>
  );
}
