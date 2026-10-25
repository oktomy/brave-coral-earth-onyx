package tw.oktomy.jpspeed

import android.content.Context
import org.json.JSONArray

data class Camera(
    val id: String,
    val name: String,
    val prefecture: String,
    val city: String,
    val road: String,
    val kind: String,
    val limitKph: Int?,
    val lat: Double,
    val lon: Double,
    val status: String,
)

private val PREF = mapOf(
    "hokkaido" to "北海道",
    "aomori" to "青森縣",
    "iwate" to "岩手縣",
    "miyagi" to "宮城縣",
    "akita" to "秋田縣",
    "yamagata" to "山形縣",
    "fukushima" to "福島縣",
    "ibaraki" to "茨城縣",
    "tochigi" to "栃木縣",
    "gunma" to "群馬縣",
    "saitama" to "埼玉縣",
    "chiba" to "千葉縣",
    "tokyo" to "東京都",
    "kanagawa" to "神奈川縣",
    "niigata" to "新潟縣",
    "toyama" to "富山縣",
    "ishikawa" to "石川縣",
    "fukui" to "福井縣",
    "yamanashi" to "山梨縣",
    "nagano" to "長野縣",
    "gifu" to "岐阜縣",
    "shizuoka" to "靜岡縣",
    "aichi" to "愛知縣",
    "mie" to "三重縣",
    "shiga" to "滋賀縣",
    "kyoto" to "京都府",
    "osaka" to "大阪府",
    "hyogo" to "兵庫縣",
    "nara" to "奈良縣",
    "wakayama" to "和歌山縣",
    "tottori" to "鳥取縣",
    "shimane" to "島根縣",
    "okayama" to "岡山縣",
    "hiroshima" to "廣島縣",
    "yamaguchi" to "山口縣",
    "tokushima" to "德島縣",
    "kagawa" to "香川縣",
    "ehime" to "愛媛縣",
    "kochi" to "高知縣",
    "fukuoka" to "福岡縣",
    "saga" to "佐賀縣",
    "nagasaki" to "長崎縣",
    "kumamoto" to "熊本縣",
    "oita" to "大分縣",
    "miyazaki" to "宮崎縣",
    "kagoshima" to "鹿兒島縣",
    "okinawa" to "沖繩縣",
)

private val KIND = mapOf(
    "fixed" to "固定式",
    "semi" to "半固定式",
    "osm" to "地圖標註",
    "mobile" to "移動式目擊",
    "guide" to "指南地圖",
)

fun Camera.placeLabel(): String {
    return listOfNotNull(PREF[prefecture], city.takeIf { it.isNotBlank() }).joinToString(" ")
}

fun Camera.kindLabel(): String = KIND[kind] ?: kind

object Cameras {
    @Volatile
    var all: List<Camera> = emptyList()
        private set

    @Synchronized
    fun load(context: Context) {
        if (all.isNotEmpty()) return
        val text = context.assets.open("cameras.json").bufferedReader().use { it.readText() }
        val arr = JSONArray(text)
        val list = ArrayList<Camera>(arr.length())
        for (i in 0 until arr.length()) {
            val item = arr.getJSONObject(i)
            list.add(
                Camera(
                    id = item.getString("id"),
                    name = item.optString("name"),
                    prefecture = item.optString("prefecture"),
                    city = item.optString("city"),
                    road = item.optString("road"),
                    kind = item.optString("kind"),
                    limitKph = if (item.isNull("limitKph")) null else item.getInt("limitKph"),
                    lat = item.getDouble("lat"),
                    lon = item.getDouble("lon"),
                    status = item.optString("status"),
                ),
            )
        }
        all = list
    }

    fun byId(id: String): Camera? = all.find { it.id == id }
}
