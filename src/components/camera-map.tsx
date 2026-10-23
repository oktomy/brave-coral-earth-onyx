import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Camera } from "@/data/cameras";

type Props = {
  cameras: Camera[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

const KIND_COLOR: Record<Camera["kind"], string> = {
  fixed: "#e6a322",
  semi: "#f0b429",
  mobile: "#7eb6d9",
  osm: "#3dbea5",
  guide: "#e6a322",
};

function markerStyle(camera: Camera, active: boolean): L.CircleMarkerOptions {
  const removed = camera.status === "maybe-removed";
  const color = removed ? "#a7b0bc" : KIND_COLOR[camera.kind];
  return {
    radius: active ? 8 : 5,
    color: active ? "#f4f0e6" : "#12151a",
    weight: active ? 3 : 1,
    fillColor: color,
    fillOpacity: removed ? 0.35 : camera.kind === "guide" ? 0.82 : 0.95,
    opacity: 1,
  };
}

export function CameraMap({ cameras, activeId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const signature = cameras.map((camera) => camera.id).join("|");

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const map = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([36.2, 138.2], 5);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    const current = activeRef.current;
    for (const camera of cameras) {
      const marker = L.circleMarker([camera.lat, camera.lon], markerStyle(camera, camera.id === current));
      marker.on("click", () => onSelectRef.current(camera.id));
      marker.addTo(layer);
      markersRef.current.set(camera.id, marker);
    }
    map.invalidateSize();
  }, [cameras]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || cameras.length === 0) return;
    if (cameras.length === 1) {
      map.setView([cameras[0].lat, cameras[0].lon], 13, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(cameras.map((camera) => [camera.lat, camera.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom: 12 });
  }, [signature, cameras]);

  const styledRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    const apply = (id: string | null, active: boolean) => {
      if (!id) return;
      const marker = markers.get(id);
      const camera = camerasRef.current.find((item) => item.id === id);
      if (!marker || !camera) return;
      marker.setStyle(markerStyle(camera, active));
    };
    if (styledRef.current !== activeId) {
      apply(styledRef.current, false);
      apply(activeId, true);
      styledRef.current = activeId;
    }
    if (!map || !activeId) return;
    const camera = camerasRef.current.find((item) => item.id === activeId);
    if (!camera) return;
    const zoom = Math.max(map.getZoom(), 12);
    map.setView([camera.lat, camera.lon], zoom, { animate: true });
  }, [activeId]);

  return <div ref={host} className="h-full w-full" />;
}
