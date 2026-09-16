import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorView, PrefabMeta, RoomDoc } from './types/editor';
import { defaultMeta } from './types/editor';
import { timeSeed } from './core/rng';
import { defaultParams, type GenParams, type ResolvedParams } from './gen/params';
import { generateRoom } from './gen/generate';
import { generateMap, mapFixtures, mapToDoc, shortestRoute } from './map/generateMap';

import { MAP_SIZE_PRESETS, type MapParams, type MapResult } from './map/types';
import { mapSummaryJson, mapToJson } from './io/exportMap';
import { validateRoom } from './validate/validate';
import { prefabToJson, toPrefab } from './io/exportPrefab';
import { ImportError, parsePrefab } from './io/importPrefab';
import { copyToClipboard, downloadText } from './io/download';
import { loadTilesetFromFiles, type Tileset } from './render/tileset';
import { DEFAULT_SUBROOM_FLOOR } from './gen/constants';
import { DEFAULT_PROFILE_ID } from './gen/profiles';
import { BASE_TILE_PX } from './render/palette';
import { fitZoom } from './render/zoom';
import { CanvasView } from './ui/CanvasView';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { Toolbar } from './ui/Toolbar';

function defaultView(): EditorView {
  return {
    zoom: 1,
    panX: 24,
    panY: 24,
    visibility: {
      ground: true,
      blocking: true,
      deco: true,
      overlay: true,
      decals: true,
      fixtures: true,
      markers: true,
      exits: true,
      route: true,
      grid: true,
      chunkLines: false,
      validation: true,
    },
  };
}

const INITIAL_SEED = 1337;

export interface RunInfo {
  seed: number;
  attempts: number;
  resolved: ResolvedParams;
}

export type Mode = 'room' | 'map';

export interface MapRunInfo {
  seed: number;
  attempts: number;
  rooms: number;
  links: number;
  cols: number;
  rows: number;
  cell: { w: number; h: number };
}

function defaultMapParams(): MapParams {
  return {
    size: { ...MAP_SIZE_PRESETS[1].size },
    roomSize: { mode: 'fixed', w: 24, h: 18 },
    profile: DEFAULT_PROFILE_ID,
    minSubRoom: DEFAULT_SUBROOM_FLOOR,
    loopiness: 25,
    markers: { spawn: 3, loot: 1, prop: 4 },
  };
}

