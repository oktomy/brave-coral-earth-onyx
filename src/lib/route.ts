import { haversineM } from "./warn.ts";

/** Cameras within this many metres of the planned driving line are "on the route". */
export const CORRIDOR_M = 350;

export type LatLon = { lat: number; lon: number };

export type Place = { name: string; lat: number; lon: number };

export type RouteHit<T> = {
  camera: T;
  alongM: number;
  offM: number;
};

export type DrivingRoute = {
  distanceM: number;
  durationS: number;
  line: LatLon[];
};

type Seg = {
  x: number;
  y: number;
  abx: number;
  aby: number;
  ab2: number;
  len: number;
  start: number;
};

export function inJapan(lat: number, lon: number): boolean {
  return lat >= 24 && lat <= 46 && lon >= 122 && lon <= 154;
}

export function photonSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, limit: "5", lang: "ja" });
  return `https://photon.komoot.io/api/?${params.toString()}`;
}

export function osrmRouteUrl(from: LatLon, to: LatLon): string {
  return `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
}

export function googleNavigateUrl(destination: LatLon, origin: LatLon | null): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lon}`,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lon}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleNavigateQuery(destination: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function pickPlace(payload: unknown): Place | null {
  if (!payload || typeof payload !== "object") return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return null;
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const coords = (feature as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const props = (feature as { properties?: Record<string, unknown> }).properties ?? {};
    const code = typeof props.countrycode === "string" ? props.countrycode.toUpperCase() : "";
    if (code !== "JP" && !inJapan(lat, lon)) continue;
    const parts = [props.name, props.city, props.state]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    const unique = parts.filter((part, index) => parts.indexOf(part) === index).slice(0, 3);
    return { name: unique.join(" · ") || "目的地", lat, lon };
  }
  return null;
}

export function readRoute(payload: unknown): DrivingRoute | null {
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { code?: unknown }).code !== "Ok") return null;
  const routes = (payload as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || !routes[0] || typeof routes[0] !== "object") return null;
  const route = routes[0] as {
    distance?: unknown;
    duration?: unknown;
    geometry?: { coordinates?: unknown };
  };
  const coords = route.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  const line: LatLon[] = [];
  for (const pair of coords) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    line.push({ lat, lon });
  }
  const distanceM = Number(route.distance);
  const durationS = Number(route.duration);
  if (line.length < 2 || !Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  return { distanceM, durationS, line };
}

/** Drop points closer than minStepM so a long route stays cheap to scan. Always keeps both ends. */
export function simplifyLine(line: readonly LatLon[], minStepM: number): LatLon[] {
  if (line.length <= 2) return line.slice();
  const out: LatLon[] = [line[0]];
  let prev = line[0];
  for (let i = 1; i < line.length - 1; i++) {
    if (haversineM(prev.lat, prev.lon, line[i].lat, line[i].lon) >= minStepM) {
      out.push(line[i]);
      prev = line[i];
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

function toXY(lat: number, lon: number, lat0: number, lon0: number) {
  const mLat = 111_320;
  const mLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return { x: (lon - lon0) * mLon, y: (lat - lat0) * mLat };
}

function segments(line: readonly LatLon[]): Seg[] {
  const lat0 = line[0].lat;
  const lon0 = line[0].lon;
  const segs: Seg[] = [];
  let start = 0;
  let prev = toXY(line[0].lat, line[0].lon, lat0, lon0);
  for (let i = 1; i < line.length; i++) {
    const next = toXY(line[i].lat, line[i].lon, lat0, lon0);
    const abx = next.x - prev.x;
    const aby = next.y - prev.y;
    const ab2 = abx * abx + aby * aby;
    const len = Math.sqrt(ab2);
    segs.push({ x: prev.x, y: prev.y, abx, aby, ab2, len, start });
    start += len;
    prev = next;
  }
  return segs;
}

function project(lat: number, lon: number, lat0: number, lon0: number, segs: readonly Seg[]) {
  const p = toXY(lat, lon, lat0, lon0);
  let bestOff = Infinity;
  let bestAlong = 0;
  for (const seg of segs) {
    let t = 0;
    if (seg.ab2 > 0) {
      t = ((p.x - seg.x) * seg.abx + (p.y - seg.y) * seg.aby) / seg.ab2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    const cx = seg.x + seg.abx * t;
    const cy = seg.y + seg.aby * t;
    const off = Math.hypot(p.x - cx, p.y - cy);
    if (off < bestOff) {
      bestOff = off;
      bestAlong = seg.start + seg.len * t;
    }
  }
  return { alongM: bestAlong, offM: bestOff };
}

export function progressAlongM(line: readonly LatLon[], point: LatLon): { alongM: number; offM: number } {
  if (line.length === 0) return { alongM: 0, offM: Infinity };
  if (line.length === 1) return { alongM: 0, offM: haversineM(point.lat, point.lon, line[0].lat, line[0].lon) };
  return project(point.lat, point.lon, line[0].lat, line[0].lon, segments(line));
}

export function camerasAlongRoute<T extends { lat: number; lon: number; status: string }>(
  cameras: readonly T[],
  line: readonly LatLon[],
  corridorM: number,
  includeRemoved: boolean,
): RouteHit<T>[] {
  if (line.length < 2) return [];
  let minLat = line[0].lat;
  let maxLat = line[0].lat;
  let minLon = line[0].lon;
  let maxLon = line[0].lon;
  for (const point of line) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lon < minLon) minLon = point.lon;
    if (point.lon > maxLon) maxLon = point.lon;
  }
  const padLat = (corridorM + 80) / 111_320;
  const padLon = padLat / Math.max(0.2, Math.cos((line[0].lat * Math.PI) / 180));
  const segs = segments(line);
  const hits: RouteHit<T>[] = [];
  for (const camera of cameras) {
    if (!includeRemoved && camera.status === "maybe-removed") continue;
    if (
      camera.lat < minLat - padLat ||
      camera.lat > maxLat + padLat ||
      camera.lon < minLon - padLon ||
      camera.lon > maxLon + padLon
    ) {
      continue;
    }
    const hit = project(camera.lat, camera.lon, line[0].lat, line[0].lon, segs);
    if (hit.offM <= corridorM) hits.push({ camera, alongM: hit.alongM, offM: hit.offM });
  }
  hits.sort((a, b) => a.alongM - b.alongM);
  return hits;
}
