package tw.oktomy.jpspeed

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.max

class MainActivity : AppCompatActivity() {
    private var warn: WarnService? = null
    private var bound = false
    private val io = Executors.newSingleThreadExecutor()
    private var destination: Place? = null
    private var planned: DrivingRoute? = null
    private var hits: List<RouteHit> = emptyList()
    private var radius = 800.0
    private var aheadOnly = true
    private var wantOverlay = false
    private var planning = false

    private val onSnap: (Snap) -> Unit = { snap -> runOnUiThread { showSnap(snap) } }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            warn = (binder as WarnService.LocalBinder).service
            bound = true
            warn?.applyOptions(radius, aheadOnly)
            warn?.listen(onSnap)
            if (wantOverlay && canOverlay()) {
                wantOverlay = false
                warn?.showOverlay()
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            warn = null
            bound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Cameras.load(applicationContext)
        setContentView(R.layout.activity_main)
        listOf(R.id.start, R.id.demo, R.id.overlay, R.id.plan, R.id.maps, R.id.r400, R.id.r800, R.id.r1200, R.id.ahead)
            .map { findViewById<Button>(it) }
            .forEach {
                it.backgroundTintList = null
                it.stateListAnimator = null
            }
        findViewById<Button>(R.id.start).setOnClickListener {
            if (warn?.snapshot()?.active == true && warn?.snapshot()?.demo != true) {
                warn?.shutdown()
                findViewById<Button>(R.id.start).text = "開始警示"
            } else {
                if (!ensurePermission()) return@setOnClickListener
                startForegroundService(Intent(this, WarnService::class.java).putExtra("demo", false))
            }
        }
        findViewById<Button>(R.id.demo).setOnClickListener {
            if (warn?.snapshot()?.demo == true) {
                warn?.shutdown()
            } else {
                if (!ensurePermission()) return@setOnClickListener
                startForegroundService(Intent(this, WarnService::class.java).putExtra("demo", true))
            }
        }
        findViewById<Button>(R.id.overlay).setOnClickListener { askOverlay() }
        findViewById<Button>(R.id.plan).setOnClickListener { planRoute() }
        findViewById<Button>(R.id.maps).setOnClickListener { openMaps() }
        findViewById<Button>(R.id.r400).setOnClickListener { setRadius(400.0) }
        findViewById<Button>(R.id.r800).setOnClickListener { setRadius(800.0) }
        findViewById<Button>(R.id.r1200).setOnClickListener { setRadius(1200.0) }
        findViewById<Button>(R.id.ahead).setOnClickListener {
            aheadOnly = !aheadOnly
            val button = findViewById<Button>(R.id.ahead)
            button.text = if (aheadOnly) "只報前方" else "四周都報"
            paintButton(button, aheadOnly)
            warn?.applyOptions(radius, aheadOnly)
        }
        paintButton(findViewById(R.id.r800), true)
        paintButton(findViewById(R.id.ahead), true)
    }

    override fun onStart() {
        super.onStart()
        if (!bound) bindService(Intent(this, WarnService::class.java), connection, BIND_AUTO_CREATE)
    }

    override fun onResume() {
        super.onResume()
        if (wantOverlay && canOverlay()) {
            if (warn != null) {
                wantOverlay = false
                warn?.showOverlay()
            } else if (ensurePermission()) {
                startForegroundService(Intent(this, WarnService::class.java))
            }
        }
    }

    override fun onStop() {
        warn?.unlisten(onSnap)
        if (bound) {
            unbindService(connection)
            bound = false
            warn = null
        }
        super.onStop()
    }

    override fun onDestroy() {
        io.shutdownNow()
        super.onDestroy()
    }

