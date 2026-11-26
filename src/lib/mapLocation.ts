/** Where an item was lost or found, as drawn on the map. Saved in the `map_location` column. */
export type MapLocation = {
  mode: "point" | "area" | "route";
  /** [lat, lng] pairs: 1 point for "point"/"area", 2 points (start, end) for "route". */
  points: [number, number][];
  /** Metres, only for "area". */
  radius?: number;
};

export const AJK_CENTER: [number, number] = [33.95, 73.8];

/** Approximate centres of AJK districts, so the map jumps to the chosen district. */
const DISTRICT_CENTERS: { match: string; at: [number, number] }[] = [
  { match: "muzaffarabad", at: [34.37, 73.471] },
  { match: "hattian", at: [34.168, 73.744] },
  { match: "jhelum valley", at: [34.168, 73.744] },
  { match: "neelum", at: [34.585, 73.907] },
  { match: "poonch", at: [33.858, 73.76] },
  { match: "rawalakot", at: [33.858, 73.76] },
  { match: "bagh", at: [33.981, 73.776] },
  { match: "sudhnoti", at: [33.715, 73.686] },
  { match: "pallandri", at: [33.715, 73.686] },
  { match: "haveli", at: [33.887, 74.095] },
  { match: "mirpur", at: [33.148, 73.752] },
  { match: "kotli", at: [33.518, 73.902] },
  { match: "bhimber", at: [32.975, 74.079] },
];

export function districtCenter(name?: string | null): [number, number] | null {
  if (!name) return null;
  const n = name.toLowerCase();
  return DISTRICT_CENTERS.find((d) => n.includes(d.match))?.at ?? null;
}

/** Great-circle distance in metres. */
export function distanceM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

/** "Exact spot" / "Within 500 m of this point" / "Between two places, 2.4 km apart" */
export function describeLocation(v: MapLocation | null | undefined): string {
  if (!v || !v.points?.length) return "";
  if (v.mode === "area") return `Somewhere within ${formatDistance(v.radius || 500)} of this point`;
  if (v.mode === "route") {
    return v.points.length < 2 ? "Start point set, now tap the end point" : `Somewhere between these two places (${formatDistance(distanceM(v.points[0], v.points[1]))} apart)`;
  }
  return "At this exact spot";
}

export const googleMapsLink = (p: [number, number]) => `https://www.google.com/maps?q=${p[0].toFixed(6)},${p[1].toFixed(6)}`;

/** Accepts only well-formed values (data comes from the database / user). */
export function isMapLocation(v: unknown): v is MapLocation {
  if (!v || typeof v !== "object") return false;
  const m = v as MapLocation;
  return (
    ["point", "area", "route"].includes(m.mode) &&
    Array.isArray(m.points) &&
    m.points.length > 0 &&
    m.points.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "number" && Number.isFinite(x)))
  );
}
