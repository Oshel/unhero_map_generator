import type { EditorView } from '../types/editor';

export interface ToolbarProps {
  view: EditorView;
  setView: (updater: (v: EditorView) => EditorView) => void;
  onFit: () => void;
}

const TOGGLES: Array<[keyof EditorView['visibility'], string]> = [
  ['ground', 'ground'],
  ['blocking', 'blocking'],
  ['deco', 'deco'],
  ['overlay', 'overlay'],
  ['decals', 'decals'],
  ['fixtures', 'doors'],
  ['markers', 'markers'],
  ['exits', 'exits'],
  ['route', 'route'],
  ['grid', 'grid'],
  ['chunkLines', '8-tile lines'],
  ['validation', 'problems'],
];

export function Toolbar(props: ToolbarProps) {
  const { view, setView } = props;
  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <span className="toolbar-label">Show</span>
        {TOGGLES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={view.visibility[key] ? 'chip active' : 'chip'}
            onClick={() =>
              setView((s) => ({ ...s, visibility: { ...s.visibility, [key]: !s.visibility[key] } }))
            }
          >
            {label}
          </button>
        ))}
        <div className="spacer" />
        <button type="button" onClick={props.onFit}>
          Fit
        </button>
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, zoom: 1, panX: 24, panY: 24 }))}
        >
          100%
        </button>
      </div>
    </div>
  );
}