    private fun ensurePermission(): Boolean {
        val need = ArrayList<String>()
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.ACCESS_FINE_LOCATION)
            need.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (need.isEmpty()) return true
        requestPermissions(need.toTypedArray(), 10)
        findViewById<TextView>(R.id.status).text = "請允許定位和通知，才能在開車時繼續響。"
        return false
    }

    private fun askOverlay() {
        if (!canOverlay()) {
            wantOverlay = true
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            findViewById<TextView>(R.id.plan_note).text = "請允許「顯示在其他應用程式上層」，回到這裡會打開浮動警示。"
            return
        }
        if (!ensurePermission()) {
            wantOverlay = true
            return
        }
        wantOverlay = true
        startForegroundService(Intent(this, WarnService::class.java))
        warn?.showOverlay()
    }

    private fun canOverlay(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
    }

    private fun setRadius(value: Double) {
        radius = value
        paintButton(findViewById(R.id.r400), value == 400.0)
        paintButton(findViewById(R.id.r800), value == 800.0)
        paintButton(findViewById(R.id.r1200), value == 1200.0)
        warn?.applyOptions(radius, aheadOnly)
    }

    private fun planRoute() {
        if (planning) return
        val query = findViewById<EditText>(R.id.dest).text.toString().trim()
        val note = findViewById<TextView>(R.id.plan_note)
        if (query.isEmpty()) {
            note.text = "先輸入目的地。"
            return
        }
        val snap = warn?.snapshot()
        val lat = snap?.lat
        val lon = snap?.lon
        if (lat == null || lon == null) {
            note.text = "先按開始警示或試跑，才能從目前位置算出沿途測速。沒有位置時，仍可用目的地文字打開 Google 地圖。"
            return
        }
        planning = true
        findViewById<Button>(R.id.plan).isEnabled = false
        note.text = "正在找目的地…"
        io.execute {
            try {
                val place = pickPlace(httpGet(photonUrl(query)))
                if (place == null) {
                    ui {
                        note.text = "找不到日本的這個地點。加上市町村再試，例如「香川 金刀比羅宮」。"
                        finishPlan()
                    }
                    return@execute
                }
                ui { note.text = "正在計算路線…" }
                val route = readRoute(httpGet(osrmUrl(lat, lon, place.lat, place.lon)))
                if (route == null) {
                    ui {
                        destination = place
                        note.text = "這段開車路線沒有算出來。仍可按「用 Google 地圖導航」。"
                        finishPlan()
                    }
                    return@execute
                }
                val line = simplifyLine(route.line, 150.0)
                val found = camerasAlongRoute(Cameras.all, line, CORRIDOR_M)
                ui {
                    destination = place
                    planned = route.copy(line = line)
                    hits = found
                    note.text = ""
                    renderRoute(warn?.snapshot())
                    finishPlan()
                }
            } catch (_: Exception) {
                ui {
                    note.text = "路線服務沒有回應。警示仍會依你的前方繼續響。"
                    finishPlan()
                }
            }
        }
    }

    private fun finishPlan() {
        planning = false
        findViewById<Button>(R.id.plan).isEnabled = true
    }

    private fun openMaps() {
        val place = destination
        val query = findViewById<EditText>(R.id.dest).text.toString().trim()
        if (place == null && query.isEmpty()) {
            findViewById<TextView>(R.id.plan_note).text = "先輸入目的地。"
            return
        }
        val navUri = if (place != null) {
            Uri.parse("google.navigation:q=${place.lat},${place.lon}&mode=d")
        } else {
            Uri.parse("google.navigation:q=${Uri.encode(query)}&mode=d")
        }
        val nav = Intent(Intent.ACTION_VIEW, navUri).setPackage("com.google.android.apps.maps")
        try {
            startActivity(nav)
        } catch (_: Exception) {
            val web = if (place != null) {
                "https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=driving&dir_action=navigate"
            } else {
                "https://www.google.com/maps/dir/?api=1&destination=${Uri.encode(query)}&travelmode=driving&dir_action=navigate"
            }
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(web)))
        }
    }

    private fun showSnap(snap: Snap) {
        findViewById<TextView>(R.id.status).text = snap.note
        findViewById<TextView>(R.id.alert_title).text = snap.headline
        findViewById<TextView>(R.id.alert_detail).text = snap.detail
        val speed = if (snap.speedKph == null) "— 公里／時" else "${snap.speedKph.toInt()} 公里／時"
        findViewById<TextView>(R.id.speed).text = speed
        findViewById<TextView>(R.id.alert_road).text = snap.road
        val card = findViewById<LinearLayout>(R.id.alert_card)
        paintCard(card, snap.hot)
        val ink = Color.parseColor(if (snap.hot) "#2A1D05" else "#F4F0E6")
        val sub = Color.parseColor(if (snap.hot) "#2A1D05" else "#A7B0BC")
        findViewById<TextView>(R.id.alert_title).setTextColor(ink)
        findViewById<TextView>(R.id.alert_detail).setTextColor(ink)
        findViewById<TextView>(R.id.alert_road).setTextColor(ink)
        findViewById<TextView>(R.id.speed).setTextColor(sub)
        findViewById<Button>(R.id.start).text = if (snap.active && !snap.demo) "停止警示" else "開始警示"
        findViewById<Button>(R.id.demo).text = if (snap.demo) "試跑中" else "試跑警示"
        if (planned != null) renderRoute(snap)
    }

    private fun renderRoute(snap: Snap?) {
        val route = planned ?: return
        val place = destination ?: return
        val progress = if (snap?.lat != null && snap.lon != null) progressAlong(route.line, snap.lat, snap.lon) else null
        val aheadHits = hits.filter { progress == null || it.alongM + 120 >= progress.alongM }
        val off = if (progress != null && progress.offM > 1500) " 你已離開這條線約 ${formatDistance(progress.offM)}，可再規劃一次。" else ""
        findViewById<TextView>(R.id.route_summary).text =
            "到 ${place.name} · ${formatDistance(route.distanceM)} · ${formatTrip(route.durationS)}\n沿途 ${hits.size} 處，前方還有 ${aheadHits.size} 處。$off"
        val list = findViewById<LinearLayout>(R.id.route_list)
        list.removeAllViews()
        val density = resources.displayMetrics.density
        for (hit in aheadHits.take(8)) {
            val remain = if (progress != null) max(0.0, hit.alongM - progress.alongM) else hit.alongM
            val box = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = getDrawable(R.drawable.card)
                val pad = (12 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = (8 * density).toInt()
                }
            }
            box.addView(text((hit.camera.road.ifBlank { hit.camera.name }) + "  ·  " + formatDistance(remain), "#F4F0E6", 15f))
            val meta = listOf(
                hit.camera.placeLabel(),
                hit.camera.kindLabel(),
                hit.camera.limitKph?.let { "公布 $it" } ?: "",
            ).filter { it.isNotBlank() }.joinToString(" · ")
            box.addView(text(meta, "#A7B0BC", 13f))
            list.addView(box)
        }
        if (aheadHits.size > 8) {
            list.addView(text("還有 ${aheadHits.size - 8} 處，開近了會在上面響。", "#A7B0BC", 13f))
        }
    }

    private fun text(value: String, color: String, size: Float): TextView {
        return TextView(this).apply {
            text = value
            setTextColor(Color.parseColor(color))
            textSize = size
        }
    }

    private fun paintCard(view: View, hot: Boolean) {
        val density = resources.displayMetrics.density
        view.background = GradientDrawable().apply {
            cornerRadius = 16 * density
            setColor(Color.parseColor(if (hot) "#E6A322" else "#1C2129"))
            if (!hot) setStroke(density.toInt().coerceAtLeast(1), Color.parseColor("#3A4350"))
        }
    }

    private fun paintButton(button: Button, on: Boolean) {
        button.backgroundTintList = null
        button.setBackgroundResource(if (on) R.drawable.btn_amber else R.drawable.btn_surface)
        button.setTextColor(Color.parseColor(if (on) "#2A1D05" else "#F4F0E6"))
    }

    private fun ui(block: () -> Unit) {
        runOnUiThread(block)
    }

    private fun httpGet(url: String): String {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 12000
            readTimeout = 20000
            setRequestProperty("User-Agent", "JpSpeedNav/1.0")
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("http $code")
            return body
        } finally {
            conn.disconnect()
        }
    }
}
