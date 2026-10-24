import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Navigation2, Volume2, VolumeX } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import {
  ACCURACY_LABEL,
  CAMERAS,
  KIND_LABEL,
  PREFECTURE_LABEL,
  type Camera,
} from "@/data/cameras";
import { paintFloatHud, paintPipDocument, toFloatHud, type FloatHud } from "@/lib/float-hud";
import {
  approachStart,
  evaluate,
  formatDistance,
  formatEta,
  haversineM,
  initialBearing,
  offsetMeters,
  sideLabel,
  stageFor,
  voiceText,
  type Approach,
  type WarnStage,
} from "@/lib/warn";
import {
  CORRIDOR_M,
  camerasAlongRoute,
  googleNavigateQuery,
  googleNavigateUrl,
  photonSearchUrl,
  pickPlace,
  progressAlongM,
  osrmRouteUrl,
  readRoute,
  simplifyLine,
  type Place,
} from "@/lib/route";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "行車警示｜日本測速點" },
      {
        name: "description",
        content: "接近日本測速照相時發出聲音。可規劃路線、列出沿途測速，再交給 Google 地圖導航。不是警察官方清單。",
      },
    ],
  }),
  component: WarnPage,
});

const STORAGE_KEY = "japan-warn-settings";
const DEMO_ID = "fixed-kitoku";
const DEMO_SPEED_KPH = 90;
const RADII = [
  { id: 400, label: "400 公尺" },
  { id: 800, label: "800 公尺" },
  { id: 1200, label: "1.2 公里" },
] as const;

type Live = {
  lat: number;
  lon: number;
  speedKph: number | null;
  heading: number | null;
  accuracyM: number | null;
  source: "gps" | "demo";
  ts: number;
};

type Settings = {
  radiusM: 400 | 800 | 1200;
  aheadOnly: boolean;
  voice: boolean;
  beep: boolean;
  includeRemoved: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  radiusM: 800,
  aheadOnly: true,
  voice: true,
  beep: true,
  includeRemoved: false,
};

