import type { LayoutStyle } from '../params';
import type { StyleFn } from './context';
import { openStyle } from './open';
import { organicStyle } from './organic';
import { roomsInRoomStyle } from './roomsInRoom';

export const STYLE_REGISTRY: Record<LayoutStyle, StyleFn> = {
  open: openStyle,
  rooms_in_room: roomsInRoomStyle,
  organic: organicStyle,
};

export type { StyleContext, StyleFn } from './context';
