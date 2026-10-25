package tw.oktomy.jpspeed

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.sin

data class Snap(
    val active: Boolean = false,
    val demo: Boolean = false,
    val speedKph: Double? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    val headline: String = "還沒開始",
    val detail: String = "尚未定位",
    val road: String = "",
    val hot: Boolean = false,
    val note: String = "尚未開始。資料在這支 App 裡。",
)

class WarnService : Service() {
    inner class LocalBinder : Binder() {
        val service: WarnService get() = this@WarnService
    }

    private val binder = LocalBinder()
    private val main = Handler(Looper.getMainLooper())
    private val audio = Executors.newSingleThreadExecutor()
    private val audioBusy = AtomicBoolean(false)
    private val listeners = LinkedHashSet<(Snap) -> Unit>()
    private val overlay by lazy { OverlayHud(this) }
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var wake: PowerManager.WakeLock? = null
    private var gps: LocationManager? = null
    private var gpsOn = false
    private var foreground = false
    private var demo = false
    private var demoTask: Runnable? = null
    private var radiusM = 800.0
    private var aheadOnly = true
    private var lastLat: Double? = null
    private var lastLon: Double? = null
    private var lastKey = ""
    private var lastSnap = Snap()
    private var lastNotice = ""

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            if (!demo) onGps(location)
        }

        override fun onProviderEnabled(provider: String) {}

        override fun onProviderDisabled(provider: String) {}

        @Deprecated("Legacy location callback")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    override fun onCreate() {
        super.onCreate()
        Cameras.load(applicationContext)
        val channelId = "warn"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "測速警示", NotificationManager.IMPORTANCE_LOW)
            channel.setSound(null, null)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        tts = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.TAIWAN
                tts?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                ttsReady = true
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureForeground("測速警示", "準備中")
        if (intent?.getBooleanExtra("demo", false) == true) beginDemo() else beginGps()
        return START_STICKY
    }

    fun snapshot(): Snap = lastSnap

    fun listen(listener: (Snap) -> Unit) {
        listeners.add(listener)
        listener(lastSnap)
    }

    fun unlisten(listener: (Snap) -> Unit) {
        listeners.remove(listener)
    }

    fun applyOptions(radius: Double, ahead: Boolean) {
        radiusM = radius
        aheadOnly = ahead
    }

    fun showOverlay() {
        overlay.show()
        overlay.update(lastSnap.headline, lastSnap.detail, speedRoad(lastSnap), lastSnap.hot)
    }

    fun hideOverlay() {
        overlay.hide()
    }

    fun shutdown() {
        stopDemoTicks()
        demo = false
        stopGps()
        overlay.hide()
        if (wake?.isHeld == true) wake?.release()
        foreground = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        publish(
            Snap(note = "已停止警示。"),
        )
        stopSelf()
    }

    private fun beginGps() {
        stopDemoTicks()
        demo = false
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            publish(lastSnap.copy(active = true, note = "沒有定位權限。請允許定位後再按一次。"))
            return
        }
        val manager = getSystemService(LocationManager::class.java)
        gps = manager
        if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            publish(lastSnap.copy(active = true, note = "請先開啟手機的定位。"))
            return
        }
        holdWake()
        try {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 3f, listener, Looper.getMainLooper())
            gpsOn = true
            publish(lastSnap.copy(active = true, demo = false, note = "定位中。人在日本、開著這個警示才會在路上響。"))
        } catch (_: SecurityException) {
            publish(lastSnap.copy(active = true, note = "定位被拒絕。"))
        }
    }

    private fun beginDemo() {
        stopGps()
        val camera = Cameras.byId("fixed-kitoku") ?: Cameras.all.firstOrNull()
        if (camera == null) {
            publish(Snap(active = true, note = "沒有測速資料。"))
            return
        }
        holdWake()
        val start = offsetMeters(camera.lat, camera.lon, 180.0, 760.0)
        var lat = start.first
        var lon = start.second
        var nearest = 760.0
        demo = true
        val task = object : Runnable {
            override fun run() {
                if (!demo) return
                onFix(lat, lon, 90.0, 0.0, true)
                val step = (90.0 / 3.6) * 0.5
                val next = offsetMeters(lat, lon, 0.0, step)
                lat = next.first
                lon = next.second
                val away = haversineM(lat, lon, camera.lat, camera.lon)
                if (away < nearest) nearest = away
                if (nearest < 180 && away > nearest + 45) {
                    demo = false
                    publish(lastSnap.copy(demo = false, active = true, note = "試跑已通過該測速點。不是你的定位。"))
                    return
                }
                main.postDelayed(this, 500)
            }
        }
        demoTask = task
        publish(Snap(active = true, demo = true, note = "試跑中：${camera.road.ifBlank { camera.name }}。由南往北，時速 90。不是你的定位。"))
        main.post(task)
    }

    private fun onGps(location: Location) {
        val speed = if (location.hasSpeed()) location.speed * 3.6 else null
        var heading = if (location.hasBearing()) location.bearing.toDouble() else null
        val prevLat = lastLat
        val prevLon = lastLon
        if (heading == null && speed != null && speed >= 8 && prevLat != null && prevLon != null) {
            heading = initialBearing(prevLat, prevLon, location.latitude, location.longitude)
        }
        onFix(location.latitude, location.longitude, speed, heading, false)
    }

    private fun onFix(lat: Double, lon: Double, speedKph: Double?, heading: Double?, fromDemo: Boolean) {
        lastLat = lat
        lastLon = lon
        val result = evaluate(Cameras.all, lat, lon, heading, speedKph, radiusM, aheadOnly)
        val primary = result.primary
        val stage = if (primary != null) stageFor(primary.distanceM, radiusM) else null
        val far = result.nearest != null && result.nearest.distanceM > 80_000
        val snap = if (primary != null && stage != null) {
            val label = when (stage) {
                "near" -> "即將通過"
                "mid" -> "接近中"
                else -> "前方測速"
            }
            val bits = listOf(
                primary.camera.road.ifBlank { primary.camera.name },
                primary.camera.placeLabel(),
                primary.camera.kindLabel(),
                primary.camera.limitKph?.let { "公布限速 $it" } ?: "",
            ).filter { it.isNotBlank() }
            announce(primary.camera.id + stage, stage, primary.distanceM, primary.camera.limitKph)
            Snap(
                active = true,
                demo = fromDemo || demo,
                speedKph = speedKph,
                lat = lat,
                lon = lon,
                headline = label,
                detail = formatDistance(primary.distanceM),
                road = bits.joinToString(" · "),
                hot = true,
                note = if (fromDemo || demo) lastSnap.note else "定位中。人在日本、開著這個警示才會在路上響。",
            )
        } else {
            lastKey = ""
            val nearest = result.nearest
            Snap(
                active = true,
                demo = fromDemo || demo,
                speedKph = speedKph,
                lat = lat,
                lon = lon,
                headline = if (nearest == null) "還沒開始" else if (far) "離測速點還很遠" else "前方淨空",
                detail = if (far && nearest != null) "最近 ${formatDistance(nearest.distanceM)}" else "監控中",
                road = nearest?.let { it.camera.placeLabel() + " · " + it.camera.road.ifBlank { it.camera.name } } ?: "",
                hot = false,
                note = if (fromDemo || demo) lastSnap.note else "定位中。人在日本、開著這個警示才會在路上響。",
            )
        }
        publish(snap)
    }

    private fun announce(key: String, stage: String, distanceM: Double, limit: Int?) {
        if (key == lastKey) return
        lastKey = key
        beep(stage)
        if (ttsReady) {
            tts?.speak(voiceLine(stage, distanceM, limit), TextToSpeech.QUEUE_FLUSH, null, key)
        }
    }

    private fun beep(stage: String) {
        if (!audioBusy.compareAndSet(false, true)) return
        val notes = when (stage) {
            "near" -> doubleArrayOf(880.0, 988.0, 1175.0)
            "mid" -> doubleArrayOf(740.0, 880.0)
            else -> doubleArrayOf(520.0, 660.0)
        }
        audio.execute {
            try {
                playNotes(notes)
            } catch (_: Exception) {
            } finally {
                audioBusy.set(false)
            }
        }
    }

    private fun playNotes(notes: DoubleArray) {
        val sampleRate = 22050
        val toneFrames = (sampleRate * 0.14).toInt()
        val gapFrames = (sampleRate * 0.04).toInt()
        val each = toneFrames + gapFrames
        val buf = ShortArray(each * notes.size)
        notes.forEachIndexed { index, freq ->
            val base = index * each
            for (i in 0 until toneFrames) {
                val env = if (i < toneFrames * 0.12) i / (toneFrames * 0.12) else (1.0 - (i - toneFrames * 0.12) / (toneFrames * 0.88)).coerceAtLeast(0.0)
                val sample = sin(2 * PI * freq * i / sampleRate) * env * 0.4
                buf[base + i] = (sample * 32767).toInt().toShort()
            }
        }
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(buf.size * 2)
            .build()
        track.write(buf, 0, buf.size)
        track.play()
        SystemClock.sleep((notes.size * 180).toLong())
        track.release()
    }

    private fun publish(snap: Snap) {
        lastSnap = snap
        val notice = snap.headline + snap.detail
        if (foreground && notice != lastNotice) {
            lastNotice = notice
            getSystemService(NotificationManager::class.java).notify(1, notification(snap.headline, snap.detail))
        }
        if (overlay.allowed()) overlay.update(snap.headline, snap.detail, speedRoad(snap), snap.hot)
        for (listener in listeners.toList()) listener(snap)
    }

    private fun speedRoad(snap: Snap): String {
        val speed = snap.speedKph?.let { "${it.toInt()} km/h" } ?: "— km/h"
        return if (snap.road.isBlank()) speed else "$speed · ${snap.road}"
    }

    private fun ensureForeground(title: String, text: String) {
        if (foreground) return
        val built = notification(title, text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, built, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(1, built)
        }
        foreground = true
    }

    private fun notification(title: String, text: String) = NotificationCompat.Builder(this, "warn")
        .setSmallIcon(R.drawable.ic_stat)
        .setContentTitle(title)
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .build()

    private fun holdWake() {
        if (wake?.isHeld == true) return
        val lock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jpspeed:warn")
        lock.setReferenceCounted(false)
        lock.acquire(6 * 60 * 60 * 1000L)
        wake = lock
    }

    private fun stopGps() {
        if (!gpsOn) return
        gps?.removeUpdates(listener)
        gpsOn = false
    }

    private fun stopDemoTicks() {
        demoTask?.let { main.removeCallbacks(it) }
        demoTask = null
        demo = false
    }

    override fun onDestroy() {
        stopDemoTicks()
        stopGps()
        overlay.hide()
        tts?.shutdown()
        audio.shutdownNow()
        if (wake?.isHeld == true) wake?.release()
        super.onDestroy()
    }
}
