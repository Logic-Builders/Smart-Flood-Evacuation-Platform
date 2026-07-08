import {
  C, DETOUR_OFFSET_DEG, PROXIMITY_M,
} from '../constants/mapConstants';
import type {
  Coord, FloodZone, HazardReport, NavStep, RouteOption, RouteSegment,
} from '../constants/mapConstants';

// ─── AbortSignal polyfill ─────────────────────────────────────────────────────

export function abortAfter(ms: number): AbortSignal {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  ctrl.signal.addEventListener('abort', () => clearTimeout(id));
  return ctrl.signal;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

export function pointInPolygon(pt: Coord, polygon: Coord[]): boolean {
  const { latitude: py, longitude: px } = pt;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { latitude: yi, longitude: xi } = polygon[i];
    const { latitude: yj, longitude: xj } = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function distM(a: Coord, b: Coord): number {
  const R = 6_371_000;
  const dLat = ((b.latitude  - a.latitude)  * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function minDistToZone(pt: Coord, zone: FloodZone): number {
  return Math.min(...zone.boundary.coordinates.map(c => distM(pt, c)));
}

export function routeIntersectsZones(coords: Coord[], zones: FloodZone[]): FloodZone[] {
  const hits = new Map<string, FloodZone>();
  for (const pt of coords)
    for (const z of zones)
      if (z.severity !== 'NORMAL' && !hits.has(z.id) && pointInPolygon(pt, z.boundary.coordinates))
        hits.set(z.id, z);
  return Array.from(hits.values());
}

export function computeDetourWaypoints(coords: Coord[], zone: FloodZone): Coord[] {
  const poly = zone.boundary.coordinates;
  let entryIdx = -1, exitIdx = -1;
  for (let i = 0; i < coords.length; i++) {
    if (pointInPolygon(coords[i], poly)) {
      if (entryIdx === -1) entryIdx = i;
      exitIdx = i;
    }
  }
  if (entryIdx === -1) return [];
  const centLat = poly.reduce((s, c) => s + c.latitude,  0) / poly.length;
  const centLon = poly.reduce((s, c) => s + c.longitude, 0) / poly.length;
  const midLat  = (coords[entryIdx].latitude  + coords[exitIdx].latitude)  / 2;
  const midLon  = (coords[entryIdx].longitude + coords[exitIdx].longitude) / 2;
  const dLat = midLat - centLat, dLon = midLon - centLon;
  const len  = Math.sqrt(dLat * dLat + dLon * dLon) || 0.001;
  const norm = { lat: dLat / len, lon: dLon / len };
  const lats = poly.map(c => c.latitude);
  const lons = poly.map(c => c.longitude);
  const halfDiag = Math.sqrt(
    (Math.max(...lats) - Math.min(...lats)) ** 2 +
    (Math.max(...lons) - Math.min(...lons)) ** 2
  ) / 2;
  const offset = halfDiag + DETOUR_OFFSET_DEG;
  const px = -norm.lon, py = norm.lat;
  return [
    { latitude: centLat + norm.lat * offset + px * offset * 0.6, longitude: centLon + norm.lon * offset + py * offset * 0.6 },
    { latitude: centLat + norm.lat * offset - px * offset * 0.6, longitude: centLon + norm.lon * offset - py * offset * 0.6 },
  ];
}

export function computeHazardDetourWaypoints(coords: Coord[], reports: HazardReport[]): Coord[] {
  const waypoints: Coord[] = [];
  const HAZARD_AVOID_M    = 400;
  const HAZARD_OFFSET_DEG = 0.004;
  for (const report of reports) {
    if (report.severity < 3 && report.report_type !== 'BLOCKED_ROAD') continue;
    if (!coords.find(c => distM(c, report.location) < HAZARD_AVOID_M)) continue;
    let closestIdx = 0, minD = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = distM(coords[i], report.location);
      if (d < minD) { minD = d; closestIdx = i; }
    }
    const prevPt = coords[Math.max(0, closestIdx - 1)];
    const nextPt = coords[Math.min(coords.length - 1, closestIdx + 1)];
    const rLat = nextPt.latitude  - prevPt.latitude;
    const rLon = nextPt.longitude - prevPt.longitude;
    const len  = Math.sqrt(rLat ** 2 + rLon ** 2) || 0.001;
    waypoints.push({
      latitude:  report.location.latitude  + (-rLon / len) * HAZARD_OFFSET_DEG,
      longitude: report.location.longitude + ( rLat / len) * HAZARD_OFFSET_DEG,
    });
  }
  return waypoints;
}

export function colorSegments(coords: Coord[], zones: FloodZone[]): RouteSegment[] {
  if (coords.length < 2) return [];
  const segs: RouteSegment[] = [];
  const riskOrder: Record<string, number> = { safe: 0, watch: 1, warning: 2, extreme: 3 };
  for (let i = 0; i < coords.length - 1; i++) {
    const mid: Coord = {
      latitude:  (coords[i].latitude  + coords[i + 1].latitude)  / 2,
      longitude: (coords[i].longitude + coords[i + 1].longitude) / 2,
    };
    let risk: RouteSegment['risk'] = 'safe';
    for (const z of zones) {
      if (z.severity === 'NORMAL') continue;
      const r = z.severity.toLowerCase() as RouteSegment['risk'];
      if (pointInPolygon(mid, z.boundary.coordinates) || minDistToZone(mid, z) < PROXIMITY_M)
        if (riskOrder[r] > riskOrder[risk]) risk = r;
    }
    if (segs.length && segs[segs.length - 1].risk === risk)
      segs[segs.length - 1].coords.push(coords[i + 1]);
    else
      segs.push({ coords: [coords[i], coords[i + 1]], risk });
  }
  return segs;
}

// ─── OSRM routing ─────────────────────────────────────────────────────────────

async function fetchOSRM(waypoints: Coord[]): Promise<any> {
  const wStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
  const res  = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${wStr}?overview=full&geometries=geojson&steps=true&alternatives=true`,
    { signal: abortAfter(12_000) }
  );
  return res.json();
}

export async function buildSafeRoute(
  start: Coord, end: Coord, zones: FloodZone[], hazards: HazardReport[]
): Promise<{ safest: RouteOption; fastest: RouteOption }> {
  const raw = await fetchOSRM([start, end]);
  if (!raw.routes?.length) throw new Error('No route found. Check your locations.');

  const rawRoute  = raw.routes[0];
  const rawCoords: Coord[] = rawRoute.geometry.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
  const hitZones  = routeIntersectsZones(rawCoords, zones);

  let safestCoords = rawCoords;
  let safestSteps: NavStep[] = rawRoute.legs[0].steps;
  let safestDist  = rawRoute.distance as number;
  let safestDur   = rawRoute.duration as number;
  let didDetour   = false;

  const floodDetours: Coord[] = [];
  for (const z of hitZones) floodDetours.push(...computeDetourWaypoints(rawCoords, z));
  const hazardDetours = computeHazardDetourWaypoints(rawCoords, hazards);
  const allDetours    = [...floodDetours, ...hazardDetours];
  const deduped: Coord[] = [];
  for (const wp of allDetours)
    if (!deduped.some(d => distM(d, wp) < 300)) deduped.push(wp);

  if (deduped.length > 0) {
    try {
      const detoured = await fetchOSRM([start, ...deduped, end]);
      if (detoured.routes?.length) {
        const dr = detoured.routes[0];
        safestCoords = dr.geometry.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
        safestSteps  = dr.legs.flatMap((l: any) => l.steps);
        safestDist   = dr.distance;
        safestDur    = dr.duration;
        didDetour    = true;
      }
    } catch (_) {}
  }

  const safestHits = routeIntersectsZones(safestCoords, zones);

  return {
    safest: {
      label: didDetour ? 'Flood-Avoiding Route' : 'Safe Route',
      tag: 'safest', color: C.secondary,
      coords: safestCoords, segments: colorSegments(safestCoords, zones),
      steps: safestSteps, distance: safestDist, duration: safestDur,
      zonesHit: safestHits.map(z => z.gauge_id), detoured: didDetour,
    },
    fastest: {
      label: 'Fastest Route', tag: 'fastest',
      color: hitZones.length ? C.tertiary : C.primaryContainer,
      coords: rawCoords, segments: colorSegments(rawCoords, zones),
      steps: rawRoute.legs[0].steps, distance: rawRoute.distance, duration: rawRoute.duration,
      zonesHit: hitZones.map(z => z.gauge_id), detoured: false,
    },
  };
}

// ─── Instruction builder ──────────────────────────────────────────────────────

export function buildInstruction(step: NavStep): string {
  if (step.maneuver.instruction) return step.maneuver.instruction;
  const road     = step.name ? `onto ${step.name}` : '';
  const modifier = step.maneuver.modifier ?? '';
  const type     = step.maneuver.type ?? '';
  switch (type) {
    case 'depart':          return step.name ? `Head ${modifier || 'forward'} on ${step.name}` : 'Depart';
    case 'arrive':          return 'You have arrived at your destination';
    case 'turn': {
      const dir = modifier.replace(/-/g, ' ');
      return road ? `Turn ${dir} ${road}` : `Turn ${dir || ''}`;
    }
    case 'new name':
    case 'continue':        return step.name ? `Continue onto ${step.name}` : 'Continue straight';
    case 'merge':           return step.name ? `Merge ${modifier || ''} onto ${step.name}`.trim() : 'Merge';
    case 'on ramp':         return step.name ? `Take the ramp onto ${step.name}` : 'Take the ramp';
    case 'off ramp':        return step.name ? `Take the exit onto ${step.name}` : 'Take the exit';
    case 'fork':            return modifier?.includes('left') ? `Keep left${road ? ' ' + road : ''}` : `Keep right${road ? ' ' + road : ''}`;
    case 'end of road':     return modifier?.includes('left') ? 'Turn left at end of road' : 'Turn right at end of road';
    case 'roundabout':
    case 'rotary': {
      const exit = (step as any).maneuver?.exit;
      return exit ? `At the roundabout, take exit ${exit}${step.name ? ' onto ' + step.name : ''}` : 'Enter the roundabout';
    }
    case 'roundabout turn': return modifier ? `At the roundabout, turn ${modifier}` : 'Continue through roundabout';
    case 'notification':    return step.name ? `Continue on ${step.name}` : 'Continue';
    default:
      if (modifier && step.name) return `${modifier.replace(/-/g, ' ')} onto ${step.name}`;
      if (modifier)  return modifier.replace(/-/g, ' ');
      if (step.name) return `Continue on ${step.name}`;
      return 'Continue straight';
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
export const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};
export const sevColor = (n: number) => n >= 5 ? C.error : n >= 4 ? C.warning : n >= 3 ? C.tertiary : C.secondary;