export function App() {
  const [mode, setMode] = useState<Mode>('room');
  const [params, setParams] = useState<GenParams>(defaultParams);
  const [mapParams, setMapParams] = useState<MapParams>(defaultMapParams);
  const [meta, setMeta] = useState<PrefabMeta>(defaultMeta);
  const [seed, setSeed] = useState<number>(INITIAL_SEED);
  const [view, setView] = useState<EditorView>(defaultView);
  const [tileset, setTileset] = useState<Tileset | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });

  const initial = useMemo(() => generateRoom(defaultParams(), INITIAL_SEED, defaultMeta()), []);
  const [doc, setDoc] = useState<RoomDoc>(initial.doc);
  const [map, setMap] = useState<MapResult | null>(null);
  const [lastRun, setLastRun] = useState<RunInfo | null>({
    seed: initial.seed,
    attempts: initial.attempts,
    resolved: initial.resolved,
  });

  // In map mode the canvas, the report and the JSON all come from the map.
  const mapDoc = useMemo(() => (map ? mapToDoc(map.doc, meta) : null), [map, meta]);
  const shownDoc = mode === 'map' && mapDoc ? mapDoc : doc;

  const report = useMemo(() => {
    if (mode === 'map' && map) {
      const problemTiles = map.report.checks.filter((c) => !c.ok).flatMap((c) => c.tiles);
      return { ok: map.report.ok, checks: map.report.checks, problemTiles };
    }
    return validateRoom(doc);
  }, [mode, map, doc]);

  // Doors and gates are drawn from the layout, not stored in the tiles.
  const fixtures = useMemo(() => {
    if (mode === 'map' && map) return mapFixtures(map.doc);
    return doc.doors.map((door) => ({
      kind: 'door' as const,
      orientation: door.axis,
      x: door.x,
      y: door.y,
    }));
  }, [mode, map, doc]);

  // Only a map has a way in and a way out, so only a map has a route through.
  const route = useMemo(
    () => (mode === 'map' && map ? shortestRoute(map.doc) : []),
    [mode, map],
  );

  const json = useMemo(() => {
    if (mode === 'map' && map) return mapSummaryJson(map.doc, meta);
    return prefabToJson(toPrefab(doc));
  }, [mode, map, doc, meta]);

  // Metadata lives in the left panel, not in the generated grid.
  useEffect(() => {
    setDoc((d) => (d.meta === meta ? d : { ...d, meta }));
  }, [meta]);

  const runMap = useCallback(
    (withSeed: number) => {
      const result = generateMap(mapParams, withSeed, meta);
      setMap(result);
      setMessage(
        result.report.ok
          ? {
              kind: 'ok',
              text: `Map of ${result.doc.rooms.length} rooms and ${result.doc.links.length} corridors in ${result.attempts} attempt(s), seed ${result.seed}. Entrance to exit: ${shortestRoute(result.doc).length} tiles.`,
            }
          : {
              kind: 'error',
              text: `No fully explorable map after ${result.attempts} attempts - showing the best one.`,
            },
      );
    },
    [mapParams, meta],
  );

  const run = useCallback(
    (withSeed: number) => {
      if (mode === 'map') {
        runMap(withSeed);
        return;
      }
      const result = generateRoom(params, withSeed, meta);
      setDoc(result.doc);
      setLastRun({ seed: result.seed, attempts: result.attempts, resolved: result.resolved });
      setMessage(
        result.report.ok
          ? { kind: 'ok', text: `Generated in ${result.attempts} attempt(s), seed ${result.seed}.` }
          : {
              kind: 'error',
              text: `No valid room after ${result.attempts} attempts - showing the first one.`,
            },
      );
    },
    [mode, runMap, params, meta],
  );

  const handleGenerate = useCallback(() => run(seed), [run, seed]);

  const handleNewSeed = useCallback(() => {
    const next = timeSeed();
    setSeed(next);
    run(next);
  }, [run]);

  // Switching to map mode with nothing generated yet should show something.
  useEffect(() => {
    if (mode === 'map' && !map) runMap(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleFit = useCallback(() => {
    // Whatever it takes to see all of it: a 512 tile map needs to go well below
    // the zoom floor a single room is comfortable at, and centring on the
    // viewport is only centring if the document is allowed to be smaller than
    // it - clamping the pan to a margin pushed big maps off the left edge.
    const zoom = fitZoom(shownDoc.size, viewport);
    setView((v) => ({
      ...v,
      zoom,
      panX: (viewport.w - shownDoc.size.w * BASE_TILE_PX * zoom) / 2,
      panY: (viewport.h - shownDoc.size.h * BASE_TILE_PX * zoom) / 2,
    }));
  }, [shownDoc.size, viewport]);

  const handleExport = useCallback(() => {
    const name = meta.id || (mode === 'map' ? 'map' : 'room');
    const text = mode === 'map' && map ? mapToJson(map.doc, meta) : json;
    downloadText(`${name}.json`, text);
    setMessage({ kind: 'ok', text: `Saved ${name}.json` });
  }, [mode, map, meta, json]);

  const handleCopy = useCallback(async () => {
    const text = mode === 'map' && map ? mapToJson(map.doc, meta) : json;
    const ok = await copyToClipboard(text);
    setMessage({
      kind: ok ? 'ok' : 'error',
      text: ok ? 'JSON copied to the clipboard.' : 'Clipboard refused - use Download instead.',
    });
  }, [mode, map, meta, json]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const imported = parsePrefab(await file.text());
      setDoc(imported);
      setMeta(imported.meta);
      setParams((p) => ({ ...p, size: { ...imported.size }, roomRole: imported.meta.role }));
      setLastRun(null);
      setMessage({ kind: 'ok', text: `Imported ${file.name}` });
    } catch (err) {
      const text = err instanceof ImportError ? err.message : (err as Error).message;
      setMessage({ kind: 'error', text: `Import failed: ${text}` });
    }
  }, []);

  const handleTileset = useCallback(async (files: FileList) => {
    try {
      const loaded = await loadTilesetFromFiles(files);
      setTileset(loaded);
      setMessage({ kind: 'ok', text: `Tileset "${loaded.name}" loaded.` });
    } catch (err) {
      setTileset(null);
      setMessage({ kind: 'error', text: `Tileset not loaded: ${(err as Error).message}` });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key.toLowerCase() === 'g') {
        setView((v) => ({ ...v, visibility: { ...v.visibility, grid: !v.visibility.grid } }));
      } else if (e.key === ' ') {
        e.preventDefault();
        handleNewSeed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNewSeed]);

  return (
    <div className="app">
      <LeftPanel
        mode={mode}
        setMode={setMode}
        mapParams={mapParams}
        setMapParams={(u) => setMapParams((p) => u(p))}
        mapRun={
          map
            ? {
                seed: map.seed,
                attempts: map.attempts,
                rooms: map.doc.rooms.length,
                links: map.doc.links.length,
                cols: map.doc.cols,
                rows: map.doc.rows,
                cell: map.doc.cell,
              }
            : null
        }
        params={params}
        setParams={(u) => setParams((p) => u(p))}
        meta={meta}
        setMeta={(u) => setMeta((m) => u(m))}
        seed={seed}
        setSeed={setSeed}
        onGenerate={handleGenerate}
        onNewSeed={handleNewSeed}
        lastRun={lastRun}
      />

      <div className="center">
        <Toolbar view={view} setView={(u) => setView((v) => u(v))} onFit={handleFit} />
        <CanvasView
          doc={shownDoc}
          view={view}
          setView={(u) => setView((v) => u(v))}
          report={report}
          tileset={tileset}
          fixtures={fixtures}
          route={route}
          onViewport={setViewport}
        />
        <div className="statusbar">
          Drag to pan, wheel to zoom. Space rolls a new seed, G toggles the grid.{' '}
          {mode === 'map'
            ? 'Map mode: rooms, sizes, roles and styles are all rolled, and every room has to be reachable.'
            : 'Room mode: one prefab at a time.'}
        </div>
      </div>

      <RightPanel
        report={report}
        json={json}
        onExport={handleExport}
        onCopy={handleCopy}
        onImportFile={handleImport}
        onLoadTileset={handleTileset}
        tilesetName={tileset?.name ?? null}
        tilesetNotes={tileset?.notes ?? []}
        onClearTileset={() => setTileset(null)}
        message={message}
      />
    </div>
  );
}

export default App;
