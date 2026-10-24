/** Driving-alert geometry. Pure functions, no browser APIs. */

export const AHEAD_CONE_DEG = 55;

export type WarnCamera = {
  id: string;
  name: string;
  prefecture: string;
  city: string;
  road: string;
  direction: string;
  kind: string;
  limitKph: number | null;
  lat: number;
  lon: number;
  accuracy: string;
  status: string;
  note: string;
};

export type Fix = {
  lat: number;
  lon: number;
  /** Degrees clockwise from north. Null when the device has no course yet. */
  heading: number | null;
};

export type WarnFilter = {
  radiusM: number;
  aheadOnly: boolean;
  includeRemoved: boolean;
  speedKph: number | null;
};

export type Approach<T extends WarnCamera = WarnCamera> = {
  camera: T;
  distanceM: number;
  bearingDeg: number;
  /** Heading minus bearing, -180..180. Positive is to the right. Null if no heading. */
  deltaDeg: number | null;
  ahead: boolean;
  etaSec: number | null;
};

export type WarnStage = "far" | "mid" | "near";

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from point 1 to point 2, degrees clockwise from north. */
export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function angleDelta(headingDeg: number, bearingDeg: number): number {
  return ((bearingDeg - headingDeg + 540) % 360) - 180;
}

export function isAhead(deltaDeg: number, cone = AHEAD_CONE_DEG): boolean {
  return Math.abs(deltaDeg) <= cone;
}

export function stageFor(distanceM: number, radiusM: number): WarnStage | null {
  if (distanceM > radiusM) return null;
  if (distanceM <= 160) return "near";
  if (distanceM <= Math.max(280, radiusM * 0.45)) return "mid";
  return "far";
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 公尺`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} 公里` : `${Math.round(km)} 公里`;
}

export function formatEta(seconds: number): string {
  if (seconds < 90) return `約 ${Math.max(1, Math.round(seconds))} 秒`;
  const minutes = Math.round(seconds / 60);
  return `約 ${minutes} 分鐘`;
}

export function sideLabel(deltaDeg: number | null): string {
  if (deltaDeg == null) return "方位不明";
  const abs = Math.abs(deltaDeg);
  if (abs <= 15) return "正前方";
  if (abs >= 150) return "後方";
  if (deltaDeg > 0 && deltaDeg < 90) return "右前方";
  if (deltaDeg < 0 && deltaDeg > -90) return "左前方";
  if (deltaDeg > 0) return "右側";
  return "左側";
}

export function voiceText(approach: Approach, stage: WarnStage): string {
  const rounded = Math.max(50, Math.round(approach.distanceM / 50) * 50);
  const limit = approach.camera.limitKph;
  const limitBit = limit ? `，公布限速${limit}` : "";
  if (stage === "near") return `即將通過測速點${limitBit}`;
  if (stage === "mid") return `測速接近，還有約${rounded}公尺${limitBit}`;
  return `前方測速，大約${rounded}公尺${limitBit}`;
}

/** Move `distanceM` from a point along a bearing (degrees clockwise from north). */
export function offsetMeters(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number,
): { lat: number; lon: number } {
  const br = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceM * Math.cos(br)) / 111_320;
  const dLon = (distanceM * Math.sin(br)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lon: lon + dLon };
}

/** Start south of a camera, heading north toward it. */
export function approachStart(camera: { lat: number; lon: number }, distanceM: number) {
  const pos = offsetMeters(camera.lat, camera.lon, 180, distanceM);
  return { lat: pos.lat, lon: pos.lon, heading: 0, speedKph: 90 };
}

export function evaluate<T extends WarnCamera>(
  cameras: T[],
  fix: Fix,
  filter: WarnFilter,
): { primary: Approach<T> | null; around: Approach<T>[]; nearest: Approach<T> | null } {
  const around: Approach<T>[] = [];
  let nearest: Approach<T> | null = null;
  const listRadius = Math.max(filter.radiusM, 1500);
  const headed = fix.heading != null;

  for (const camera of cameras) {
    if (!filter.includeRemoved && camera.status === "maybe-removed") continue;
    const distanceM = haversineM(fix.lat, fix.lon, camera.lat, camera.lon);
    const bearing = (initialBearing(fix.lat, fix.lon, camera.lat, camera.lon) + 360) % 360;
    const deltaDeg = headed ? angleDelta(fix.heading as number, bearing) : null;
    const ahead = deltaDeg == null ? true : isAhead(deltaDeg);
    const etaSec =
      ahead && filter.speedKph != null && filter.speedKph >= 8
        ? distanceM / (filter.speedKph / 3.6)
        : null;
    const item: Approach<T> = { camera, distanceM, bearingDeg: bearing, deltaDeg, ahead, etaSec };
    if (!nearest || distanceM < nearest.distanceM) nearest = item;
    if (distanceM <= listRadius) around.push(item);
  }

  around.sort((a, b) => a.distanceM - b.distanceM);
  const inRange = around.filter((item) => item.distanceM <= filter.radiusM);
  const pool = filter.aheadOnly && headed ? inRange.filter((item) => item.ahead) : inRange;
  pool.sort((a, b) => a.distanceM - b.distanceM);
  return { primary: pool[0] ?? null, around: around.slice(0, 6), nearest };
}
