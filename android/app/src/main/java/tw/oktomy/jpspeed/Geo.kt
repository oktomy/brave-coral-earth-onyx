package tw.oktomy.jpspeed

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

const val AHEAD_CONE = 55.0

fun haversineM(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val radius = 6_371_000.0
    val p1 = Math.toRadians(lat1)
    val p2 = Math.toRadians(lat2)
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val h = sin(dLat / 2) * sin(dLat / 2) + cos(p1) * cos(p2) * sin(dLon / 2) * sin(dLon / 2)
    return 2 * radius * asin(min(1.0, sqrt(h)))
}

fun initialBearing(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val p1 = Math.toRadians(lat1)
    val p2 = Math.toRadians(lat2)
    val dLon = Math.toRadians(lon2 - lon1)
    val y = sin(dLon) * cos(p2)
    val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dLon)
    return (Math.toDegrees(atan2(y, x)) + 360.0) % 360.0
}

fun angleDelta(headingDeg: Double, bearingDeg: Double): Double {
    return ((bearingDeg - headingDeg + 540.0) % 360.0) - 180.0
}

fun offsetMeters(lat: Double, lon: Double, bearingDeg: Double, dist: Double): Pair<Double, Double> {
    val r = Math.toRadians(bearingDeg)
    val lat2 = lat + (dist * cos(r)) / 111_320.0
    val lon2 = lon + (dist * sin(r)) / (111_320.0 * cos(Math.toRadians(lat)).coerceAtLeast(0.2))
    return lat2 to lon2
}

data class Approach(
    val camera: Camera,
    val distanceM: Double,
    val bearingDeg: Double,
    val deltaDeg: Double?,
    val ahead: Boolean,
    val etaSec: Double?,
)

data class Eval(val primary: Approach?, val nearest: Approach?, val around: List<Approach>)

fun stageFor(distanceM: Double, radiusM: Double): String? {
    if (distanceM > radiusM) return null
    if (distanceM <= 160.0) return "near"
    if (distanceM <= max(280.0, radiusM * 0.45)) return "mid"
    return "far"
}

fun evaluate(
    cameras: List<Camera>,
    lat: Double,
    lon: Double,
    heading: Double?,
    speedKph: Double?,
    radiusM: Double,
    aheadOnly: Boolean,
): Eval {
    var best: Approach? = null
    var nearest: Approach? = null
    val around = ArrayList<Approach>()
    for (camera in cameras) {
        if (camera.status == "maybe-removed") continue
        val meters = haversineM(lat, lon, camera.lat, camera.lon)
        val bearing = initialBearing(lat, lon, camera.lat, camera.lon)
        val delta = if (heading == null) null else angleDelta(heading, bearing)
        val ahead = delta == null || kotlin.math.abs(delta) <= AHEAD_CONE
        val eta = if (ahead && speedKph != null && speedKph >= 8.0) meters / (speedKph / 3.6) else null
        val item = Approach(camera, meters, bearing, delta, ahead, eta)
        if (nearest == null || meters < nearest.distanceM) nearest = item
        if (meters <= max(radiusM, 1500.0)) around.add(item)
        val ok = meters <= radiusM && (!aheadOnly || heading == null || ahead)
        if (ok && (best == null || meters < best.distanceM)) best = item
    }
    around.sortBy { it.distanceM }
    return Eval(best, nearest, around.take(5))
}

fun formatDistance(meters: Double): String {
    if (meters < 1000) return "${meters.roundToInt()} 公尺"
    val km = meters / 1000.0
    return if (km < 10) String.format("%.1f 公里", km) else "${km.roundToInt()} 公里"
}

fun formatTrip(seconds: Double): String {
    val minutes = max(1, (seconds / 60.0).roundToInt())
    if (minutes < 60) return "約 $minutes 分鐘"
    val hours = minutes / 60
    val rest = minutes % 60
    return if (rest == 0) "約 $hours 小時" else "約 $hours 小時 $rest 分"
}

fun voiceLine(stage: String, distanceM: Double, limit: Int?): String {
    val rounded = max(50, ((distanceM / 50.0).roundToInt()) * 50)
    val limitPart = if (limit != null) "，公布限速$limit" else ""
    return if (stage == "near") "即將通過測速點$limitPart" else "前方測速，大約${rounded}公尺$limitPart"
}
