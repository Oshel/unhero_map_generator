import { useState, type ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <span className="hint"> {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/**
 * A number you can actually type into.
 *
 * Clamping on every keystroke fights the typist: the first digit of 137 is 1,
 * which a field with a floor of 32 immediately rewrites to 32, and the rest of
 * the number lands on top of that. So the keystrokes go into a draft and the
 * value is only clamped and handed over when the field is left or Enter is
 * pressed. An empty or nonsense draft falls back to the value that was there.
 */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string): void => {
    setDraft(null);
    const next = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(next)) return;
    let clamped = next;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange(clamped);
  };

  return (
    <input
      type="number"
      value={draft ?? String(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

export function TextField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{value}%</span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[] | ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o as T, label: o } : (o as { value: T; label: string }),
  );
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
