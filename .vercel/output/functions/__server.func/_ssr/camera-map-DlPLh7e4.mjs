import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as require_leaflet_src } from "../_libs/leaflet.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/camera-map-DlPLh7e4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src());
var KIND_COLOR = {
	fixed: "#e6a322",
	semi: "#f0b429",
	mobile: "#7eb6d9",
	osm: "#3dbea5",
	guide: "#e6a322"
};
function markerStyle(camera, active) {
	const removed = camera.status === "maybe-removed";
	const color = removed ? "#a7b0bc" : KIND_COLOR[camera.kind];
	return {
		radius: active ? 8 : 5,
		color: active ? "#f4f0e6" : "#12151a",
		weight: active ? 3 : 1,
		fillColor: color,
		fillOpacity: removed ? .35 : camera.kind === "guide" ? .82 : .95,
		opacity: 1
	};
}
function CameraMap({ cameras, activeId, onSelect }) {
	const host = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const layerRef = (0, import_react.useRef)(null);
	const markersRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const onSelectRef = (0, import_react.useRef)(onSelect);
	onSelectRef.current = onSelect;
	const camerasRef = (0, import_react.useRef)(cameras);
	camerasRef.current = cameras;
	const activeRef = (0, import_react.useRef)(activeId);
	activeRef.current = activeId;
	const signature = cameras.map((camera) => camera.id).join("|");
	(0, import_react.useEffect)(() => {
		if (!host.current || mapRef.current) return;
		const map = import_leaflet_src.default.map(host.current, {
			zoomControl: false,
			attributionControl: true
		}).setView([36.2, 138.2], 5);
		import_leaflet_src.default.control.zoom({ position: "bottomright" }).addTo(map);
		import_leaflet_src.default.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
			attribution: "&copy; OpenStreetMap &copy; CARTO",
			subdomains: "abcd",
			maxZoom: 19
		}).addTo(map);
		layerRef.current = import_leaflet_src.default.layerGroup().addTo(map);
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
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		const layer = layerRef.current;
		if (!map || !layer) return;
		layer.clearLayers();
		markersRef.current.clear();
		const current = activeRef.current;
		for (const camera of cameras) {
			const marker = import_leaflet_src.default.circleMarker([camera.lat, camera.lon], markerStyle(camera, camera.id === current));
			marker.on("click", () => onSelectRef.current(camera.id));
			marker.addTo(layer);
			markersRef.current.set(camera.id, marker);
		}
		map.invalidateSize();
	}, [cameras]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map || cameras.length === 0) return;
		if (cameras.length === 1) {
			map.setView([cameras[0].lat, cameras[0].lon], 13, { animate: false });
			return;
		}
		const bounds = import_leaflet_src.default.latLngBounds(cameras.map((camera) => [camera.lat, camera.lon]));
		map.fitBounds(bounds.pad(.12), {
			animate: false,
			maxZoom: 12
		});
	}, [signature, cameras]);
	const styledRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		const markers = markersRef.current;
		const apply = (id, active) => {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: host,
		className: "h-full w-full"
	});
}
//#endregion
export { CameraMap };
