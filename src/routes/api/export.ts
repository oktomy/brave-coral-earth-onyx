import { createFileRoute } from "@tanstack/react-router";
import { CAMERAS, type Camera } from "@/data/cameras";
import { toCsv, toKml } from "@/lib/google-export";

function selectedCameras(url: URL): Camera[] {
  const raw = url.searchParams.get("ids");
  if (!raw) return CAMERAS;
  const wanted = new Set(raw.split(",").filter(Boolean));
  const list = CAMERAS.filter((camera) => wanted.has(camera.id));
  return list.length > 0 ? list : CAMERAS;
}

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const csv = url.searchParams.get("format") === "csv";
        const cameras = selectedCameras(url);
        const filename = csv ? "japan-speed-cameras.csv" : "japan-speed-cameras.kml";
        const body = csv ? toCsv(cameras) : toKml(cameras);
        const type = csv
          ? "text/csv; charset=utf-8"
          : "application/vnd.google-earth.kml+xml; charset=utf-8";
        return new Response(body, {
          headers: {
            "content-type": type,
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
