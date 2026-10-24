import type { WarnStage } from "@/lib/warn";

export type FloatHud = {
  speed: string;
  headline: string;
  detail: string;
  road: string;
  hot: boolean;
};

export function toFloatHud(input: {
  speedKph: number | null;
  tracking: boolean;
  stage: WarnStage | null;
  distance: string | null;
  eta: string | null;
  road: string | null;
}): FloatHud {
  const speed = input.speedKph == null ? "—" : String(Math.round(input.speedKph));
  if (input.stage && input.distance) {
    const headline = input.stage === "near" ? "即將通過" : input.stage === "mid" ? "接近中" : "前方測速";
    const road = [input.road, input.eta].filter(Boolean).join(" · ");
    return { speed, headline, detail: input.distance, road: road || "測速點", hot: true };
  }
  return {
    speed,
    headline: "前方淨空",
    detail: input.tracking ? "監控中" : "尚未定位",
    road: "可跟 Google 地圖同時用",
    hot: false,
  };
}

const INK = "#2a1d05";
const PAPER = "#f4f0e6";
const AMBER = "#e6a322";
const NIGHT = "#12151a";
const MUTED = "#a7b0bc";

export function paintFloatHud(canvas: HTMLCanvasElement, hud: FloatHud) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = hud.hot ? AMBER : NIGHT;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = hud.hot ? INK : AMBER;
  ctx.font = "600 40px 'Noto Sans TC', sans-serif";
  ctx.fillText(hud.headline, 48, 48);
  ctx.fillStyle = hud.hot ? INK : PAPER;
  ctx.font = "700 132px 'Noto Sans TC', sans-serif";
  ctx.fillText(clip(ctx, hud.detail, width - 96), 48, 120);
  ctx.fillStyle = hud.hot ? INK : MUTED;
  ctx.font = "500 36px 'Noto Sans TC', sans-serif";
  ctx.fillText(clip(ctx, hud.road, width - 280), 48, height - 100);
  ctx.textAlign = "right";
  ctx.fillStyle = hud.hot ? INK : AMBER;
  ctx.font = "700 72px 'Noto Sans TC', sans-serif";
  ctx.fillText(hud.speed, width - 48, 48);
  ctx.font = "500 28px 'Noto Sans TC', sans-serif";
  ctx.fillText("km/h", width - 48, 130);
  ctx.textAlign = "left";
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > max) next = next.slice(0, -1);
  return `${next}…`;
}

export function paintPipDocument(pip: Window, hud: FloatHud) {
  const doc = pip.document;
  const body = doc.body;
  if (!body) return;
  let root = doc.getElementById("warn-float");
  if (!root) {
    body.style.margin = "0";
    body.style.fontFamily = "'Noto Sans TC', 'PingFang TC', sans-serif";
    root = doc.createElement("div");
    root.id = "warn-float";
    root.style.cssText = "box-sizing:border-box;min-height:100vh;padding:16px 18px;position:relative";
    const headline = doc.createElement("div");
    headline.id = "warn-float-h";
    headline.style.cssText = "font-size:18px;font-weight:700";
    const detail = doc.createElement("div");
    detail.id = "warn-float-d";
    detail.style.cssText = "margin-top:6px;font-size:48px;font-weight:700;line-height:1";
    const road = doc.createElement("div");
    road.id = "warn-float-r";
    road.style.cssText = "margin-top:8px;font-size:16px";
    const speed = doc.createElement("div");
    speed.id = "warn-float-s";
    speed.style.cssText = "position:absolute;top:16px;right:18px;font-size:28px;font-weight:700;text-align:right";
    root.append(headline, detail, road, speed);
    body.append(root);
  }
  body.style.background = hud.hot ? AMBER : NIGHT;
  body.style.color = hud.hot ? INK : PAPER;
  const headline = doc.getElementById("warn-float-h");
  const detail = doc.getElementById("warn-float-d");
  const road = doc.getElementById("warn-float-r");
  const speed = doc.getElementById("warn-float-s");
  if (headline) headline.textContent = hud.headline;
  if (detail) detail.textContent = hud.detail;
  if (road) road.textContent = hud.road;
  if (speed) speed.textContent = `${hud.speed} km/h`;
}
