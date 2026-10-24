import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ACCURACY_LABEL,
  CAMERAS,
  KIND_LABEL,
  KINDS,
  PREFECTURE_LABEL,
  PREFECTURE_SHORT,
  REGIONS,
  cameraSearchText,
  type Camera,
  type CameraKind,
  type PrefectureId,
  type RegionId,
} from "@/data/cameras";
import { AppNav } from "@/components/app-nav";
import { googleMapsUrl, mobileShareFile, toCsv, toKml } from "@/lib/google-export";

export const Route = createFileRoute("/search")({ component: Home });

type MapProps = {
  cameras: Camera[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

type Origin = { lat: number; lon: number };

function distanceKm(camera: Camera, origin: Origin): number {
  const earth = 6371;
  const p1 = (origin.lat * Math.PI) / 180;
  const p2 = (camera.lat * Math.PI) / 180;
  const dLat = ((camera.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((camera.lon - origin.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<RegionId>("all");
  const [prefecture, setPrefecture] = useState<PrefectureId | "all">("all");
  const [kind, setKind] = useState<CameraKind | "all">("all");
  const [showRemoved, setShowRemoved] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [exportNote, setExportNote] = useState("");
  const [help, setHelp] = useState<"kml" | "csv" | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const [MapView, setMapView] = useState<ComponentType<MapProps> | null>(null);

  useEffect(() => {
    void import("@/components/camera-map").then((mod) => {
      setMapView(() => mod.CameraMap);
    });
  }, []);

  const filtered = useMemo(() => {
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
  }, [query, prefecture, region, kind, showRemoved, origin]);
  const regionPrefs = REGIONS.find((item) => item.id === region)?.prefectures ?? [];

  useEffect(() => {
    setVisibleCount(40);
  }, [query, region, prefecture, kind, showRemoved]);

  const active = filtered.find((camera) => camera.id === activeId) ?? null;
  const exportSet =
    picked.length > 0 ? filtered.filter((camera) => picked.includes(camera.id)) : filtered;

  const copyExport = async (format: "kml" | "csv") => {
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

  const onExportClick = (format: "kml" | "csv") => {
    if (exportSet.length === 0) return;
    const filename = format === "kml" ? "japan-speed-cameras.kml" : "japan-speed-cameras.csv";
    const mime = format === "kml" ? "application/vnd.google-earth.kml+xml" : "text/csv";
    const framed = window.parent !== window;
    if (framed) setHelp(format);
    setExportNote(
      framed
        ? `已要求下載 ${filename}。請看瀏覽器的「下載」資料夾，不是桌面。若沒有檔案，請複製下面的內容另存。`
        : `已開始下載 ${filename}。請開檔案總管左側的「下載」（Downloads）。電腦預設不會跳出另存視窗，也不會放在桌面。`,
    );
    try {
      const content = format === "kml" ? toKml(exportSet) : toCsv(exportSet);
      const file = mobileShareFile(filename, content, mime);
      if (file && typeof navigator.share === "function") {
        void navigator.share({ files: [file], title: filename }).then(
          () => setExportNote("已開啟分享。請選「儲存到檔案」或「雲端硬碟」。"),
          (error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") {
              setExportNote("已取消。");
              return;
            }
            setHelp(format);
            setExportNote("分享沒成功。請複製下面的內容，用記事本另存。");
          },
        );
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
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setHelp(format);
      setExportNote(error instanceof Error ? error.message : "下載失敗。請改用複製。");
    }
  };

  const togglePick = (id: string) => {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const selectVisible = () => {
    const ids = filtered.map((camera) => camera.id);
    const allOn = ids.every((id) => picked.includes(id));
    setPicked(allOn ? picked.filter((id) => !ids.includes(id)) : [...new Set([...picked, ...ids])]);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoMessage("這個瀏覽器不能定位。");
      return;
    }
    setGeoMessage("定位中…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
        setGeoMessage("已依你的位置排序。");
      },
      () => setGeoMessage("沒有拿到位置，仍可搜尋縣市或道路。"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const onSelect = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const visibleAllPicked =
    filtered.length > 0 && filtered.every((camera) => picked.includes(camera.id));

  return (
    <main className="min-h-dvh bg-bg text-fg lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <header className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex flex-col gap-3">
          <AppNav current="search" />
          <div>
            <p className="text-sm font-medium text-amber">日本全國</p>
            <h1 className="text-2xl font-bold tracking-tight">測速點搜尋</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              搜尋全國測速點。收進 OpenStreetMap 實測點，以及オービスガイド公開地圖上的圖示。勾選後可匯出到 Google 我的地圖。不是警察官方清單。路上要聽聲音、看沿途測速，請開「行車警示」。
            </p>
          </div>
          <label className="block">
            <span className="sr-only">搜尋</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋道路、市町村，例如 中央自動車道、札幌、那霸"
              className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none placeholder:text-muted focus:border-amber"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {REGIONS.map((item) => (
              <FilterChip
                key={item.id}
                pressed={region === item.id}
                onClick={() => {
                  setRegion(item.id);
                  setPrefecture("all");
                }}
                label={item.label}
              />
            ))}
          </div>
          {region !== "all" && regionPrefs.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                pressed={prefecture === "all"}
                onClick={() => setPrefecture("all")}
                label="這個地區"
              />
              {regionPrefs.map((id) => (
                <FilterChip
                  key={id}
                  pressed={prefecture === id}
                  onClick={() => setPrefecture(id)}
                  label={PREFECTURE_SHORT[id]}
                />
              ))}
            </div>
          ) : null}
          {region === "all" ? (
            <label className="block max-w-xs">
              <span className="sr-only">都道府縣</span>
              <select
                value={prefecture}
                onChange={(event) => setPrefecture(event.target.value as PrefectureId | "all")}
                className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-fg"
              >
                <option value="all">全都道府縣</option>
                {REGIONS.flatMap((item) => item.prefectures).map((id) => (
                  <option key={id} value={id}>
                    {PREFECTURE_LABEL[id]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <FilterChip
                key={item.id}
                pressed={kind === item.id}
                onClick={() => setKind(item.id)}
                label={item.label}
              />
            ))}
            <FilterChip
              pressed={showRemoved}
              onClick={() => setShowRemoved((value) => !value)}
              label={showRemoved ? "含可能已撤除" : "隱藏已撤除"}
            />
            <FilterChip pressed={Boolean(origin)} onClick={locate} label="依我的位置" />
          </div>
        </div>
      </header>

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="map-frame">
          {MapView ? (
            <MapView cameras={filtered} activeId={active?.id ?? null} onSelect={onSelect} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">地圖載入中</div>
          )}
        </div>

        <section className="flex min-h-0 flex-col border-line lg:overflow-y-auto lg:border-l">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm text-muted">
              顯示 <span className="font-medium text-fg">{filtered.length}</span> / {CAMERAS.length} 筆
              {geoMessage ? `・${geoMessage}` : ""}
            </p>
            <button
              type="button"
              onClick={selectVisible}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-amber"
            >
              {visibleAllPicked ? "取消全選" : `全選 ${filtered.length} 筆`}
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              沒有符合的地點。公開地圖在這個範圍的圖示本來就少，不代表路上沒有取締。
            </p>
          ) : (
            <ul className="flex-1">
              {filtered.slice(0, visibleCount).map((camera) => {
                const selected = active?.id === camera.id;
                const checked = picked.includes(camera.id);
                const km = origin ? distanceKm(camera, origin) : null;
                return (
                  <li key={camera.id} className={selected ? "bg-surface-2" : "bg-bg"}>
                    <div className="flex gap-2 border-b border-line px-3 py-3">
                      <label className="grid min-h-11 min-w-11 place-items-center">
                        <span className="sr-only">匯出 {camera.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePick(camera.id)}
                          className="size-5 accent-amber"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveId(camera.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{camera.name}</span>
                          {camera.status === "maybe-removed" ? (
                            <Badge>可能已撤除</Badge>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-sm text-muted">
                          {PREFECTURE_LABEL[camera.prefecture]} {camera.city}
                          {" · "}
                          {KIND_LABEL[camera.kind]}
                          {km !== null ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} 公里` : ""}
                        </span>
                        <span className="mt-1 block text-sm text-muted">
                          {camera.road} · {camera.direction}
                        </span>
                      </button>
                    </div>
                    {selected ? <Detail camera={camera} /> : null}
                  </li>
                );
              })}
              {filtered.length > visibleCount ? (
                <li className="border-b border-line px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + 60)}
                    className="min-h-11 text-sm font-medium text-amber"
                  >
                    還有 {filtered.length - visibleCount} 筆，繼續顯示
                  </button>
                </li>
              ) : null}
            </ul>
          )}

          <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
            <p className="text-sm text-muted">
              {picked.length > 0
                ? `匯出勾選的 ${exportSet.length} 筆`
                : `未勾選時匯出目前 ${exportSet.length} 筆`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onExportClick("kml")}
                disabled={exportSet.length === 0}
                className="min-h-11 rounded-xl bg-amber px-4 text-sm font-bold text-amber-ink disabled:opacity-40"
              >
                下載 KML
              </button>
              <button
                type="button"
                onClick={() => onExportClick("csv")}
                disabled={exportSet.length === 0}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-40"
              >
                下載 CSV
              </button>
              <button
                type="button"
                onClick={() => void copyExport("kml")}
                disabled={exportSet.length === 0}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-40"
              >
                複製 KML
              </button>
              <a
                href="https://www.google.com/maps/d/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium"
              >
                開啟 Google 我的地圖
              </a>
            </div>
            <p data-export-note className="mt-2 text-sm text-muted">
              {exportNote ||
                "下載後請到瀏覽器的「下載」資料夾找檔案，不是桌面。預覽若沒有檔案，用「複製 KML」貼到記事本另存。"}
            </p>
            {help ? (
              <div className="mt-3 rounded-xl border border-line bg-bg p-3">
                <p className="text-sm font-medium">
                  {help === "kml" ? "japan-speed-cameras.kml" : "japan-speed-cameras.csv"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  若「下載」資料夾沒有檔案，請按複製，或在框裡全選後複製，貼到記事本另存。存檔類型選「所有檔案」，副檔名用{" "}
                  {help === "kml" ? ".kml" : ".csv"}。
                </p>
                <button
                  type="button"
                  onClick={() => onExportClick(help)}
                  className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium"
                >
                  再存一次
                </button>
                {((help === "kml" ? toKml(exportSet) : toCsv(exportSet)).length > 120_000) ? (
                  <p className="mt-2 text-sm text-muted">筆數很多，不在畫面上展開全文。請按複製全部，或直接下載。</p>
                ) : (
                <textarea
                  readOnly
                  value={help === "kml" ? toKml(exportSet) : toCsv(exportSet)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-2 h-28 w-full resize-y rounded-lg border border-line bg-surface p-2 font-mono text-xs"
                />
                )}
                <button
                  type="button"
                  onClick={() => void copyExport(help)}
                  className="mt-2 min-h-11 rounded-xl bg-amber px-4 text-sm font-bold text-amber-ink"
                >
                  複製全部
                </button>
              </div>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              不是警察官方清單。指南地圖是オービスガイド公開圖示的針尖，不是柱位實測，也沒標固定或移動。速限數字是路段標示，不是拍攝門檻。請遵守速限。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Detail({ camera }: { camera: Camera }) {
  const [copied, setCopied] = useState(false);
  const coord = `${camera.lat.toFixed(6)}, ${camera.lon.toFixed(6)}`;
  return (
    <div className="border-b border-line bg-surface px-4 py-3 text-sm">
      <p>
        {camera.system}
        {camera.limitKph ? ` · 路段約 ${camera.limitKph} km/h` : ""}
        {` · ${ACCURACY_LABEL[camera.accuracy]}`}
      </p>
      <p className="mt-2 text-muted">{camera.note}</p>
      <p className="mt-2 text-muted">
        來源：{camera.source}（{camera.updated}）
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleMapsUrl(camera)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg bg-amber px-3 font-bold text-amber-ink"
        >
          在 Google 地圖開啟
        </a>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line px-3"
          onClick={() => {
            void navigator.clipboard.writeText(coord).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? "已複製座標" : coord}
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
        pressed ? "bg-amber text-amber-ink" : "bg-surface-2 text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{children}</span>
  );
}
