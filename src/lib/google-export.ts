import {
  ACCURACY_LABEL,
  KIND_LABEL,
  PREFECTURE_LABEL,
  type Camera,
} from "@/data/cameras";

function xml(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .replaceAll(amp, `${amp}amp;`)
    .replaceAll("<", `${amp}lt;`)
    .replaceAll(">", `${amp}gt;`)
    .replaceAll('"', `${amp}quot;`);
}

export function cameraDescription(camera: Camera): string {
  const limit = camera.limitKph ? `路段標示約 ${camera.limitKph} km/h` : "路段速限未標示";
  const removed = camera.status === "maybe-removed" ? "可能已撤除。" : "";
  return [
    `${PREFECTURE_LABEL[camera.prefecture]} ${camera.city}`,
    `${camera.road}／${camera.direction}`,
    `${KIND_LABEL[camera.kind]}・${camera.system}`,
    limit,
    `精度：${ACCURACY_LABEL[camera.accuracy]}`,
    removed,
    camera.note,
    `來源：${camera.source}（${camera.updated}）`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function toKml(cameras: Camera[]): string {
  const marks = cameras
    .map(
      (camera) => `    <Placemark>
      <name>${xml(camera.name)}</name>
      <description><![CDATA[${cameraDescription(camera)}]]></description>
      <Point><coordinates>${camera.lon},${camera.lat},0</coordinates></Point>
    </Placemark>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>日本測速點</name>
    <description>日本全國測速照相公開位置整理。非警察官方清單。</description>
${marks}
  </Document>
</kml>
`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(cameras: Camera[]): string {
  const header = ["Name", "Description", "Latitude", "Longitude"];
  const lines = cameras.map((camera) =>
    [
      camera.name,
      cameraDescription(camera).replaceAll("\n", " / "),
      camera.lat.toFixed(6),
      camera.lon.toFixed(6),
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}\n`;
}

export function googleMapsUrl(camera: Camera): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${camera.lat},${camera.lon}`)}`;
}

export function mobileShareFile(filename: string, content: string, mime: string): File | null {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return null;
  if (typeof navigator.canShare !== "function") return null;
  const ua = navigator.userAgent;
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
  if (!mobile) return null;
  for (const type of [mime, "application/octet-stream", "text/plain"]) {
    const file = new File([content], filename, { type });
    if (navigator.canShare({ files: [file] })) return file;
  }
  return null;
}