function formatTrip(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `約 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `約 ${hours} 小時` : `約 ${hours} 小時 ${rest} 分`;
}

function WarnPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [mode, setMode] = useState<"idle" | "gps" | "demo">("idle");
  const [geoNote, setGeoNote] = useState("");
  const [demoName, setDemoName] = useState("");
  const [floatKind, setFloatKind] = useState<"off" | "pip" | "dock">("off");
  const [floatNote, setFloatNote] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [plannedLine, setPlannedLine] = useState<{ distanceM: number; durationS: number; line: { lat: number; lon: number }[] } | null>(null);
  const [planNote, setPlanNote] = useState("");
  const [planning, setPlanning] = useState(false);
  const watchId = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const liveRef = useRef<Live | null>(null);
  const demoCam = useRef<Camera | null>(null);
  const minDist = useRef(Infinity);
  const audioRef = useRef<AudioContext | null>(null);
  const lastSpoken = useRef({ key: "", at: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  const hudRef = useRef<FloatHud>({
    speed: "—",
    headline: "前方淨空",
    detail: "尚未定位",
    road: "可跟 Google 地圖同時用",
    hot: false,
  });

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings((current) => ({
          ...current,
          radiusM: parsed.radiusM === 400 || parsed.radiusM === 800 || parsed.radiusM === 1200 ? parsed.radiusM : current.radiusM,
          aheadOnly: typeof parsed.aheadOnly === "boolean" ? parsed.aheadOnly : current.aheadOnly,
          voice: typeof parsed.voice === "boolean" ? parsed.voice : current.voice,
          beep: typeof parsed.beep === "boolean" ? parsed.beep : current.beep,
          includeRemoved: typeof parsed.includeRemoved === "boolean" ? parsed.includeRemoved : current.includeRemoved,
        }));
      }
    } catch {
      /* ignore broken local settings */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  const stopDemo = () => {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const stopGps = () => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
  };

  useEffect(() => {
    return () => {
      stopDemo();
      stopGps();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (mode === "idle" && floatKind === "off") return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (!navigator.wakeLock) return;
      void navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {});
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [mode, floatKind]);

  const result = useMemo(() => {
    if (!live) return null;
    return evaluate(CAMERAS, live, {
      radiusM: settings.radiusM,
      aheadOnly: settings.aheadOnly,
      includeRemoved: settings.includeRemoved,
      speedKph: live.speedKph,
    });
  }, [live, settings.radiusM, settings.aheadOnly, settings.includeRemoved]);

  const primary = result?.primary ?? null;
  const stage = primary ? stageFor(primary.distanceM, settings.radiusM) : null;
  const hud = toFloatHud({
    speedKph: live?.speedKph ?? null,
    tracking: mode !== "idle",
    stage,
    distance: primary ? formatDistance(primary.distanceM) : null,
    eta: primary?.etaSec != null ? formatEta(primary.etaSec) : null,
    road: primary ? primary.camera.road || primary.camera.name : null,
  });
  hudRef.current = hud;

  useEffect(() => {
    if (floatKind === "off") return;
    const tick = () => {
      const next = hudRef.current;
      if (canvasRef.current) paintFloatHud(canvasRef.current, next);
      const pip = pipWinRef.current;
      if (pip && !pip.closed) paintPipDocument(pip, next);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [floatKind]);

  useEffect(() => {
    if (!primary || !stage || mode === "idle") return;
    const key = `${primary.camera.id}:${stage}`;
    const now = Date.now();
    if (lastSpoken.current.key === key && now - lastSpoken.current.at < 8000) return;
    lastSpoken.current = { key, at: now };
    if (settings.beep) playTone(audioRef.current, stage);
    if (settings.voice) speak(voiceText(primary, stage));
  }, [primary, stage, mode, settings.beep, settings.voice]);

  const ensureAudio = () => {
    if (audioRef.current) {
      void audioRef.current.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioRef.current = new Ctx();
    void audioRef.current.resume().catch(() => {});
  };

  const startGps = () => {
    ensureAudio();
    stopDemo();
    setDemoName("");
    if (!navigator.geolocation) {
      setGeoNote("這支瀏覽器沒有定位。請改用試跑。");
      setMode("idle");
      return;
    }
    setGeoNote("正在定位…");
    setMode("gps");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLon = pos.coords.longitude;
        const prev = liveRef.current;
        let speedKph =
          pos.coords.speed == null || Number.isNaN(pos.coords.speed) ? null : Math.max(0, pos.coords.speed * 3.6);
        let heading =
          pos.coords.heading == null || Number.isNaN(pos.coords.heading) ? null : pos.coords.heading;
        if (prev && prev.source === "gps") {
          const dt = (pos.timestamp - prev.ts) / 1000;
          if (dt > 0.4 && dt < 15) {
            const moved = haversineM(prev.lat, prev.lon, nextLat, nextLon);
            if (speedKph == null) speedKph = (moved / dt) * 3.6;
            if (heading == null && moved > 8) {
              heading = (initialBearing(prev.lat, prev.lon, nextLat, nextLon) + 360) % 360;
            }
          }
        }
        const next: Live = {
          lat: nextLat,
          lon: nextLon,
          speedKph,
          heading,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          source: "gps",
          ts: pos.timestamp,
        };
        liveRef.current = next;
        setLive(next);
        setGeoNote("");
      },
      (error) => {
        setMode("idle");
        setGeoNote(
          error.code === 1
            ? "定位被拒絕。這個預覽通常拿不到定位，請按試跑看警示。"
            : "定位失敗。可改按試跑，聽一段接近測速點的示範。",
        );
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );
  };

  const startDemo = () => {
    ensureAudio();
    stopGps();
    stopDemo();
    const camera = CAMERAS.find((item) => item.id === DEMO_ID) ?? CAMERAS[0];
    if (!camera) return;
    demoCam.current = camera;
    const start = approachStart(camera, 760);
    minDist.current = 760;
    const next: Live = {
      lat: start.lat,
      lon: start.lon,
      speedKph: DEMO_SPEED_KPH,
      heading: start.heading,
      accuracyM: 5,
      source: "demo",
      ts: Date.now(),
    };
    liveRef.current = next;
    setLive(next);
    setDemoName(`${camera.road}・${camera.name}`);
    setGeoNote("");
    setMode("demo");
    lastSpoken.current = { key: "", at: 0 };
    timer.current = window.setInterval(() => {
      const target = demoCam.current;
      const prev = liveRef.current;
      if (!target || !prev) return;
      const step = (DEMO_SPEED_KPH / 3.6) * 0.5;
      const moved = offsetMeters(prev.lat, prev.lon, prev.heading ?? 0, step);
      const dist = haversineM(moved.lat, moved.lon, target.lat, target.lon);
      if (dist < minDist.current) minDist.current = dist;
      const passed = minDist.current < 180 && dist > minDist.current + 45;
      const following: Live = {
        lat: moved.lat,
        lon: moved.lon,
        speedKph: DEMO_SPEED_KPH,
        heading: 0,
        accuracyM: 5,
        source: "demo",
        ts: Date.now(),
      };
      liveRef.current = following;
      setLive(following);
      if (passed) {
        stopDemo();
        setMode("idle");
        setGeoNote("試跑已通過該測速點。可再試一次，或改用真實定位。");
      }
    }, 500);
  };

  const stopAll = () => {
    stopDemo();
    stopGps();
    window.speechSynthesis?.cancel();
    setMode("idle");
  };

  const stopFloat = () => {
    const pip = pipWinRef.current;
    pipWinRef.current = null;
    if (pip && !pip.closed) pip.close();
    const video = videoRef.current;
    if (video && document.pictureInPictureElement === video) {
      void document.exitPictureInPicture().catch(() => {});
    }
    setFloatKind("off");
  };

  const startFloat = () => {
    ensureAudio();
    const docPip = (
      window as unknown as {
        documentPictureInPicture?: {
          requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;
    const pipRequest = docPip ? docPip.requestWindow({ width: 400, height: 220 }) : null;
    void (async () => {
      if (pipRequest) {
        try {
          const pip = await pipRequest;
          pipWinRef.current = pip;
          paintPipDocument(pip, hudRef.current);
          pip.addEventListener("pagehide", () => {
            pipWinRef.current = null;
            setFloatKind("dock");
            setFloatNote("小窗已關閉。還能用分割畫面：這個警示在上，Google 地圖在下。");
          });
          setFloatKind("pip");
          setFloatNote("小窗已浮在最上層。切到 Google 地圖繼續導航，接近測速點仍會響。");
          return;
        } catch {
          pipWinRef.current = null;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 540;
      canvasRef.current = canvas;
      paintFloatHud(canvas, hudRef.current);
      const video = videoRef.current ?? document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
      if (!video.parentNode) document.body.appendChild(video);
      videoRef.current = video;
      video.onleavepictureinpicture = () => {
        setFloatKind("dock");
        setFloatNote("小窗已關閉。還能用分割畫面：這個警示在上，Google 地圖在下。");
      };
      try {
        if (!video.srcObject) video.srcObject = canvas.captureStream(5);
        await video.play();
        if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          setFloatKind("pip");
          setFloatNote("小窗已浮在最上層。切到 Google 地圖繼續導航，接近時視窗和聲音都會留著。");
          return;
        }
      } catch {
        /* this preview cannot draw over other apps */
      }
      video.remove();
      videoRef.current = null;
      canvasRef.current = null;
      setFloatKind("dock");
      setFloatNote("這裡不能蓋到其他 App。按手機多工鍵，把這個警示放上面、Google 地圖放下面，就能一邊導航一邊聽警示。");
    })();
  };

  const routeHits = useMemo(() => {
    if (!plannedLine) return [];
    return camerasAlongRoute(CAMERAS, plannedLine.line, CORRIDOR_M, settings.includeRemoved);
  }, [plannedLine, settings.includeRemoved]);

  const routeProgress = useMemo(() => {
    if (!plannedLine || !live) return null;
    return progressAlongM(plannedLine.line, live);
  }, [plannedLine, live]);

  const routeAhead = routeHits.filter((hit) => !routeProgress || hit.alongM + 120 >= routeProgress.alongM);
  const mapsHref = destination
    ? googleNavigateUrl(destination, live ? { lat: live.lat, lon: live.lon } : null)
    : destQuery.trim()
      ? googleNavigateQuery(destQuery.trim())
      : "https://www.google.com/maps";

  const planRoute = () => {
    const query = destQuery.trim();
    if (!query) {
      setPlanNote("先輸入目的地。");
      return;
    }
    if (!live) {
      setDestination(null);
      setPlannedLine(null);
      setPlanNote("先按開始定位或試跑，才能從目前位置算出沿途測速。下面的 Google 地圖仍會用你手機自己的定位。");
      return;
    }
    const origin = { lat: live.lat, lon: live.lon };
    setPlanning(true);
    setPlanNote("正在找目的地…");
    void (async () => {
      try {
        const placeRes = await fetch(photonSearchUrl(query));
        if (!placeRes.ok) throw new Error("place");
        const place = pickPlace(await placeRes.json());
        if (!place) {
          setDestination(null);
          setPlannedLine(null);
          setPlanNote("找不到日本的這個地點。加上市町村再試，例如「香川 金刀比羅宮」。");
          return;
        }
        setDestination(place);
        setPlanNote("正在計算路線…");
        const routeRes = await fetch(osrmRouteUrl(origin, place));
        if (!routeRes.ok) throw new Error("route");
        const route = readRoute(await routeRes.json());
        if (!route) {
          setPlannedLine(null);
          setPlanNote("這段開車路線沒有算出來。仍可按「用 Google 地圖導航」。");
          return;
        }
        setPlannedLine({
          distanceM: route.distanceM,
          durationS: route.durationS,
          line: simplifyLine(route.line, 150),
        });
        setPlanNote("");
      } catch {
        setPlanNote("路線服務沒有回應。警示仍依你的前方繼續響，導航可改按 Google 地圖。");
      } finally {
        setPlanning(false);
      }
    })();
  };

  const overLimit =
    primary?.camera.limitKph != null && live?.speedKph != null && live.speedKph > primary.camera.limitKph;
  const farAway = result?.nearest != null && result.nearest.distanceM > 80_000;

  if (floatKind !== "off") {
    return (
      <main className="min-h-dvh bg-bg text-fg">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-3 px-4 py-4">
          <p className="text-sm font-medium text-amber">
            {floatKind === "pip" ? "已浮在其他 App 上" : "跟 Google 地圖一起用"}
          </p>
          <section className={hud.hot ? "warn-live rounded-xl bg-amber p-4 text-amber-ink" : "rounded-xl border border-line bg-surface p-4 text-fg"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{hud.headline}</p>
                <p id="warn-distance" className="mt-1 text-5xl font-bold leading-none tabular-nums">
                  {hud.detail}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold leading-none tabular-nums">{hud.speed}</p>
                <p className={`mt-1 text-sm ${hud.hot ? "text-amber-ink" : "text-muted"}`}>公里／時</p>
              </div>
            </div>
            <p className="mt-3 text-base font-medium break-words">{hud.road}</p>
            {plannedLine ? (
              <p className={`mt-2 text-sm ${hud.hot ? "text-amber-ink" : "text-muted"}`}>
                這條路線前方還有 {routeAhead.length} 處測速
              </p>
            ) : null}
          </section>
          <p className="text-sm text-muted">{floatNote}</p>
          <div className="grid gap-2">
            {mode === "gps" ? (
              <button type="button" onClick={stopAll} className="h-12 rounded-xl bg-amber text-base font-bold text-amber-ink">
                停止定位
              </button>
            ) : mode === "demo" ? (
              <button type="button" onClick={stopAll} className="h-12 rounded-xl bg-amber text-base font-bold text-amber-ink">
                停止試跑
              </button>
            ) : (
              <button type="button" onClick={startGps} className="h-12 rounded-xl bg-amber text-base font-bold text-amber-ink">
                開始定位
              </button>
            )}
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface text-base font-medium text-fg"
            >
              {destination || destQuery.trim() ? "用 Google 地圖導航" : "打開 Google 地圖"}
            </a>
            {mode === "idle" ? (
              <button type="button" onClick={startDemo} className="h-12 rounded-xl border border-line bg-surface text-base font-medium text-fg">
                試跑警示
              </button>
            ) : null}
            <button type="button" onClick={stopFloat} className="h-11 rounded-xl text-sm font-medium text-muted">
              收回完整畫面
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <AppNav current="warn" />
        <header>
          <p className="text-sm font-medium text-amber">日本全國・{CAMERAS.length.toLocaleString("zh-Hant")} 處</p>
          <h1 className="text-2xl font-bold tracking-tight">行車警示</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "demo"
              ? `試跑中：${demoName}。由南往北，時速 ${DEMO_SPEED_KPH}。不是你的定位。`
              : mode === "gps"
                ? live?.accuracyM != null
                  ? `定位中，精度約 ±${Math.round(live.accuracyM)} 公尺。`
                  : "定位中。"
                : geoNote || "尚未定位。資料已在這支程式裡，沒有網路也能比對。"}
          </p>
        </header>

        <section className="flex items-end justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-4">
          <div>
            <p className="text-sm text-muted">車速</p>
            <p className={`text-7xl font-bold leading-none tabular-nums tracking-tight ${overLimit ? "text-amber" : "text-fg"}`}>
              {live?.speedKph == null ? "—" : Math.round(live.speedKph)}
            </p>
          </div>
          <div className="pb-1 text-right">
            <p className="text-sm font-medium text-muted">公里／時</p>
            <p className="mt-1 text-sm text-muted">{overLimit ? "高於這段公布限速" : "GPS 時速，不是儀表"}</p>
          </div>
        </section>

        <AlertCard primary={primary} stage={stage} farAway={farAway} nearest={result?.nearest ?? null} radiusM={settings.radiusM} />

        <Radar
          live={live}
          around={result?.around ?? []}
          primaryId={primary?.camera.id ?? null}
          radiusM={settings.radiusM}
        />

        <div className="grid gap-2">
          {mode === "gps" ? (
            <button type="button" onClick={stopAll} className="h-14 rounded-xl bg-amber text-base font-bold text-amber-ink">
              停止定位
            </button>
          ) : (
            <button type="button" onClick={startGps} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-amber text-base font-bold text-amber-ink">
              <LocateFixed className="size-5" aria-hidden />
              開始定位
            </button>
          )}
          {mode === "demo" ? (
            <button type="button" onClick={stopAll} className="h-12 rounded-xl border border-line bg-surface text-base font-medium text-fg">
              停止試跑
            </button>
          ) : (
            <button type="button" onClick={startDemo} className="h-12 rounded-xl border border-line bg-surface text-base font-medium text-fg">
              試跑警示
            </button>
          )}
          <button type="button" onClick={startFloat} className="h-12 rounded-xl border border-amber bg-surface text-base font-bold text-amber">
            浮在 Google 地圖上
          </button>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <h2 className="text-lg font-bold">導航</h2>
            <p className="mt-1 text-sm text-muted">
              輸入目的地後，列出開車路線兩旁約 {CORRIDOR_M} 公尺內的測速。轉彎交給 Google 地圖，這個畫面負責響。
            </p>
          </div>
          <input
            value={destQuery}
            onChange={(event) => setDestQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") planRoute();
            }}
            placeholder="目的地，例如 高松站、金刀比羅宮"
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none placeholder:text-muted focus:border-amber"
          />
          <button
            type="button"
            onClick={planRoute}
            disabled={planning}
            className="h-12 rounded-xl bg-amber text-base font-bold text-amber-ink disabled:opacity-60"
          >
            {planning ? "規劃中…" : "列出沿途測速"}
          </button>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-bg text-base font-medium text-fg"
          >
            用 Google 地圖導航
          </a>
          {planNote ? <p className="text-sm text-muted">{planNote}</p> : null}
          {plannedLine && destination ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-fg">
                到 {destination.name} · {formatDistance(plannedLine.distanceM)} · {formatTrip(plannedLine.durationS)}
              </p>
              <p className="text-sm text-muted">
                沿途 {routeHits.length} 處，前方還有 {routeAhead.length} 處。
                {routeProgress && routeProgress.offM > 1500
                  ? ` 你已離開這條線約 ${formatDistance(routeProgress.offM)}，可再規劃一次。`
                  : ""}
              </p>
              {routeAhead.length === 0 ? (
                <p className="text-sm text-muted">這段剩下的路，收錄點裡沒有落在路線旁的測速。</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {routeAhead.slice(0, 8).map((hit) => {
                    const remain = routeProgress ? Math.max(0, hit.alongM - routeProgress.alongM) : hit.alongM;
                    return (
                      <li key={hit.camera.id} className="rounded-xl border border-line bg-bg px-3 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium text-fg">{hit.camera.road || hit.camera.name}</p>
                          <p className="shrink-0 text-sm tabular-nums text-amber">{formatDistance(remain)}</p>
                        </div>
                        <p className="text-sm text-muted">
                          {PREFECTURE_LABEL[hit.camera.prefecture]} {hit.camera.city} · {KIND_LABEL[hit.camera.kind]}
                          {hit.camera.limitKph ? ` · 公布 ${hit.camera.limitKph}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {routeAhead.length > 8 ? <p className="text-sm text-muted">還有 {routeAhead.length - 8} 處，開近了會在上面警示。</p> : null}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-muted">警示距離</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RADII.map((item) => (
                <Toggle
                  key={item.id}
                  on={settings.radiusM === item.id}
                  label={item.label}
                  onClick={() => setSettings((current) => ({ ...current, radiusM: item.id }))}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Toggle
              on={settings.aheadOnly}
              label="只報前方"
              onClick={() => setSettings((current) => ({ ...current, aheadOnly: !current.aheadOnly }))}
            />
            <Toggle
              on={settings.includeRemoved}
              label="含可能已拆除"
              onClick={() => setSettings((current) => ({ ...current, includeRemoved: !current.includeRemoved }))}
            />
            <Toggle
              on={settings.voice}
              label={settings.voice ? "語音開" : "語音關"}
              onClick={() => setSettings((current) => ({ ...current, voice: !current.voice }))}
            />
            <Toggle
              on={settings.beep}
              label={settings.beep ? "提示音開" : "提示音關"}
              onClick={() => setSettings((current) => ({ ...current, beep: !current.beep }))}
            />
          </div>
          <p className="text-sm text-muted">
            {settings.aheadOnly
              ? "有方向時，只警示車頭左右各約 55 度以內。時速約 90、距離 800 公尺時，大約還有 30 秒。"
              : "四周的點都會報，包含已經過的。"}
          </p>
        </section>

        {result && result.around.length > 0 ? (
          <section>
            <h2 className="text-sm font-medium text-muted">附近</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {result.around.map((item) => (
                <li key={item.camera.id} className="rounded-xl border border-line bg-surface px-3 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-fg">{item.camera.road || item.camera.name}</p>
                    <p className="shrink-0 text-sm tabular-nums text-amber">{formatDistance(item.distanceM)}</p>
                  </div>
                  <p className="text-sm text-muted">
                    {sideLabel(item.deltaDeg)} · {KIND_LABEL[item.camera.kind]}
                    {item.camera.limitKph ? ` · 公布 ${item.camera.limitKph}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="flex flex-col gap-2 pb-6 text-sm text-muted">
          <p className="inline-flex items-center gap-2">
            {settings.voice ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            提示音是兩聲到三聲。語音說的是距離和公布限速。
          </p>
          <p>
            不是警察官方清單。大多數點是オービスガイド公開地圖的針尖，大約差一百到兩百公尺，分不出固定或移動。限速是路旁公布的數字，不是拍照門檻。
          </p>
          <p>請看路，不要只看螢幕。導航轉彎用「用 Google 地圖導航」。要讓警示留在畫面上，按「浮在 Google 地圖上」，或用手機分割畫面。關掉這個畫面就不會再響。</p>
        </footer>
      </div>
    </main>
  );
}

function AlertCard({
  primary,
  stage,
  farAway,
  nearest,
  radiusM,
}: {
  primary: Approach<Camera> | null;
  stage: WarnStage | null;
  farAway: boolean;
  nearest: Approach<Camera> | null;
  radiusM: number;
}) {
  if (!primary || !stage) {
    const title = nearest == null ? "還沒開始" : farAway ? "離測速點還很遠" : "前方淨空";
    return (
      <section className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
        <p className="text-lg font-bold text-fg">{title}</p>
        <p className="mt-1 text-sm text-muted">
          {farAway
            ? `目前離已收錄的點還很遠。最近一處約 ${nearest ? formatDistance(nearest.distanceM) : ""}。人在日本、開著定位才會在路上響。`
            : nearest
              ? `警示距離 ${formatDistance(radiusM)} 內沒有要報的點。最近是${PREFECTURE_LABEL[nearest.camera.prefecture as Camera["prefecture"]]}${nearest.camera.city}，${formatDistance(nearest.distanceM)}。`
              : "按開始定位，或先試跑一段。試跑會朝香川縣一處固定式測速點開過去。"}
        </p>
      </section>
    );
  }

  const rough = primary.camera.kind === "guide" || primary.camera.accuracy === "approx";
  return (
    <section className="warn-live rounded-xl bg-amber p-4 text-amber-ink" aria-live="assertive">
      <p className="text-sm font-bold">
        {stage === "near" ? "即將通過" : stage === "mid" ? "接近中" : "前方測速"} · {sideLabel(primary.deltaDeg)}
      </p>
      <p id="warn-distance" className="mt-1 text-5xl font-bold leading-none tabular-nums">
        {formatDistance(primary.distanceM)}
      </p>
      {primary.etaSec != null ? <p className="mt-2 text-lg font-medium">{formatEta(primary.etaSec)}</p> : null}
      <p className="mt-3 text-base font-bold break-words">{primary.camera.road || primary.camera.name}</p>
      <p className="text-sm">
        {PREFECTURE_LABEL[primary.camera.prefecture]} {primary.camera.city} · {KIND_LABEL[primary.camera.kind]}
      </p>
      {primary.camera.direction ? <p className="text-sm">{primary.camera.direction}</p> : null}
      {primary.camera.limitKph ? (
        <p className="mt-2 text-sm font-medium">公布限速 {primary.camera.limitKph}，不是拍照門檻</p>
      ) : (
        <p className="mt-2 text-sm">這筆沒有公布限速</p>
      )}
      {rough ? <p className="mt-1 text-sm">公開地圖針尖，不是實測柱位。{ACCURACY_LABEL[primary.camera.accuracy]}</p> : null}
    </section>
  );
}

function Radar({
  live,
  around,
  primaryId,
  radiusM,
}: {
  live: Live | null;
  around: Approach<Camera>[];
  primaryId: string | null;
  radiusM: number;
}) {
  const plotted = around.filter((item) => item.distanceM <= radiusM);
  return (
    <section>
      <div className="relative mx-auto size-64 rounded-full border border-line bg-surface">
        <div className="absolute inset-8 rounded-full border border-line" />
        <div className="absolute inset-16 rounded-full border border-line" />
        {plotted.map((item) => {
          const rel = live?.heading == null ? item.bearingDeg : ((item.bearingDeg - live.heading + 540) % 360) - 180;
          const rad = (rel * Math.PI) / 180;
          const scale = Math.min(item.distanceM / radiusM, 1);
          const x = Math.sin(rad) * scale * 40;
          const y = -Math.cos(rad) * scale * 40;
          const hot = item.camera.id === primaryId;
          return (
            <span
              key={item.camera.id}
              className={
                hot
                  ? "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber"
                  : "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted"
              }
              style={{ left: `${50 + x}%`, top: `${50 + y}%` }}
            />
          );
        })}
        <Navigation2 className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-amber" aria-hidden />
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {live?.heading == null ? "還沒有方向，圓圈以北方朝上。" : "車頭朝上。圓圈就是警示距離。"}
      </p>
    </section>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        on
          ? "h-11 rounded-xl bg-amber px-3 text-sm font-bold text-amber-ink"
          : "h-11 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-fg"
      }
    >
      {label}
    </button>
  );
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-TW";
    utter.rate = 1.05;
    utter.onerror = () => {};
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    /* speech is optional */
  }
}

function playTone(ctx: AudioContext | null, stage: WarnStage) {
  if (!ctx) return;
  try {
    const notes = stage === "near" ? [880, 988, 1175] : stage === "mid" ? [740, 880] : [520, 660];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.16;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  } catch {
    /* audio is optional */
  }
}
