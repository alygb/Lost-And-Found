"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { ExternalLink, Loader2, MapPinned } from "lucide-react";
import { describeLocation, googleMapsLink, type MapLocation } from "@/lib/mapLocation";
import { pinHtml } from "./LocationMapPicker";

/** Read-only map of where an item was lost / found. */
export default function LocationMapView({ value, accent, title }: { value: MapLocation; accent: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("focus", () => map?.scrollWheelZoom.enable());
      map.on("blur", () => map?.scrollWheelZoom.disable());

      // Set the view FIRST, from plain coordinates. (A circle can't report its bounds
      // until the map has a view, which caused "reading 'layerPointToLatLng'".)
      if (value.mode === "point") {
        map.setView(value.points[0], 16);
      } else {
        const bounds =
          value.mode === "area"
            ? L.latLng(value.points[0]).toBounds((value.radius || 500) * 2)
            : L.latLngBounds(value.points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }

      const icon = (label = "") => L.divIcon({ html: pinHtml(accent, label), className: "", iconSize: [34, 44], iconAnchor: [17, 44] });
      const shapes: Leaflet.Layer[] = [];
      if (value.mode === "area") {
        shapes.push(L.circle(value.points[0], { radius: value.radius || 500, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.15, dashArray: "6 6" }));
      }
      if (value.mode === "route" && value.points.length === 2) {
        shapes.push(L.polyline(value.points, { color: accent, weight: 4, opacity: 0.85, dashArray: "10 8" }));
      }
      value.points.forEach((p, i) => shapes.push(L.marker(p, { icon: icon(value.mode === "route" ? (i === 0 ? "A" : "B") : "") })));
      L.featureGroup(shapes).addTo(map);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [value, accent]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
            <MapPinned className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{describeLocation(value)}</p>
          </div>
        </div>
        <a
          href={googleMapsLink(value.points[0])}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="relative isolate">
        <div ref={box} className="h-72 w-full bg-slate-100" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
          </div>
        )}
      </div>
    </section>
  );
}
