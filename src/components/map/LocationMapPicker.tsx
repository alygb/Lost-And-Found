"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Circle, Crosshair, Loader2, LocateFixed, MapPin, Route, Search, Trash2 } from "lucide-react";
import { AJK_CENTER, describeLocation, type MapLocation } from "@/lib/mapLocation";

type Mode = MapLocation["mode"];

const MODES: { key: Mode; label: string; hint: string; icon: typeof MapPin }[] = [
  { key: "point", label: "Exact spot", hint: "Tap the map where it happened", icon: MapPin },
  { key: "area", label: "Around an area", hint: "Tap the centre, then set how far around", icon: Circle },
  { key: "route", label: "Between two places", hint: "Tap the start (A), then the end (B) of the route", icon: Route },
];

/** Teardrop map pin as HTML, so no image files are needed. */
export function pinHtml(color: string, label = "") {
  return `<div style="position:relative;width:34px;height:44px;filter:drop-shadow(0 4px 6px rgba(15,23,42,.35))">
    <svg viewBox="0 0 34 44" width="34" height="44"><path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.4 17 44 17 44s17-14.6 17-27.2C34 7.5 26.4 0 17 0z" fill="${color}"/><circle cx="17" cy="16.5" r="${label ? 10 : 6.5}" fill="#fff"/></svg>
    ${label ? `<span style="position:absolute;top:8px;left:0;width:34px;text-align:center;font:800 12px/17px system-ui;color:${color}">${label}</span>` : ""}
  </div>`;
}

type SearchHit = { display_name: string; lat: number; lon: number };

/** Free, key-less place search (OpenStreetMap data via Photon). Limited to Pakistan, biased to AJK. */
const PHOTON = "https://photon.komoot.io";
const PK_BBOX = "60.8,23.6,77.9,37.1";
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };
const featureName = (f: PhotonFeature) => {
  const p = f.properties;
  return [p.name, p.street, p.locality || p.district, p.city || p.county, p.state].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
};

