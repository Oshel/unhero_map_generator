import { useRef } from 'react';
import type { ValidationReport } from '../validate/validate';
import { Section } from './controls';

export interface RightPanelProps {
  report: ValidationReport;
  json: string;
  onExport: () => void;
  onCopy: () => void;
  onImportFile: (file: File) => void;
  onLoadTileset: (files: FileList) => void;
  tilesetName: string | null;
  tilesetNotes: string[];
  onClearTileset: () => void;
  message: { kind: 'ok' | 'error'; text: string } | null;
}

export function RightPanel(props: RightPanelProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const tilesetRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel right">
      <Section title="Validation">
        <div className={props.report.ok ? 'verdict ok' : 'verdict bad'}>
          {props.report.ok ? 'PASSES' : 'FAILS'}
        </div>
        <ul className="checks">
          {props.report.checks.map((c) => (
            <li key={c.id} className={c.ok ? 'check ok' : 'check bad'}>
              <span className="check-mark">{c.ok ? '+' : '!'}</span>
              <span>
                <strong>{c.label}</strong>
                <br />
                <span className="check-msg">{c.message}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Export / import">
        <div className="row wrap">
          <button type="button" className="primary" onClick={props.onExport}>
            Download JSON
          </button>
          <button type="button" onClick={props.onCopy}>
            Copy JSON
          </button>
          <button type="button" onClick={() => importRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) props.onImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
        {props.message ? (
          <p className={props.message.kind === 'ok' ? 'note ok' : 'note bad'}>{props.message.text}</p>
        ) : null}
      </Section>

      <Section title="Tileset (optional)">
        <div className="row wrap">
          <button type="button" onClick={() => tilesetRef.current?.click()}>
            Load folder
          </button>
          {props.tilesetName ? (
            <button type="button" onClick={props.onClearTileset}>
              Use colours
            </button>
          ) : null}
        </div>
        <input
          ref={tilesetRef}
          type="file"
          hidden
          multiple
          // @ts-expect-error - non-standard but supported in Chromium and Firefox
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) props.onLoadTileset(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="note">
          {props.tilesetName
            ? `Using "${props.tilesetName}"`
            : 'Flat colours per role. Pick a folder with tiles.json + PNGs to preview real art.'}
        </p>
        {props.tilesetNotes.length > 0 ? (
          <ul className="notes">
            {props.tilesetNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="JSON">
        <textarea className="json" readOnly value={props.json} spellCheck={false} />
      </Section>
    </div>
  );
}
