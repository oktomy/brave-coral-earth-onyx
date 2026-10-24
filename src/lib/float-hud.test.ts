import assert from "node:assert/strict";
import { test } from "node:test";
import { toFloatHud } from "./float-hud.ts";

test("alert hud uses distance and marks hot", () => {
  const hud = toFloatHud({
    speedKph: 90,
    tracking: true,
    stage: "far",
    distance: "734 公尺",
    eta: "約 29 秒",
    road: "高松自動車道 E11",
  });
  assert.equal(hud.hot, true);
  assert.equal(hud.headline, "前方測速");
  assert.equal(hud.detail, "734 公尺");
  assert.equal(hud.speed, "90");
  assert.match(hud.road, /高松自動車道/);
  assert.match(hud.road, /29 秒/);
});

test("idle hud stays quiet", () => {
  const hud = toFloatHud({
    speedKph: null,
    tracking: false,
    stage: null,
    distance: null,
    eta: null,
    road: null,
  });
  assert.equal(hud.hot, false);
  assert.equal(hud.detail, "尚未定位");
  assert.equal(hud.speed, "—");
});
