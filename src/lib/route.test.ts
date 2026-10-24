import assert from "node:assert/strict";
import { test } from "node:test";
import {
  camerasAlongRoute,
  googleNavigateUrl,
  pickPlace,
  progressAlongM,
  readRoute,
  simplifyLine,
} from "./route.ts";

const north = (meters: number) => ({ lat: 34 + meters / 111_320, lon: 134 });

test("a camera beside the line is kept and ordered, one far to the side is not", () => {
  const line = [north(0), north(2_000)];
  const near = { id: "near", lat: north(1_000).lat, lon: 134.001, status: "active" };
  const far = { id: "far", lat: north(500).lat, lon: 134.01, status: "active" };
  const later = { id: "later", lat: north(1_800).lat, lon: 134, status: "active" };
  const hits = camerasAlongRoute([far, later, near], line, 350, false);
  assert.deepEqual(
    hits.map((hit) => hit.camera.id),
    ["near", "later"],
  );
  assert.ok(hits[0].offM < 150);
  assert.ok(hits[0].alongM > 800 && hits[0].alongM < 1_200);
});

test("maybe-removed stays off the route list unless asked", () => {
  const line = [north(0), north(1_000)];
  const gone = { id: "gone", lat: north(400).lat, lon: 134, status: "maybe-removed" };
  assert.equal(camerasAlongRoute([gone], line, 350, false).length, 0);
  assert.equal(camerasAlongRoute([gone], line, 350, true).length, 1);
});

test("progress is the closest point along the line", () => {
  const line = [north(0), north(2_000)];
  const mid = progressAlongM(line, { lat: north(1_000).lat, lon: 134.002 });
  assert.ok(mid.alongM > 900 && mid.alongM < 1_100);
  assert.ok(mid.offM > 100 && mid.offM < 250);
});

test("simplify keeps the ends and drops a tiny middle step", () => {
  const line = [north(0), north(20), north(1_000)];
  const simple = simplifyLine(line, 100);
  assert.equal(simple.length, 2);
  assert.equal(simple[0].lat, line[0].lat);
  assert.equal(simple[1].lat, line[2].lat);
});

test("place picker stays inside Japan", () => {
  const place = pickPlace({
    features: [
      { geometry: { coordinates: [139.7, 35.7] }, properties: { name: "東京", countrycode: "JP", city: "千代田" } },
    ],
  });
  assert.equal(place?.name, "東京 · 千代田");
  assert.equal(
    pickPlace({
      features: [{ geometry: { coordinates: [2.3, 48.8] }, properties: { name: "Paris", countrycode: "FR" } }],
    }),
    null,
  );
});

test("route reader accepts an OSRM line", () => {
  const route = readRoute({
    code: "Ok",
    routes: [{ distance: 1500, duration: 120, geometry: { coordinates: [[134, 34], [134.01, 34.01]] } }],
  });
  assert.equal(route?.distanceM, 1500);
  assert.equal(route?.line[0].lon, 134);
  assert.equal(readRoute({ code: "NoRoute", routes: [] }), null);
});

test("google navigation url starts driving navigation", () => {
  const url = googleNavigateUrl({ lat: 34.34, lon: 134.05 }, { lat: 34.3, lon: 134 });
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  assert.match(url, /travelmode=driving/);
  assert.match(url, /dir_action=navigate/);
  assert.match(url, /origin=34\.3%2C134/);
  assert.match(url, /destination=34\.34%2C134\.05/);
});
