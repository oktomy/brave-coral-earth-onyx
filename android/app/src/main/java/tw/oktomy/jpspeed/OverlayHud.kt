package tw.oktomy.jpspeed

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt

class OverlayHud(private val context: Context) {
    private val window = context.getSystemService(WindowManager::class.java)
    private val prefs = context.getSharedPreferences("overlay-hud", Context.MODE_PRIVATE)
    private var root: LinearLayout? = null
    private var params: WindowManager.LayoutParams? = null
    private var scale = prefs.getFloat("scale", 1f).coerceIn(MIN_SCALE, MAX_SCALE)
    private var dragFromX = 0f
    private var dragFromY = 0f
    private var originX = 0
    private var originY = 0

    fun allowed(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
    }

    fun show() {
        if (root != null || !allowed()) return
        val themed = ContextThemeWrapper(context, R.style.AppTheme)
        val view = LayoutInflater.from(themed).inflate(R.layout.overlay_hud, null) as LinearLayout
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val layout = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT,
        )
        val density = context.resources.displayMetrics.density
        val screen = context.resources.displayMetrics
        layout.gravity = Gravity.TOP or Gravity.START
        layout.x = prefs.getInt("x", ((screen.widthPixels - 240 * density) / 2f).roundToInt().coerceAtLeast(0))
        layout.y = prefs.getInt("y", (72 * density).roundToInt())
        view.findViewById<TextView>(R.id.overlay_smaller).setOnClickListener {
            scale = (scale - STEP).coerceAtLeast(MIN_SCALE)
            applyScale(view)
            view.post { save() }
        }
        view.findViewById<TextView>(R.id.overlay_larger).setOnClickListener {
            scale = (scale + STEP).coerceAtMost(MAX_SCALE)
            applyScale(view)
            view.post { save() }
        }
        view.setOnTouchListener { _, event -> onDrag(view, event) }
        window.addView(view, layout)
        root = view
        params = layout
        applyScale(view)
    }

    fun update(title: String, detail: String, road: String, hot: Boolean) {
        val view = root ?: return
        view.setBackgroundColor(Color.parseColor(if (hot) "#E6A322" else "#F21C2129"))
        val ink = if (hot) "#2A1D05" else "#F4F0E6"
        val sub = if (hot) "#2A1D05" else "#A7B0BC"
        paint(view, R.id.overlay_title, title, ink)
        paint(view, R.id.overlay_detail, detail, ink)
        paint(view, R.id.overlay_road, road, sub)
        paint(view, R.id.overlay_drag, "按住拖移", sub)
        paint(view, R.id.overlay_smaller, "－", ink)
        paint(view, R.id.overlay_larger, "＋", ink)
        applyScale(view)
    }

    fun hide() {
        val view = root ?: return
        root = null
        params = null
        try {
            window.removeView(view)
        } catch (_: Exception) {
        }
    }

    private fun paint(view: View, id: Int, text: String, color: String) {
        view.findViewById<TextView>(id).apply {
            this.text = text
            setTextColor(Color.parseColor(color))
        }
    }

    private fun applyScale(view: LinearLayout) {
        val layout = params ?: return
        view.findViewById<TextView>(R.id.overlay_drag).textSize = 12f * scale
        view.findViewById<TextView>(R.id.overlay_title).textSize = 13f * scale
        view.findViewById<TextView>(R.id.overlay_detail).textSize = 28f * scale
        view.findViewById<TextView>(R.id.overlay_road).apply {
            textSize = 13f * scale
            maxWidth = (260 * context.resources.displayMetrics.density * scale).roundToInt()
        }
        view.findViewById<TextView>(R.id.overlay_smaller).textSize = 20f * scale
        view.findViewById<TextView>(R.id.overlay_larger).textSize = 20f * scale
        val density = context.resources.displayMetrics.density
        val padH = (14 * density * scale).roundToInt()
        val padV = (8 * density * scale).roundToInt()
        view.setPadding(padH, padV, padH, padV)
        try {
            window.updateViewLayout(view, layout)
        } catch (_: Exception) {
        }
        view.post {
            if (root !== view) return@post
            clamp(view, layout)
            try {
                window.updateViewLayout(view, layout)
            } catch (_: Exception) {
            }
        }
    }

    private fun onDrag(view: LinearLayout, event: MotionEvent): Boolean {
        val layout = params ?: return false
        if (event.actionMasked == MotionEvent.ACTION_DOWN && (hits(view, R.id.overlay_smaller, event) || hits(view, R.id.overlay_larger, event))) {
            return false
        }
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                dragFromX = event.rawX
                dragFromY = event.rawY
                originX = layout.x
                originY = layout.y
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                layout.x = originX + (event.rawX - dragFromX).roundToInt()
                layout.y = originY + (event.rawY - dragFromY).roundToInt()
                clamp(view, layout)
                window.updateViewLayout(view, layout)
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                save()
                return true
            }
        }
        return false
    }

    private fun hits(view: View, id: Int, event: MotionEvent): Boolean {
        val child = view.findViewById<View>(id)
        val spot = IntArray(2)
        child.getLocationOnScreen(spot)
        return event.rawX >= spot[0] && event.rawX <= spot[0] + child.width &&
            event.rawY >= spot[1] && event.rawY <= spot[1] + child.height
    }

    private fun clamp(view: View, layout: WindowManager.LayoutParams) {
        val screen = context.resources.displayMetrics
        val maxX = (screen.widthPixels - view.width).coerceAtLeast(0)
        val maxY = (screen.heightPixels - view.height).coerceAtLeast(0)
        layout.x = layout.x.coerceIn(0, maxX)
        layout.y = layout.y.coerceIn(0, maxY)
    }

    private fun save() {
        val layout = params ?: return
        prefs.edit().putFloat("scale", scale).putInt("x", layout.x).putInt("y", layout.y).apply()
    }

    companion object {
        private const val MIN_SCALE = 0.7f
        private const val MAX_SCALE = 2f
        private const val STEP = 0.15f
    }
}
