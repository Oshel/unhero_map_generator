import type { LayoutStyle } from '../params';
import type { StyleFn } from './context';
import { corridorsStyle } from './corridors';
import { openStyle } from './open';
import { organicStyle } from './organic';
import { pillarsStyle } from './pillars';
import { roomsInRoomStyle } from './roomsInRoom';
import { symmetricStyle } from './symmetric';

export const STYLE_REGISTRY: Record<LayoutStyle, StyleFn> = {
  open: openStyle,
  pillars: pillarsStyle,
  rooms_in_room: roomsInRoomStyle,
  organic: organicStyle,
  symmetric: symmetricStyle,
  corridors: corridorsStyle,
};

export type { StyleContext, StyleFn } from './context';
