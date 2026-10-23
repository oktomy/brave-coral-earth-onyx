import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as toKml, c as KINDS, d as PREFECTURE_SHORT, f as REGIONS, i as toCsv, l as KIND_LABEL, n as googleMapsUrl, o as ACCURACY_LABEL, p as cameraSearchText, r as mobileShareFile, s as CAMERAS, u as PREFECTURE_LABEL } from "./router-CYPJ30sV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-r1DuTqXF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function distanceKm(camera, origin) {
	const earth = 6371;
	const p1 = origin.lat * Math.PI / 180;
	const p2 = camera.lat * Math.PI / 180;
	const dLat = (camera.lat - origin.lat) * Math.PI / 180;
	const dLon = (camera.lon - origin.lon) * Math.PI / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
	return 2 * earth * Math.asin(Math.sqrt(h));
}
function Home() {
	const [query, setQuery] = (0, import_react.useState)("");
	const [region, setRegion] = (0, import_react.useState)("all");
	const [prefecture, setPrefecture] = (0, import_react.useState)("all");
	const [kind, setKind] = (0, import_react.useState)("all");
	const [showRemoved, setShowRemoved] = (0, import_react.useState)(true);
	const [activeId, setActiveId] = (0, import_react.useState)(null);
	const [picked, setPicked] = (0, import_react.useState)([]);
	const [origin, setOrigin] = (0, import_react.useState)(null);
	const [geoMessage, setGeoMessage] = (0, import_react.useState)("");
	const [exportNote, setExportNote] = (0, import_react.useState)("");
	const [help, setHelp] = (0, import_react.useState)(null);
	const [visibleCount, setVisibleCount] = (0, import_react.useState)(40);
	const [MapView, setMapView] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		import("./camera-map-DlPLh7e4.mjs").then((mod) => {
			setMapView(() => mod.CameraMap);
		});
	}, []);
	const filtered = (0, import_react.useMemo)(() => {
		const needle = query.trim().toLowerCase();
		const regionPrefs = REGIONS.find((item) => item.id === region)?.prefectures ?? [];
		const allowed = prefecture === "all" && region !== "all" ? new Set(regionPrefs) : null;
		const list = CAMERAS.filter((camera) => {
			if (prefecture !== "all" && camera.prefecture !== prefecture) return false;
			if (allowed && !allowed.has(camera.prefecture)) return false;
			if (kind !== "all" && camera.kind !== kind) return false;
			if (!showRemoved && camera.status === "maybe-removed") return false;
			if (needle && !cameraSearchText(camera).includes(needle)) return false;
			return true;
		});
		if (!origin) return list;
		return [...list].sort((a, b) => distanceKm(a, origin) - distanceKm(b, origin));
	}, [
		query,
		prefecture,
		region,
		kind,
		showRemoved,
		origin
	]);
	const regionPrefs = REGIONS.find((item) => item.id === region)?.prefectures ?? [];
	(0, import_react.useEffect)(() => {
		setVisibleCount(40);
	}, [
		query,
		region,
		prefecture,
		kind,
		showRemoved
	]);
	const active = filtered.find((camera) => camera.id === activeId) ?? null;
	const exportSet = picked.length > 0 ? filtered.filter((camera) => picked.includes(camera.id)) : filtered;
	const copyExport = async (format) => {
		const filename = format === "kml" ? "japan-speed-cameras.kml" : "japan-speed-cameras.csv";
		const content = format === "kml" ? toKml(exportSet) : toCsv(exportSet);
		try {
			await navigator.clipboard.writeText(content);
			setExportNote(`已複製。開記事本貼上，另存新檔，檔名 ${filename}，存檔類型選「所有檔案」。`);
		} catch {
			setHelp(format);
			setExportNote("無法寫入剪貼簿。請在下面文字框按 Ctrl+A、Ctrl+C，再貼到記事本另存。");
		}
	};
	const onExportClick = (format) => {
		if (exportSet.length === 0) return;
		const filename = format === "kml" ? "japan-speed-cameras.kml" : "japan-speed-cameras.csv";
		const mime = format === "kml" ? "application/vnd.google-earth.kml+xml" : "text/csv";
		const framed = window.parent !== window;
		if (framed) setHelp(format);
		setExportNote(framed ? `已要求下載 ${filename}。請看瀏覽器的「下載」資料夾，不是桌面。若沒有檔案，請複製下面的內容另存。` : `已開始下載 ${filename}。請開檔案總管左側的「下載」（Downloads）。電腦預設不會跳出另存視窗，也不會放在桌面。`);
		try {
			const content = format === "kml" ? toKml(exportSet) : toCsv(exportSet);
			const file = mobileShareFile(filename, content, mime);
			if (file && typeof navigator.share === "function") {
				navigator.share({
					files: [file],
					title: filename
				}).then(() => setExportNote("已開啟分享。請選「儲存到檔案」或「雲端硬碟」。"), (error) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						setExportNote("已取消。");
						return;
					}
					setHelp(format);
					setExportNote("分享沒成功。請複製下面的內容，用記事本另存。");
				});
				return;
			}
			if (!content) return;
			const link = document.createElement("a");
			const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 6e4);
		} catch (error) {
			setHelp(format);
			setExportNote(error instanceof Error ? error.message : "下載失敗。請改用複製。");
		}
	};
	const togglePick = (id) => {
		setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
	};
	const selectVisible = () => {
		const ids = filtered.map((camera) => camera.id);
		const allOn = ids.every((id) => picked.includes(id));
		setPicked(allOn ? picked.filter((id) => !ids.includes(id)) : [.../* @__PURE__ */ new Set([...picked, ...ids])]);
	};
	const locate = () => {
		if (!navigator.geolocation) {
			setGeoMessage("這個瀏覽器不能定位。");
			return;
		}
		setGeoMessage("定位中…");
		navigator.geolocation.getCurrentPosition((position) => {
			setOrigin({
				lat: position.coords.latitude,
				lon: position.coords.longitude
			});
			setGeoMessage("已依你的位置排序。");
		}, () => setGeoMessage("沒有拿到位置，仍可搜尋縣市或道路。"), {
			enableHighAccuracy: true,
			timeout: 8e3
		});
	};
	const onSelect = (0, import_react.useCallback)((id) => {
		setActiveId(id);
	}, []);
	const visibleAllPicked = filtered.length > 0 && filtered.every((camera) => picked.includes(camera.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-dvh bg-bg text-fg lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "shrink-0 border-b border-line px-4 py-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-amber",
							children: "日本全國"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-bold tracking-tight",
							children: "測速點搜尋"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 max-w-2xl text-sm text-muted",
							children: "搜尋全國測速點。收進 OpenStreetMap 實測點，以及オービスガイド公開地圖上的圖示。勾選後可匯出到 Google 我的地圖。不是警察官方清單。"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "搜尋"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: query,
							onChange: (event) => setQuery(event.target.value),
							placeholder: "搜尋道路、市町村，例如 中央自動車道、札幌、那霸",
							className: "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none placeholder:text-muted focus:border-amber"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2 overflow-x-auto pb-1",
						children: REGIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
							pressed: region === item.id,
							onClick: () => {
								setRegion(item.id);
								setPrefecture("all");
							},
							label: item.label
						}, item.id))
					}),
					region !== "all" && regionPrefs.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2 overflow-x-auto pb-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
							pressed: prefecture === "all",
							onClick: () => setPrefecture("all"),
							label: "這個地區"
						}), regionPrefs.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
							pressed: prefecture === id,
							onClick: () => setPrefecture(id),
							label: PREFECTURE_SHORT[id]
						}, id))]
					}) : null,
					region === "all" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block max-w-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "都道府縣"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: prefecture,
							onChange: (event) => setPrefecture(event.target.value),
							className: "h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-fg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "all",
								children: "全都道府縣"
							}), REGIONS.flatMap((item) => item.prefectures).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: id,
								children: PREFECTURE_LABEL[id]
							}, id))]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							KINDS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
								pressed: kind === item.id,
								onClick: () => setKind(item.id),
								label: item.label
							}, item.id)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
								pressed: showRemoved,
								onClick: () => setShowRemoved((value) => !value),
								label: showRemoved ? "含可能已撤除" : "隱藏已撤除"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
								pressed: Boolean(origin),
								onClick: locate,
								label: "依我的位置"
							})
						]
					})
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "map-frame",
				children: MapView ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapView, {
					cameras: filtered,
					activeId: active?.id ?? null,
					onSelect
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid h-full place-items-center text-sm text-muted",
					children: "地圖載入中"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex min-h-0 flex-col border-line lg:overflow-y-auto lg:border-l",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: [
								"顯示 ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-fg",
									children: filtered.length
								}),
								" / ",
								CAMERAS.length,
								" 筆",
								geoMessage ? `・${geoMessage}` : ""
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: selectVisible,
							className: "min-h-11 rounded-lg px-3 text-sm font-medium text-amber",
							children: visibleAllPicked ? "取消全選" : `全選 ${filtered.length} 筆`
						})]
					}),
					filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 py-8 text-sm text-muted",
						children: "沒有符合的地點。公開地圖在這個範圍的圖示本來就少，不代表路上沒有取締。"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "flex-1",
						children: [filtered.slice(0, visibleCount).map((camera) => {
							const selected = active?.id === camera.id;
							const checked = picked.includes(camera.id);
							const km = origin ? distanceKm(camera, origin) : null;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: selected ? "bg-surface-2" : "bg-bg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2 border-b border-line px-3 py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid min-h-11 min-w-11 place-items-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "sr-only",
											children: ["匯出 ", camera.name]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked,
											onChange: () => togglePick(camera.id),
											className: "size-5 accent-amber"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setActiveId(camera.id),
										className: "min-w-0 flex-1 text-left",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex flex-wrap items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium",
													children: camera.name
												}), camera.status === "maybe-removed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "可能已撤除" }) : null]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mt-1 block text-sm text-muted",
												children: [
													PREFECTURE_LABEL[camera.prefecture],
													" ",
													camera.city,
													" · ",
													KIND_LABEL[camera.kind],
													km !== null ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} 公里` : ""
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mt-1 block text-sm text-muted",
												children: [
													camera.road,
													" · ",
													camera.direction
												]
											})
										]
									})]
								}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Detail, { camera }) : null]
							}, camera.id);
						}), filtered.length > visibleCount ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "border-b border-line px-4 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setVisibleCount((count) => count + 60),
								className: "min-h-11 text-sm font-medium text-amber",
								children: [
									"還有 ",
									filtered.length - visibleCount,
									" 筆，繼續顯示"
								]
							})
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sticky bottom-0 border-t border-line bg-surface px-4 py-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: picked.length > 0 ? `匯出勾選的 ${exportSet.length} 筆` : `未勾選時匯出目前 ${exportSet.length} 筆`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onExportClick("kml"),
										disabled: exportSet.length === 0,
										className: "min-h-11 rounded-xl bg-amber px-4 text-sm font-bold text-amber-ink disabled:opacity-40",
										children: "下載 KML"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onExportClick("csv"),
										disabled: exportSet.length === 0,
										className: "min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-40",
										children: "下載 CSV"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void copyExport("kml"),
										disabled: exportSet.length === 0,
										className: "min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-40",
										children: "複製 KML"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: "https://www.google.com/maps/d/",
										target: "_blank",
										rel: "noreferrer",
										className: "inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium",
										children: "開啟 Google 我的地圖"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								"data-export-note": true,
								className: "mt-2 text-sm text-muted",
								children: exportNote || "下載後請到瀏覽器的「下載」資料夾找檔案，不是桌面。預覽若沒有檔案，用「複製 KML」貼到記事本另存。"
							}),
							help ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 rounded-xl border border-line bg-bg p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium",
										children: help === "kml" ? "japan-speed-cameras.kml" : "japan-speed-cameras.csv"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-sm text-muted",
										children: [
											"若「下載」資料夾沒有檔案，請按複製，或在框裡全選後複製，貼到記事本另存。存檔類型選「所有檔案」，副檔名用",
											" ",
											help === "kml" ? ".kml" : ".csv",
											"。"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onExportClick(help),
										className: "mt-2 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium",
										children: "再存一次"
									}),
									(help === "kml" ? toKml(exportSet) : toCsv(exportSet)).length > 12e4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm text-muted",
										children: "筆數很多，不在畫面上展開全文。請按複製全部，或直接下載。"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										readOnly: true,
										value: help === "kml" ? toKml(exportSet) : toCsv(exportSet),
										onFocus: (event) => event.currentTarget.select(),
										className: "mt-2 h-28 w-full resize-y rounded-lg border border-line bg-surface p-2 font-mono text-xs"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void copyExport(help),
										className: "mt-2 min-h-11 rounded-xl bg-amber px-4 text-sm font-bold text-amber-ink",
										children: "複製全部"
									})
								]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs leading-relaxed text-muted",
								children: "不是警察官方清單。指南地圖是オービスガイド公開圖示的針尖，不是柱位實測，也沒標固定或移動。速限數字是路段標示，不是拍攝門檻。請遵守速限。"
							})
						]
					})
				]
			})]
		})]
	});
}
function Detail({ camera }) {
	const [copied, setCopied] = (0, import_react.useState)(false);
	const coord = `${camera.lat.toFixed(6)}, ${camera.lon.toFixed(6)}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-line bg-surface px-4 py-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
				camera.system,
				camera.limitKph ? ` · 路段約 ${camera.limitKph} km/h` : "",
				` · ${ACCURACY_LABEL[camera.accuracy]}`
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-muted",
				children: camera.note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-muted",
				children: [
					"來源：",
					camera.source,
					"（",
					camera.updated,
					"）"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: googleMapsUrl(camera),
					target: "_blank",
					rel: "noreferrer",
					className: "inline-flex min-h-11 items-center rounded-lg bg-amber px-3 font-bold text-amber-ink",
					children: "在 Google 地圖開啟"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "min-h-11 rounded-lg border border-line px-3",
					onClick: () => {
						navigator.clipboard.writeText(coord).then(() => {
							setCopied(true);
						});
					},
					children: copied ? "已複製座標" : coord
				})]
			})
		]
	});
}
function FilterChip({ label, pressed, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-pressed": pressed,
		onClick,
		className: `min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${pressed ? "bg-amber text-amber-ink" : "bg-surface-2 text-fg"}`,
		children: label
	});
}
function Badge({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded-full border border-line px-2 py-0.5 text-xs text-muted",
		children
	});
}
//#endregion
export { Home as component };