export default function LocationMapPicker({
  value,
  onChange,
  accent,
  defaultMode = "point",
  flyTo,
  onPlaceName,
}: {
  value: MapLocation | null;
  onChange: (v: MapLocation | null) => void;
  accent: string;
  defaultMode?: Mode;
  flyTo?: [number, number] | null;
  onPlaceName?: (name: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>(value?.mode || defaultMode);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState<"" | "search" | "locate">("");
  const [msg, setMsg] = useState("");

  // Latest values for Leaflet's event handlers
  const live = useRef({ value, mode, onChange, onPlaceName });
  useEffect(() => {
    live.current = { value, mode, onChange, onPlaceName };
  });

  /** Short readable name for a point (OpenStreetMap reverse geocoding). */
  const reverseName = async (p: [number, number]) => {
    if (!live.current.onPlaceName) return;
    try {
      const r = await fetch(`${PHOTON}/reverse?lat=${p[0]}&lon=${p[1]}&limit=1`);
      const j: { features?: PhotonFeature[] } = await r.json();
      const f = j.features?.[0];
      if (!f) return;
      const parts = featureName(f).split(", ");
      if (parts.length) live.current.onPlaceName?.(parts.slice(0, 2).join(", "));
    } catch {}
  };

  /** Puts a point on the map according to the current mode. */
  const place = (p: [number, number]) => {
    const { value: v, mode: m, onChange: change } = live.current;
    setMsg("");
    if (m === "route") {
      const pts = v?.mode === "route" && v.points.length === 1 ? [v.points[0], p] : [p];
      change({ mode: "route", points: pts as [number, number][] });
      if (pts.length === 1) reverseName(p);
    } else {
      change({ mode: m, points: [p], radius: m === "area" ? v?.radius || 500 : undefined });
      reverseName(p);
    }
  };
  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  });

  // ── Create the map once ──
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !box.current || mapRef.current) return;
      LRef.current = L;
      const start = live.current.value?.points[0] ?? AJK_CENTER;
      const map = L.map(box.current, { scrollWheelZoom: false, zoomControl: true }).setView(start, live.current.value ? 15 : 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => placeRef.current([e.latlng.lat, e.latlng.lng]));
      // Zoom with the mouse wheel only after the user clicks into the map, so page scrolling isn't hijacked
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw the current value ──
  useEffect(() => {
    const L = LRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    if (!value?.points.length) return;

    const icon = (label = "") => L.divIcon({ html: pinHtml(accent, label), className: "", iconSize: [34, 44], iconAnchor: [17, 44] });
    const dragTo = (i: number) => (e: Leaflet.LeafletEvent) => {
      const ll = (e.target as Leaflet.Marker).getLatLng();
      const pts = [...value.points];
      pts[i] = [ll.lat, ll.lng];
      onChange({ ...value, points: pts });
      if (i === 0) reverseName(pts[0]);
    };

    if (value.mode === "area") {
      L.circle(value.points[0], { radius: value.radius || 500, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.15, dashArray: "6 6" }).addTo(layer);
    }
    if (value.mode === "route" && value.points.length === 2) {
      L.polyline(value.points, { color: accent, weight: 4, opacity: 0.85, dashArray: "10 8" }).addTo(layer);
    }
    value.points.forEach((p, i) =>
      L.marker(p, { icon: icon(value.mode === "route" ? (i === 0 ? "A" : "B") : ""), draggable: true, keyboard: true })
        .on("dragend", dragTo(i))
        .addTo(layer)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value, accent]);

  // ── Jump to the selected district (only while nothing is pinned) ──
  useEffect(() => {
    if (ready && flyTo && !live.current.value) mapRef.current?.flyTo(flyTo, 12, { duration: 1.2 });
  }, [ready, flyTo]);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (!value?.points.length) return;
    const first = value.points[0];
    onChange(m === "area" ? { mode: "area", points: [first], radius: value.radius || 500 } : { mode: m, points: [first] });
  };

  const locate = () => {
    if (!navigator.geolocation) return setMsg("Your browser can't share its location. Tap the map instead.");
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy("");
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        mapRef.current?.setView(p, 16);
        place(p);
      },
      () => {
        setBusy("");
        setMsg("Couldn't get your location. Allow location access in your browser, or tap the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const search = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    setBusy("search");
    setMsg("");
    try {
      const r = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=5&lat=${AJK_CENTER[0]}&lon=${AJK_CENTER[1]}&bbox=${PK_BBOX}`);
      const data: { features?: PhotonFeature[] } = await r.json();
      const j: SearchHit[] = (data.features || []).map((f) => ({
        display_name: featureName(f),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      }));
      setHits(j);
      if (!j.length) setMsg("No places found. Try a nearby landmark or town name.");
    } catch {
      setMsg("Search is not available right now. Tap the map instead.");
    }
    setBusy("");
  };

  const pickHit = (h: SearchHit) => {
    const p: [number, number] = [h.lat, h.lon];
    setHits(null);
    setQuery(h.display_name.split(",")[0]);
    mapRef.current?.setView(p, 16);
    place(p);
  };

  const activeMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="space-y-3">
      {/* Mode */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => switchMode(m.key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
              mode === m.key ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <m.icon className="h-4 w-4 shrink-0" style={mode === m.key ? { color: accent } : undefined} />
            <span className="truncate">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Search + locate */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHits(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") search(e);
            }}
            placeholder="Search a place, e.g. Chattar Klass, Muzaffarabad"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-20 text-sm outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={() => search()}
            disabled={busy === "search" || query.trim().length < 3}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {busy === "search" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
          </button>
        </div>
        <button
          type="button"
          onClick={locate}
          disabled={busy === "locate"}
          title="Use my current location"
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "locate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" style={{ color: accent }} />}
          <span className="hidden sm:inline">My location</span>
        </button>

        {hits && hits.length > 0 && (
          <ul className="animate-fade-down absolute inset-x-0 top-full z-[500] mt-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-pop">
            {hits.map((h) => (
              <li key={h.lat + h.lon}>
                <button type="button" onClick={() => pickHit(h)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition hover:bg-slate-50">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="line-clamp-2">{h.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map (isolated so Leaflet's layers stay under the page header and popups) */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-slate-200">
        <div ref={box} className="h-72 w-full bg-slate-100 sm:h-80" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-50 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
          </div>
        )}
        {ready && !value && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
            <span className="animate-fade-down flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
              <Crosshair className="h-3.5 w-3.5" /> {activeMode.hint}
            </span>
          </div>
        )}
      </div>

      {/* Radius for "area" */}
      {value?.mode === "area" && (
        <div className="animate-fade-down flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <Circle className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={value.radius || 500}
            onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
            className="flex-1"
            style={{ accentColor: accent }}
            aria-label="Area size"
          />
          <span className="w-16 text-right text-xs font-bold text-slate-700">
            {(value.radius || 500) < 1000 ? `${value.radius || 500} m` : `${((value.radius || 500) / 1000).toFixed(1)} km`}
          </span>
        </div>
      )}

      {/* Summary */}
      {value ? (
        <div className="animate-fade-in flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5">
          <p className="min-w-0 text-xs text-slate-600">
            <span className="font-bold text-slate-800">{describeLocation(value)}</span>
            <span className="block truncate text-[11px] text-slate-400">
              {value.points.map((p) => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`).join("  →  ")} · drag the pin to adjust
            </span>
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      ) : null}
      {msg && <p className="text-xs font-medium text-amber-700">{msg}</p>}
    </div>
  );
}
