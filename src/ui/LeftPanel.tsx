import type { ExitSide, ExitType, RoomRole } from '../types/prefab';
import { EXIT_SIDES, EXIT_TYPES, ROOM_ROLES } from '../types/prefab';
import type { PrefabMeta } from '../types/editor';
import type { MapRunInfo, Mode, RunInfo } from '../App';
import {
  clampMapSize,
  MAP_SIZE_PRESETS,
  MAX_MAP,
  MIN_MAP,
  type MapParams,
} from '../map/types';
import { profileById, SUBBIOME_PROFILES } from '../gen/profiles';
import {
  LAYOUT_STYLES,
  MAX_SIZE,
  MIN_SIZE,
  SIZE_PRESETS,
  type GenParams,
  type LayoutStyle,
  clampSubRoom,
  MAX_SUBROOM_FLOOR,
  MIN_SUBROOM_FLOOR,
} from '../gen/params';
import { Field, NumberField, Section, Segmented, Select, Slider, TextField, Toggle } from './controls';

export interface LeftPanelProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  mapParams: MapParams;
  setMapParams: (updater: (p: MapParams) => MapParams) => void;
  mapRun: MapRunInfo | null;
  params: GenParams;
  setParams: (updater: (p: GenParams) => GenParams) => void;
  meta: PrefabMeta;
  setMeta: (updater: (m: PrefabMeta) => PrefabMeta) => void;
  seed: number;
  setSeed: (seed: number) => void;
  onGenerate: () => void;
  onNewSeed: () => void;
  lastRun: RunInfo | null;
}

const SIDE_LABELS: Record<ExitSide, string> = { n: 'North', e: 'East', s: 'South', w: 'West' };

