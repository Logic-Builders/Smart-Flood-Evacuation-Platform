import { Platform } from 'react-native';

export { BASE_URL } from './env';

export const ZONE_FILL: Record<string, string> = {
  NORMAL: 'rgba(52,168,83,0.15)', WATCH: 'rgba(251,188,4,0.20)',
  WARNING: 'rgba(255,109,0,0.25)', EXTREME: 'rgba(234,67,53,0.32)',
};
export const ZONE_STROKE: Record<string, string> = {
  NORMAL: '#34a853', WATCH: '#fbbc04', WARNING: '#ff6d00', EXTREME: '#ea4335',
};

export type Coord = { latitude: number; longitude: number };
export type FloodZone = {
  id: string; gauge_id: string;
  severity: 'NORMAL' | 'WATCH' | 'WARNING' | 'EXTREME';
  boundary: { coordinates: Coord[] };
};

export const REPORT_TYPES = [
  { value: 'FLOODED_ROAD',   label: 'Flooded\nRoad',   icon: 'water'         },
  { value: 'DAMAGED_BRIDGE', label: 'Damaged\nBridge', icon: 'bridge'        },
  { value: 'BLOCKED_ROAD',   label: 'Blocked\nRoad',   icon: 'alert-octagon' },
] as const;
export type ReportType = typeof REPORT_TYPES[number]['value'];

export const SEV_COLOR  = (n: number) => ['', '#059669', '#65a30d', '#d97706', '#ea580c', '#dc2626'][n];
export const SEV_LABEL  = ['', 'Very Low', 'Low', 'Medium', 'High', 'Critical'];
export const SEV_DESC   = ['', 'Minor puddles, passable', 'Passable with care', 'Difficult to pass', 'Dangerous conditions', 'Completely impassable'];

export const C = {
  bg:         '#EEF4FF',
  card:       'rgba(255,255,255,0.72)',
  cardHi:     'rgba(255,255,255,0.90)',
  border:     'rgba(30,58,138,0.10)',
  borderHi:   'rgba(30,58,138,0.30)',
  blue:       '#1E3A8A',
  blueMid:    '#3B82F6',
  blueSoft:   'rgba(59,130,246,0.12)',
  red:        '#DC2626',
  redSoft:    'rgba(220,38,38,0.10)',
  text:       '#0F172A',
  textMid:    '#475569',
  textDim:    '#94A3B8',
  white:      '#FFFFFF',
};

export const FONT = Platform.select({ ios: 'SF Pro Display', android: 'sans-serif-medium', default: 'System' });
export const MONO = Platform.select({ ios: 'SF Mono', android: 'monospace', default: 'monospace' });

export default {};