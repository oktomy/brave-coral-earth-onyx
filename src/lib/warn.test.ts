import assert from "node:assert/strict";
import { test } from "node:test";
import {
  angleDelta,
  approachStart,
  evaluate,
  haversineM,
  initialBearing,
  isAhead,
  stageFor,
  voiceText,
  type WarnCamera,
} from "./warn.ts";

function cam(id: string, lat: number, lon: number, patch: Partial<WarnCamera> = {}): WarnCamera {
  return {
    id,
    name: id,
    prefecture: "kagawa",
    city: "高松市",
    road: "測試路",
    direction: "",
    kind: "fixed",
    limitKph: 60,
    lat,
    lon,
    accuracy: "survey",
    status: "active",
    note: "",
    ...patch,
  };
}

test("a degree of latitude is about 111 km", () => {
  const meters = haversineM(35, 139, 36, 139);
  assert.ok(meters > 110_000 && meters < 112_000);
});

test("bearing north and the ahead cone", () => {
  const bearing = (initialBearing(35, 139, 35.01, 139) + 360) % 360;
  assert.ok(bearing < 1 || bearing > 359);
  assert.equal(angleDelta(0, 10), 10);
  assert.ok(Math.abs(angleDelta(0, 350) + 10) < 0.001);
  assert.equal(isAhead(50), true);
  assert.equal(isAhead(120), false);
});

test("approach starts south of the camera and closes distance", () => {
  const camera = { lat: 34.2465612, lon: 133.7947217 };
  const start = approachStart(camera, 760);
  const dist = haversineM(start.lat, start.lon, camera.lat, camera.lon);
  assert.ok(Math.abs(dist - 760) < 20);
  assert.ok(start.lat < camera.lat);
  const bearing = (initialBearing(start.lat, start.lon, camera.lat, camera.lon) + 360) % 360;
  assert.ok(bearing < 5 || bearing > 355);
});

test("ahead camera wins over a closer camera behind", () => {
  const ahead = cam("ahead", 35.005, 139);
  const behind = cam("behind", 34.998, 139);
  const result = evaluate([ahead, behind], { lat: 35, lon: 139, heading: 0 }, {
    radiusM: 800,
    aheadOnly: true,
    includeRemoved: false,
    speedKph: 60,
  });
  assert.equal(result.primary?.camera.id, "ahead");
  assert.ok((result.primary?.distanceM ?? 0) > (result.around.find((item) => item.camera.id === "behind")?.distanceM ?? 0));
  assert.ok((result.primary?.etaSec ?? 0) > 20 && (result.primary?.etaSec ?? 0) < 40);
});

test("stages and voice do not call the posted limit a trigger", () => {
  assert.equal(stageFor(900, 800), null);
  assert.equal(stageFor(700, 800), "far");
  assert.equal(stageFor(300, 800), "mid");
  assert.equal(stageFor(100, 800), "near");
  const spoken = voiceText(
    {
      camera: cam("x", 0, 0),
      distanceM: 640,
      bearingDeg: 0,
      deltaDeg: 0,
      ahead: true,
      etaSec: 30,
    },
    "far",
  );
  assert.match(spoken, /前方測速/);
  assert.match(spoken, /公布限速60/);
  assert.doesNotMatch(spoken, /門檻/);
});