export function LeftPanel(props: LeftPanelProps) {
  const { params, setParams, meta, setMeta } = props;

  const setExit = (side: ExitSide, patch: Partial<GenParams['exits']['sides'][ExitSide]>) =>
    setParams((p) => ({
      ...p,
      exits: { ...p.exits, sides: { ...p.exits.sides, [side]: { ...p.exits.sides[side], ...patch } } },
    }));

  return (
    <div className="panel left">
      <Section title="Generation">
        <Segmented<Mode>
          value={props.mode}
          options={[
            { value: 'room', label: 'One room' },
            { value: 'map', label: 'Whole map' },
          ]}
          onChange={props.setMode}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="primary" onClick={props.onGenerate}>
            Generate
          </button>
          <button type="button" onClick={props.onNewSeed}>
            New seed
          </button>
        </div>
        <Field label="Seed">
          <NumberField value={props.seed} min={0} onChange={(v) => props.setSeed(v >>> 0)} />
        </Field>
        {props.mode === 'map' ? (
          props.mapRun ? (
            <p className="note">
              Seed {props.mapRun.seed}, {props.mapRun.attempts} attempt(s). {props.mapRun.rooms}{' '}
              rooms, {props.mapRun.links} doors between them.
            </p>
          ) : (
            <p className="note">Roll a seed to lay out a whole map.</p>
          )
        ) : props.lastRun ? (
          <p className="note">
            Seed {props.lastRun.seed}, {props.lastRun.attempts} attempt(s).
            <br />
            Exits:{' '}
            {props.lastRun.resolved.exits.length === 0
              ? 'none'
              : props.lastRun.resolved.exits
                  .map((e) => `${e.side}${e.width}@${e.offset} ${e.type}`)
                  .join(', ')}
            <br />
            Layout: {props.lastRun.resolved.style}, claustrophobia{' '}
            {props.lastRun.resolved.claustrophobia}%
            <br />
            Rolled: obstacles {props.lastRun.resolved.obstacleDensity}%, water{' '}
            {props.lastRun.resolved.water.enabled
              ? `${props.lastRun.resolved.water.density}%`
              : 'off'}
            , pits{' '}
            {props.lastRun.resolved.pits.enabled
              ? `${props.lastRun.resolved.pits.density}%`
              : 'off'}
            .
          </p>
        ) : (
          <p className="note">Same seed and parameters always produce the same room.</p>
        )}
      </Section>

      {props.mode === 'map' ? (
        <>
          <Section title="Map size">
            <div className="row wrap">
              {MAP_SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={
                    props.mapParams.size.w === p.size.w && props.mapParams.size.h === p.size.h
                      ? 'chip active'
                      : 'chip'
                  }
                  onClick={() => props.setMapParams((prev) => ({ ...prev, size: { ...p.size } }))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="row">
              <Field label="Width" hint="tiles">
                <NumberField
                  value={props.mapParams.size.w}
                  min={MIN_MAP}
                  max={MAX_MAP}
                  onChange={(v) =>
                    props.setMapParams((prev) => ({
                      ...prev,
                      size: clampMapSize({ ...prev.size, w: v }),
                    }))
                  }
                />
              </Field>
              <Field label="Height" hint="tiles">
                <NumberField
                  value={props.mapParams.size.h}
                  min={MIN_MAP}
                  max={MAX_MAP}
                  onChange={(v) =>
                    props.setMapParams((prev) => ({
                      ...prev,
                      size: clampMapSize({ ...prev.size, h: v }),
                    }))
                  }
                />
              </Field>
            </div>
            <p className="note">
              Any size from {MIN_MAP} to {MAX_MAP} tiles a side. Rooms tile the map edge to edge, so
              whatever does not divide into whole rooms is left as an even margin around the grid.
            </p>
            <Field label="Room size" hint="every room on the grid">
              <Segmented<'random' | 'fixed'>
                value={props.mapParams.roomSize.mode}
                options={[
                  { value: 'fixed', label: 'fixed' },
                  { value: 'random', label: 'rolled' },
                ]}
                onChange={(v) =>
                  props.setMapParams((prev) => ({
                    ...prev,
                    roomSize: { ...prev.roomSize, mode: v },
                  }))
                }
              />
            </Field>
            {props.mapParams.roomSize.mode === 'fixed' ? (
              <div className="row">
                <Field label="Width">
                  <NumberField
                    value={props.mapParams.roomSize.w}
                    min={12}
                    max={48}
                    onChange={(v) =>
                      props.setMapParams((prev) => ({ ...prev, roomSize: { ...prev.roomSize, w: v } }))
                    }
                  />
                </Field>
                <Field label="Height">
                  <NumberField
                    value={props.mapParams.roomSize.h}
                    min={12}
                    max={48}
                    onChange={(v) =>
                      props.setMapParams((prev) => ({ ...prev, roomSize: { ...prev.roomSize, h: v } }))
                    }
                  />
                </Field>
              </div>
            ) : (
              <p className="note">The seed picks one box and every room on the grid uses it.</p>
            )}
            <Field label="Smallest sub-room" hint="floor tiles a side">
              <NumberField
                value={props.mapParams.minSubRoom}
                min={MIN_SUBROOM_FLOOR}
                max={MAX_SUBROOM_FLOOR}
                onChange={(v) =>
                  props.setMapParams((prev) => ({ ...prev, minSubRoom: clampSubRoom(v) }))
                }
              />
            </Field>
            <p className="note">
              Rooms cut into sub-rooms never go below this. {MIN_SUBROOM_FLOOR} is a warren of
              cupboards, {MAX_SUBROOM_FLOOR} leaves a handful of halls. Styles that scatter obstacles
              rather than cut rooms ignore it.
            </p>
            <Field label="Extra doors" hint="beyond the minimum that connects everything">
              <Slider
                value={props.mapParams.loopiness}
                onChange={(v) => props.setMapParams((prev) => ({ ...prev, loopiness: v }))}
              />
            </Field>
            {props.mapRun ? (
              <p className="note">
                Grid: {props.mapRun.cols} x {props.mapRun.rows} = {props.mapRun.rooms} rooms of{' '}
                {props.mapRun.cell.w} x {props.mapRun.cell.h}.
              </p>
            ) : null}
          </Section>

          <Section title="Subbiome">
            <Field label="Profile">
              <Select<string>
                value={props.mapParams.profile}
                options={SUBBIOME_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(v) => props.setMapParams((prev) => ({ ...prev, profile: v }))}
              />
            </Field>
            <p className="note">
              Every room of a map belongs to this subbiome. Layout style and claustrophobia are
              laid out across the whole grid at once rather than rolled room by room: no two rooms
              you can walk between are the same kind of space, and each option still gets about the
              same share of the map. The dungeon gets exactly one entrance and one exit, both
              running to the map edge, and the exit always sits in the final arena.
            </p>
          </Section>

          <Section title="Markers per room">
            <div className="row">
              <Field label="Spawn">
                <NumberField
                  value={props.mapParams.markers.spawn}
                  min={0}
                  max={20}
                  onChange={(v) =>
                    props.setMapParams((p) => ({ ...p, markers: { ...p.markers, spawn: v } }))
                  }
                />
              </Field>
              <Field label="Loot">
                <NumberField
                  value={props.mapParams.markers.loot}
                  min={0}
                  max={20}
                  onChange={(v) =>
                    props.setMapParams((p) => ({ ...p, markers: { ...p.markers, loot: v } }))
                  }
                />
              </Field>
              <Field label="Prop">
                <NumberField
                  value={props.mapParams.markers.prop}
                  min={0}
                  max={40}
                  onChange={(v) =>
                    props.setMapParams((p) => ({ ...p, markers: { ...p.markers, prop: v } }))
                  }
                />
              </Field>
            </div>
          </Section>
        </>
      ) : (
        <>
      <Section title="Size">
        <div className="row wrap">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={
                params.size.w === p.size.w && params.size.h === p.size.h ? 'chip active' : 'chip'
              }
              onClick={() => setParams((prev) => ({ ...prev, size: { ...p.size } }))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="row">
          <Field label="Width">
            <NumberField
              value={params.size.w}
              min={MIN_SIZE}
              max={MAX_SIZE}
              onChange={(v) =>
                setParams((p) => ({
                  ...p,
                  size: { ...p.size, w: Math.max(MIN_SIZE, Math.min(MAX_SIZE, v)) },
                }))
              }
            />
          </Field>
          <Field label="Height">
            <NumberField
              value={params.size.h}
              min={MIN_SIZE}
              max={MAX_SIZE}
              onChange={(v) =>
                setParams((p) => ({
                  ...p,
                  size: { ...p.size, h: Math.max(MIN_SIZE, Math.min(MAX_SIZE, v)) },
                }))
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Layout">
        <Field label="Room role">
          <Select<RoomRole>
            value={params.roomRole}
            options={ROOM_ROLES}
            onChange={(v) => {
              setParams((p) => ({ ...p, roomRole: v }));
              setMeta((m) => ({ ...m, role: v }));
            }}
          />
        </Field>
        <Field label="Subbiome profile">
          <Select<string>
            value={params.profile}
            options={SUBBIOME_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(v) => setParams((p) => ({ ...p, profile: v }))}
          />
        </Field>
        <Toggle
          checked={params.style.auto}
          label="Style from the profile"
          onChange={(v) => setParams((p) => ({ ...p, style: { ...p.style, auto: v } }))}
        />
        {params.style.auto ? null : (
          <Field label="Style">
            <Select<LayoutStyle>
              value={params.style.value}
              options={LAYOUT_STYLES}
              onChange={(v) => setParams((p) => ({ ...p, style: { ...p.style, value: v } }))}
            />
          </Field>
        )}
        <Field label="Smallest sub-room" hint="floor tiles a side">
          <NumberField
            value={params.minSubRoom}
            min={MIN_SUBROOM_FLOOR}
            max={MAX_SUBROOM_FLOOR}
            onChange={(v) => setParams((p) => ({ ...p, minSubRoom: clampSubRoom(v) }))}
          />
        </Field>
        <Toggle
          checked={params.claustrophobia.auto}
          label="Claustrophobia from the profile"
          onChange={(v) =>
            setParams((p) => ({ ...p, claustrophobia: { ...p.claustrophobia, auto: v } }))
          }
        />
        {params.claustrophobia.auto ? (
          <p className="note">
            {profileById(params.profile).claustrophobia[0]}-
            {profileById(params.profile).claustrophobia[1]}% for this profile. 0 is an open hall,
            100 a warren of 4-tile corridors.
          </p>
        ) : (
          <Field label="Claustrophobia">
            <Slider
              value={params.claustrophobia.value}
              onChange={(v) =>
                setParams((p) => ({ ...p, claustrophobia: { ...p.claustrophobia, value: v } }))
              }
            />
          </Field>
        )}
        <Toggle
          checked={params.obstacleDensity.auto}
          label="Obstacle density from the profile"
          onChange={(v) =>
            setParams((p) => ({ ...p, obstacleDensity: { ...p.obstacleDensity, auto: v } }))
          }
        />
        {params.obstacleDensity.auto ? null : (
          <Field label="Obstacle density">
            <Slider
              value={params.obstacleDensity.value}
              onChange={(v) =>
                setParams((p) => ({ ...p, obstacleDensity: { ...p.obstacleDensity, value: v } }))
              }
            />
          </Field>
        )}
      </Section>

      <Section title="Exits">
        <Toggle
          checked={params.exits.auto}
          label="Sides and widths from the seed"
          onChange={(v) => setParams((p) => ({ ...p, exits: { ...p.exits, auto: v } }))}
        />
        {params.exits.auto ? (
          <p className="note">
            How many exits follows the room role: dead_end one, corridor two opposite, arena two to
            four, normal two to four. Every exit is 2 tiles wide.
          </p>
        ) : (
          EXIT_SIDES.map((side) => {
            const cfg = params.exits.sides[side];
            return (
              <div key={side} className="exit-row">
                <Toggle
                  checked={cfg.enabled}
                  label={SIDE_LABELS[side]}
                  onChange={(v) => setExit(side, { enabled: v })}
                />
                {cfg.enabled ? (
                  <div className="row">
                    <Select<ExitType>
                      value={cfg.type}
                      options={EXIT_TYPES}
                      onChange={(v) => setExit(side, { type: v })}
                    />
                    <input
                      type="number"
                      className="offset"
                      placeholder="auto"
                      value={cfg.offset ?? ''}
                      onChange={(e) =>
                        setExit(side, {
                          offset: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Section>

      <Section title="Water and pits">
        <Toggle
          checked={params.water.auto && params.pits.auto}
          label="Let the seed decide both"
          onChange={(v) =>
            setParams((p) => ({
              ...p,
              water: { ...p.water, auto: v },
              pits: { ...p.pits, auto: v },
            }))
          }
        />
        {params.water.auto && params.pits.auto ? (
          <p className="note">
            Water appears in about 40% of rooms at 10-45% density, pits in about 30% at 10-40%.
          </p>
        ) : (
          <>
            <Toggle
              checked={params.water.enabled}
              label="Water"
              onChange={(v) =>
                setParams((p) => ({ ...p, water: { ...p.water, auto: false, enabled: v } }))
              }
            />
            {params.water.enabled ? (
              <Slider
                value={params.water.density}
                onChange={(v) => setParams((p) => ({ ...p, water: { ...p.water, density: v } }))}
              />
            ) : null}
            <Toggle
              checked={params.pits.enabled}
              label="Pits"
              onChange={(v) =>
                setParams((p) => ({ ...p, pits: { ...p.pits, auto: false, enabled: v } }))
              }
            />
            {params.pits.enabled ? (
              <Slider
                value={params.pits.density}
                onChange={(v) => setParams((p) => ({ ...p, pits: { ...p.pits, density: v } }))}
              />
            ) : null}
          </>
        )}
      </Section>

      <Section title="Markers">
        <div className="row">
          <Field label="Spawn">
            <NumberField
              value={params.markers.spawn}
              min={0}
              max={40}
              onChange={(v) => setParams((p) => ({ ...p, markers: { ...p.markers, spawn: v } }))}
            />
          </Field>
          <Field label="Loot">
            <NumberField
              value={params.markers.loot}
              min={0}
              max={40}
              onChange={(v) => setParams((p) => ({ ...p, markers: { ...p.markers, loot: v } }))}
            />
          </Field>
          <Field label="Prop">
            <NumberField
              value={params.markers.prop}
              min={0}
              max={80}
              onChange={(v) => setParams((p) => ({ ...p, markers: { ...p.markers, prop: v } }))}
            />
          </Field>
        </div>
      </Section>

        </>
      )}

      <Section title="Prefab metadata">
        <Field label="id">
          <TextField value={meta.id} onChange={(v) => setMeta((m) => ({ ...m, id: v }))} />
        </Field>
        <Field label="biome_tags" hint="comma separated">
          <TextField
            value={meta.biome_tags.join(', ')}
            onChange={(v) =>
              setMeta((m) => ({
                ...m,
                biome_tags: v.split(',').map((s) => s.trim()).filter(Boolean),
              }))
            }
          />
        </Field>
        <Field label="subbiome_tags" hint="comma separated">
          <TextField
            value={meta.subbiome_tags.join(', ')}
            onChange={(v) =>
              setMeta((m) => ({
                ...m,
                subbiome_tags: v.split(',').map((s) => s.trim()).filter(Boolean),
              }))
            }
          />
        </Field>
        <div className="row">
          <Field label="weight">
            <NumberField value={meta.weight} min={0} onChange={(v) => setMeta((m) => ({ ...m, weight: v }))} />
          </Field>
          <Field label="min_depth">
            <NumberField
              value={meta.constraints.min_depth}
              min={0}
              onChange={(v) =>
                setMeta((m) => ({ ...m, constraints: { ...m.constraints, min_depth: v } }))
              }
            />
          </Field>
        </div>
        <div className="row">
          <Field label="max_per_level">
            <NumberField
              value={meta.constraints.max_per_level}
              min={0}
              onChange={(v) =>
                setMeta((m) => ({ ...m, constraints: { ...m.constraints, max_per_level: v } }))
              }
            />
          </Field>
          <Field label="min_players">
            <NumberField
              value={meta.constraints.min_players}
              min={1}
              max={7}
              onChange={(v) =>
                setMeta((m) => ({ ...m, constraints: { ...m.constraints, min_players: v } }))
              }
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
