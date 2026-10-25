package tw.oktomy.jpspeed

import org.json.JSONObject
import java.net.URLEncoder
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sqrt

const val CORRIDOR_M = 350.0

data class LatLon(val lat: Double, val lon: Double)
data class Place(val name: String, val lat: Double, val lon: Double)
data class DrivingRoute(val distanceM: Double, val durationS: Double, val line: List<LatLon>)
data class RouteHit(val camera: Camera, val alongM: Double, val offM: Double)
data class Along(val alongM: Double, val offM: Double)

fun inJapan(lat: Double, lon: Double): Boolean {
    return lat in 24.0..46.0 && lon in 122.0..154.0
}

fun photonUrl(query: String): String {
    val q = URLEncoder.encode(query, "UTF-8")
    return "https://photon.komoot.io/api/?q=$q&limit=5&lang=ja"
}

fun osrmUrl(fromLat: Double, fromLon: Double, toLat: Double, toLon: Double): String {
    return "https://router.project-osrm.org/route/v1/driving/$fromLon,$fromLat;$toLon,$toLat?overview=full&geometries=geojson"
}

fun pickPlace(json: String): Place? {
    val features = JSONObject(json).optJSONArray("features") ?: return null
    for (i in 0 until features.length()) {
        val feature = features.optJSONObject(i) ?: continue
        val coords = feature.optJSONObject("geometry")?.optJSONArray("coordinates") ?: continue
        if (coords.length() < 2) continue
        val lon = coords.optDouble(0, Double.NaN)
        val lat = coords.optDouble(1, Double.NaN)
        if (lat.isNaN() || lon.isNaN()) continue
        val props = feature.optJSONObject("properties") ?: JSONObject()
        val code = props.optString("countrycode").uppercase()
        if (code != "JP" && !inJapan(lat, lon)) continue
        val name = listOf(props.optString("name"), props.optString("city"), props.optString("state"))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(3)
            .joinToString(" · ")
            .ifBlank { "目的地" }
        return Place(name, lat, lon)
    }
    return null
}

fun readRoute(json: String): DrivingRoute? {
    val root = JSONObject(json)
    if (root.optString("code") != "Ok") return null
    val route = root.optJSONArray("routes")?.optJSONObject(0) ?: return null
    val coords = route.optJSONObject("geometry")?.optJSONArray("coordinates") ?: return null
    val line = ArrayList<LatLon>(coords.length())
    for (i in 0 until coords.length()) {
        val pair = coords.optJSONArray(i) ?: continue
        if (pair.length() < 2) continue
        val lon = pair.optDouble(0, Double.NaN)
        val lat = pair.optDouble(1, Double.NaN)
        if (!lat.isNaN() && !lon.isNaN()) line.add(LatLon(lat, lon))
    }
    val distance = route.optDouble("distance", Double.NaN)
    val duration = route.optDouble("duration", Double.NaN)
    if (line.size < 2 || distance.isNaN() || duration.isNaN()) return null
    return DrivingRoute(distance, duration, line)
}

fun simplifyLine(line: List<LatLon>, minStepM: Double): List<LatLon> {
    if (line.size <= 2) return line
    val out = ArrayList<LatLon>()
    out.add(line.first())
    var prev = line.first()
    for (i in 1 until line.size - 1) {
        if (haversineM(prev.lat, prev.lon, line[i].lat, line[i].lon) >= minStepM) {
            out.add(line[i])
            prev = line[i]
        }
    }
    out.add(line.last())
    return out
}

private data class Seg(
    val x: Double,
    val y: Double,
    val abx: Double,
    val aby: Double,
    val ab2: Double,
    val len: Double,
    val start: Double,
)

private fun toXY(lat: Double, lon: Double, lat0: Double, lon0: Double): Pair<Double, Double> {
    val mLon = 111_320.0 * cos(Math.toRadians(lat0)).coerceAtLeast(0.2)
    return (lon - lon0) * mLon to (lat - lat0) * 111_320.0
}

private fun segments(line: List<LatLon>): List<Seg> {
    val lat0 = line.first().lat
    val lon0 = line.first().lon
    val segs = ArrayList<Seg>(line.size)
    var start = 0.0
    var prev = toXY(line.first().lat, line.first().lon, lat0, lon0)
    for (i in 1 until line.size) {
        val next = toXY(line[i].lat, line[i].lon, lat0, lon0)
        val abx = next.first - prev.first
        val aby = next.second - prev.second
        val ab2 = abx * abx + aby * aby
        val len = sqrt(ab2)
        segs.add(Seg(prev.first, prev.second, abx, aby, ab2, len, start))
        start += len
        prev = next
    }
    return segs
}

private fun project(lat: Double, lon: Double, line: List<LatLon>, segs: List<Seg>): Along {
    val lat0 = line.first().lat
    val lon0 = line.first().lon
    val p = toXY(lat, lon, lat0, lon0)
    var bestOff = Double.POSITIVE_INFINITY
    var bestAlong = 0.0
    for (seg in segs) {
        var t = 0.0
        if (seg.ab2 > 0) {
            t = ((p.first - seg.x) * seg.abx + (p.second - seg.y) * seg.aby) / seg.ab2
            if (t < 0) t = 0.0 else if (t > 1) t = 1.0
        }
        val cx = seg.x + seg.abx * t
        val cy = seg.y + seg.aby * t
        val off = hypot(p.first - cx, p.second - cy)
        if (off < bestOff) {
            bestOff = off
            bestAlong = seg.start + seg.len * t
        }
    }
    return Along(bestAlong, bestOff)
}

fun progressAlong(line: List<LatLon>, lat: Double, lon: Double): Along {
    if (line.isEmpty()) return Along(0.0, Double.POSITIVE_INFINITY)
    if (line.size == 1) return Along(0.0, haversineM(lat, lon, line[0].lat, line[0].lon))
    return project(lat, lon, line, segments(line))
}

fun camerasAlongRoute(cameras: List<Camera>, line: List<LatLon>, corridorM: Double): List<RouteHit> {
    if (line.size < 2) return emptyList()
    var minLat = line[0].lat
    var maxLat = line[0].lat
    var minLon = line[0].lon
    var maxLon = line[0].lon
    for (point in line) {
        if (point.lat < minLat) minLat = point.lat
        if (point.lat > maxLat) maxLat = point.lat
        if (point.lon < minLon) minLon = point.lon
        if (point.lon > maxLon) maxLon = point.lon
    }
    val padLat = (corridorM + 80.0) / 111_320.0
    val padLon = padLat / cos(Math.toRadians(line[0].lat)).coerceAtLeast(0.2)
    val segs = segments(line)
    val hits = ArrayList<RouteHit>()
    for (camera in cameras) {
        if (camera.status == "maybe-removed") continue
        if (camera.lat < minLat - padLat || camera.lat > maxLat + padLat || camera.lon < minLon - padLon || camera.lon > maxLon + padLon) {
            continue
        }
        val hit = project(camera.lat, camera.lon, line, segs)
        if (hit.offM <= corridorM) hits.add(RouteHit(camera, hit.alongM, hit.offM))
    }
    hits.sortBy { it.alongM }
    return hits
}
