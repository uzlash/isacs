"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type {
  CircleMarker,
  GeoJSON as LeafletGeoJSON,
  LayerGroup,
  LeafletMouseEvent,
  Map as LeafletMap,
} from "leaflet";
import { kml as kmlToGeojson } from "@tmcw/togeojson";
import { listMapLayers, MAP_TYPE_META, mapTypeMeta, type MapLayer, type MapLayerType } from "@/lib/api/map";

export interface NodeMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  height?: number | string;
  showSwitcher?: boolean;
  /** bump to force a reload (e.g. after upload/delete) */
  refreshKey?: number;
  // ---- interactive (wizard) ----
  /** when set, clicking the map calls this with the clicked coordinates */
  onMapClick?: (lat: number, lng: number) => void;
  /** a placed/picked point to show */
  marker?: { lat: number; lng: number } | null;
  /** existing nodes to show as selectable markers */
  nodeMarkers?: NodeMarker[];
  selectedNodeId?: string | null;
  onNodeClick?: (id: string) => void;
  /** center the map on a point (e.g. the selected node) */
  focus?: { lat: number; lng: number; zoom?: number } | null;
}

// Renders the composite facility map from stacked KML layers. No external tile
// layer — the KML *is* the map, drawn over the app background — so it works
// fully on-prem/offline. KML is fetched through the BFF proxy (/api/map/kml/:id)
// to dodge MinIO CORS. Optional interactive props power the node-create wizard.
export default function FacilityKmlMap({
  height = 420,
  showSwitcher = true,
  refreshKey = 0,
  onMapClick,
  marker,
  nodeMarkers,
  selectedNodeId,
  onNodeClick,
  focus,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const groupsRef = useRef<Record<string, LeafletGeoJSON>>({});
  const pickRef = useRef<CircleMarker | null>(null);
  const nodeLayerRef = useRef<LayerGroup | null>(null);
  // the building/site/floor bounds used for the default framing — reused by the
  // focus effect so the inspector frames the facility identically to /map.
  const focusBoundsRef = useRef<import("leaflet").LatLngBounds | null>(null);
  // remembers the last focus target we framed, so we only auto-frame when the
  // target actually changes — never on unrelated re-renders (which would fight
  // the user's manual zoom/pan).
  const lastFocusRef = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [renderedCount, setRenderedCount] = useState(0);
  const [err, setErr] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Native Fullscreen API on the map wrapper. Track state (incl. Esc-to-exit)
  // and let Leaflet recompute its size when the viewport changes.
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
      // let the tiles/vector layers reflow to the new size
      setTimeout(() => mapRef.current?.invalidateSize(), 60);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      LRef.current = L;
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { attributionControl: false, zoomControl: true });
      map.setView([20, 0], 2);
      mapRef.current = map;
      setMapReady(true);

      setStatus("loading");
      let ls: MapLayer[] = [];
      try {
        ls = await listMapLayers();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load layers");
          setStatus("error");
        }
        return;
      }
      if (cancelled) return;
      setLayers(ls);
      const vis: Record<string, boolean> = {};
      ls.forEach((l) => (vis[l.id] = true));
      setVisible(vis);
      if (!ls.length) {
        setStatus("empty");
        return;
      }

      const bounds = L.latLngBounds([]);
      // Fit the initial view to the actual structures, not the sprawling roads.
      const focusBounds = L.latLngBounds([]);
      const FOCUS_TYPES = new Set(["building", "floor_plan", "site_plan"]);
      let rendered = 0;
      let firstErr = "";
      for (const layer of ls) {
        try {
          const res = await fetch(`/api/map/kml/${layer.id}`, { credentials: "same-origin" });
          if (!res.ok) {
            if (!firstErr) {
              const j = await res.json().catch(() => null);
              firstErr = (j?.message as string) || `HTTP ${res.status}`;
            }
            continue;
          }
          const text = await res.text();
          const dom = new DOMParser().parseFromString(text, "text/xml");
          const gj = kmlToGeojson(dom);
          const color = mapTypeMeta(layer.type).color;
          const gl = L.geoJSON(gj, {
            style: () => ({ color, weight: 2, opacity: 0.9, fillColor: color, fillOpacity: 0.08 }),
            pointToLayer: (_f, latlng) =>
              L.circleMarker(latlng, { radius: 5, color, weight: 2, fillColor: color, fillOpacity: 0.6 }),
          });
          if (cancelled) return;
          groupsRef.current[layer.id] = gl;
          gl.addTo(map);
          const b = gl.getBounds();
          if (b.isValid()) {
            bounds.extend(b);
            if (FOCUS_TYPES.has(layer.type ?? "other")) focusBounds.extend(b);
          }
          rendered++;
        } catch {
          /* skip a layer that fails to fetch/parse */
        }
      }
      if (cancelled) return;
      setRenderedCount(rendered);
      if (rendered === 0 && firstErr) setErr(firstErr);
      // Prefer the buildings/structures for the initial zoom; else fit everything.
      const target = focusBounds.isValid() ? focusBounds : bounds;
      focusBoundsRef.current = target.isValid() ? target : null;
      if (target.isValid()) map.fitBounds(target, { padding: [30, 30], maxZoom: 20 });
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      groupsRef.current = {};
      pickRef.current = null;
      nodeLayerRef.current = null;
      focusBoundsRef.current = null;
      setMapReady(false);
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ---- interactive: click to pick a location ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !onMapClick) return;
    const handler = (e: LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.off("click", handler);
      map.getContainer().style.cursor = "";
    };
  }, [mapReady, onMapClick]);

  // ---- interactive: the picked-location marker ----
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !mapReady || !L) return;
    if (pickRef.current) {
      map.removeLayer(pickRef.current);
      pickRef.current = null;
    }
    if (marker) {
      pickRef.current = L.circleMarker([marker.lat, marker.lng], {
        radius: 9,
        color: "#34d3c0",
        weight: 3,
        fillColor: "#34d3c0",
        fillOpacity: 0.5,
      }).addTo(map);
    }
  }, [mapReady, marker]);

  // ---- center on a focus point (e.g. selected node) ----
  // Default (no explicit zoom): frame the facility exactly like the /map page —
  // fit the same building bounds — and only include the node point when it sits
  // within that frame, so a stray/far-off node coord never zooms the map out.
  // The node is still highlighted by its marker. An explicit `zoom` opts into a
  // tight centre on the point instead.
  // Depend on the primitive coords/zoom + a "framed?" key — NOT the `focus`
  // object identity — so unrelated parent re-renders (e.g. the store tick) never
  // re-frame the map and steal the user's manual zoom/pan.
  const focusLat = focus?.lat;
  const focusLng = focus?.lng;
  const focusZoom = focus?.zoom;
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !mapReady || !L || focusLat == null || focusLng == null) return;

    // only auto-frame when the target (or load-readiness) actually changes
    const key = `${focusLat},${focusLng},${focusZoom ?? ""},${status}`;
    if (lastFocusRef.current === key) return;
    lastFocusRef.current = key;

    if (focusZoom != null) {
      map.setView([focusLat, focusLng], focusZoom);
      return;
    }

    const facility = focusBoundsRef.current;
    if (facility && facility.isValid()) {
      const b = L.latLngBounds(facility.getSouthWest(), facility.getNorthEast());
      if (facility.contains([focusLat, focusLng])) b.extend([focusLat, focusLng]);
      map.fitBounds(b, { padding: [30, 30], maxZoom: 20 });
    } else if (status !== "ready") {
      // layers still loading — the load pass will frame; just centre for now
      map.setView([focusLat, focusLng], 17);
    } else {
      map.setView([focusLat, focusLng], 18);
    }
  }, [mapReady, focusLat, focusLng, focusZoom, status]);

  // ---- interactive: existing node markers (select a parent) ----
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !mapReady || !L) return;
    if (nodeLayerRef.current) {
      map.removeLayer(nodeLayerRef.current);
      nodeLayerRef.current = null;
    }
    if (nodeMarkers && nodeMarkers.length) {
      const group = L.layerGroup();
      for (const n of nodeMarkers) {
        const sel = n.id === selectedNodeId;
        const m = L.circleMarker([n.lat, n.lng], {
          radius: sel ? 8 : 6,
          color: sel ? "#34d3c0" : "#58a6ff",
          weight: sel ? 3 : 2,
          fillColor: sel ? "#34d3c0" : "#58a6ff",
          fillOpacity: sel ? 0.7 : 0.4,
        });
        m.bindTooltip(n.name, { direction: "top", offset: [0, -6] });
        if (onNodeClick) m.on("click", () => onNodeClick(n.id));
        m.addTo(group);
      }
      group.addTo(map);
      nodeLayerRef.current = group;
    }
  }, [mapReady, nodeMarkers, selectedNodeId, onNodeClick]);

  const toggle = (id: string) => {
    const gl = groupsRef.current[id];
    const map = mapRef.current;
    if (!gl || !map) return;
    setVisible((v) => {
      const now = !v[id];
      if (now) gl.addTo(map);
      else map.removeLayer(gl);
      return { ...v, [id]: now };
    });
  };

  const presentTypes = Array.from(new Set(layers.map((l) => (l.type ?? "other") as MapLayerType)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          height: isFullscreen ? "100%" : height,
          borderRadius: isFullscreen ? 0 : 10,
          overflow: "hidden",
          border: isFullscreen ? "none" : "1px solid var(--border)",
          isolation: "isolate",
          background: "var(--bg)",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%", background: "var(--bg)" }} />
        {status !== "ready" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center", padding: "0 20px" }}>
              {status === "loading" && "LOADING MAP LAYERS…"}
              {status === "empty" && "NO MAP LAYERS UPLOADED YET"}
              {status === "error" && "MAP ERROR · " + err}
            </span>
          </div>
        )}
        {/* fullscreen toggle — sits above Leaflet's own zoom control (z 400/1000) */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            cursor: "pointer",
            background: "color-mix(in srgb, var(--panel) 88%, transparent)",
            border: "1px solid var(--border2)",
            color: "var(--fg)",
            backdropFilter: "blur(4px)",
          }}
        >
          {isFullscreen ? <Minimize2 size={15} strokeWidth={2} /> : <Maximize2 size={15} strokeWidth={2} />}
        </button>
      </div>

      {status === "ready" && renderedCount === 0 && layers.length > 0 && (
        <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--warn)", lineHeight: 1.5, wordBreak: "break-all" }}>
          {layers.length} layer(s) found but none rendered. {err || "KML storage (MinIO) unreachable from the server."}
        </div>
      )}

      {layers.length > 0 && (
        <>
          {/* legend — layer types present */}
          <div style={{ display: "flex", gap: 13, flexWrap: "wrap" }}>
            {presentTypes.map((t) => {
              const m = MAP_TYPE_META[t];
              return (
                <span key={t} className="mono" style={{ display: "flex", alignItems: "center", gap: 5, font: "500 9.5px var(--font-mono-stack)", color: "var(--muted)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: m.color }} />
                  {m.label}
                </span>
              );
            })}
          </div>

          {/* per-layer visibility toggle (colored by type) */}
          {showSwitcher && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {layers.map((l) => {
                const c = mapTypeMeta(l.type).color;
                const on = visible[l.id];
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className="mono"
                    style={{
                      font: "600 9.5px var(--font-mono-stack)",
                      padding: "5px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: `1px solid ${on ? c : "var(--border2)"}`,
                      background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : "transparent",
                      color: on ? c : "var(--muted)",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: c, opacity: on ? 1 : 0.4 }} />
                    L{l.level} · {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
