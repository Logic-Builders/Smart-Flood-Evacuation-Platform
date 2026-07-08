import { Platform } from 'react-native';
export { BASE_URL } from './env';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Coord = { latitude: number; longitude: number };

export type FloodZone = {
  id: string; gauge_id: string;
  severity: 'NORMAL' | 'WATCH' | 'WARNING' | 'EXTREME';
  boundary: { coordinates: Coord[] };
};

export type HazardReport = {
  id: string; location: Coord;
  report_type: 'FLOODED_ROAD' | 'DAMAGED_BRIDGE' | 'BLOCKED_ROAD';
  severity: number; description: string; expires_at: string;
};

export type NavStep = {
  maneuver: {
    instruction?: string;
    type: string;
    modifier?: string;
    location: [number, number];
  };
  name: string;
  distance: number;
  duration: number;
};

export type RouteSegment = { coords: Coord[]; risk: 'safe' | 'watch' | 'warning' | 'extreme' };

export type RouteOption = {
  label: string; tag: 'fastest' | 'safest';
  coords: Coord[]; segments: RouteSegment[];
  steps: NavStep[];
  distance: number; duration: number;
  zonesHit: string[];
  detoured: boolean;
  color: string;
};

// ─── Design tokens ────────────────────────────────────────────────────────────

export const C = {
  primary:                '#005bbf',
  primaryContainer:       '#1a73e8',
  onPrimary:              '#ffffff',
  secondary:              '#006e2c',
  onSecondary:            '#ffffff',
  tertiary:               '#9e4100',
  error:                  '#ba1a1a',
  surface:                '#f8f9fa',
  surfaceContainer:       '#edeeef',
  surfaceContainerLow:    '#f3f4f5',
  surfaceContainerHigh:   '#e7e8e9',
  surfaceContainerLowest: '#ffffff',
  onSurface:              '#191c1d',
  onSurfaceVariant:       '#414754',
  outline:                '#727785',
  outlineVariant:         '#c1c6d6',
  surfaceDim:             '#d9dadb',
  warning:                '#ff6d00',
};

// ─── App constants ────────────────────────────────────────────────────────────

export const REFRESH_INTERVAL  = 60;
export const DETOUR_OFFSET_DEG = 0.008;
export const PROXIMITY_M       = 200;
export const TOP = Platform.OS === 'ios' ? 54 : 38;

// ─── Color maps ───────────────────────────────────────────────────────────────

export const ZONE_FILL: Record<string, string> = {
  NORMAL:  'rgba(0,110,44,0.10)',
  WATCH:   'rgba(158,65,0,0.16)',
  WARNING: 'rgba(255,109,0,0.20)',
  EXTREME: 'rgba(186,26,26,0.26)',
};
export const ZONE_STROKE: Record<string, string> = {
  NORMAL: '#006e2c', WATCH: '#9e4100', WARNING: '#ff6d00', EXTREME: '#ba1a1a',
};
export const ZONE_LABEL: Record<string, string> = {
  NORMAL: 'No Risk', WATCH: 'Watch', WARNING: 'Warning', EXTREME: 'Extreme',
};
export const ZONE_BADGE_BG: Record<string, string> = {
  NORMAL: '#e6f4ea', WATCH: '#fef7e0', WARNING: '#fff3e0', EXTREME: '#fce8e6',
};
export const ZONE_BADGE_TEXT: Record<string, string> = {
  NORMAL: '#137333', WATCH: '#7d4a00', WARNING: '#b34a00', EXTREME: '#b31412',
};
export const SEGMENT_COLOR: Record<RouteSegment['risk'], string> = {
  safe: '#006e2c', watch: '#9e4100', warning: '#ff6d00', extreme: '#ba1a1a',
};
export const HAZARD_ICON: Record<string, string> = {
  FLOODED_ROAD: '🌊', DAMAGED_BRIDGE: '🌉', BLOCKED_ROAD: '⚠️',
};
export const HAZARD_LABEL: Record<string, string> = {
  FLOODED_ROAD: 'Flooded Road', DAMAGED_BRIDGE: 'Damaged Bridge', BLOCKED_ROAD: 'Blocked Road',
};
export const HAZARD_COLOR: Record<string, string> = {
  FLOODED_ROAD: '#1a73e8', DAMAGED_BRIDGE: '#ff6d00', BLOCKED_ROAD: '#ba1a1a',
};
export const SEVERITY_ALERT: Record<string, { title: string; message: string; icon: string; bg: string; tc: string }> = {
  WATCH:   { title: '⚡ Flood Watch Active',  message: 'Flood conditions possible. Monitor and be prepared to evacuate.', icon: '👁',  bg: '#fef7e0', tc: '#7d4a00' },
  WARNING: { title: '🚨 Flood Warning',        message: 'Flooding expected. Avoid flood-prone areas and move to higher ground.', icon: '🚨', bg: '#fff3e0', tc: '#b34a00' },
  EXTREME: { title: '🆘 EXTREME FLOOD ALERT', message: 'Life-threatening flooding. EVACUATE IMMEDIATELY. Do not drive through floodwaters.', icon: '🆘', bg: '#fce8e6', tc: '#b31412' },
};

// ─── Mock fallback data ───────────────────────────────────────────────────────

export const MOCK_ZONES: FloodZone[] = [
  { id: 'z1', gauge_id: 'LK_KELANI_001', severity: 'WARNING',
    boundary: { coordinates: [
      { latitude: 7.2870, longitude: 80.6370 }, { latitude: 7.3050, longitude: 80.6370 },
      { latitude: 7.3050, longitude: 80.6550 }, { latitude: 7.2870, longitude: 80.6550 },
      { latitude: 7.2870, longitude: 80.6370 },
    ]}},
  { id: 'z2', gauge_id: 'LK_KALU_002', severity: 'EXTREME',
    boundary: { coordinates: [
      { latitude: 6.9200, longitude: 79.8600 }, { latitude: 6.9380, longitude: 79.8600 },
      { latitude: 6.9380, longitude: 79.8780 }, { latitude: 6.9200, longitude: 79.8780 },
      { latitude: 6.9200, longitude: 79.8600 },
    ]}},
  { id: 'z3', gauge_id: 'LK_MAHA_003', severity: 'WATCH',
    boundary: { coordinates: [
      { latitude: 7.4800, longitude: 80.3600 }, { latitude: 7.4980, longitude: 80.3600 },
      { latitude: 7.4980, longitude: 80.3780 }, { latitude: 7.4800, longitude: 80.3780 },
      { latitude: 7.4800, longitude: 80.3600 },
    ]}},
];

export const MOCK_REPORTS: HazardReport[] = [];

// Required by Expo Router
export default {};
