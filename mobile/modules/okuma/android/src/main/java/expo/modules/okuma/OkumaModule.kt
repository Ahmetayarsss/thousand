package expo.modules.okuma

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * "Listeyi oku" köprüsü (eski uygulamadaki GroupTts eklentisinin karşılığı). Asıl iş OkumaServisi'nde.
 * JS: requireOptionalNativeModule("Okuma") — mobile/src/okuma.js.
 *
 * Yöntemler: speakGroup, stop, getState, setOptions, setGap, openNotificationSettings.
 * Olaylar: wordStart {index, word}, state {active, paused, index, word}, done, ttsError {msg}.
 * speakGroup'ta "slugs" artık sesin kaynağı (res/raw adı ya da geliştirmede adres; boşsa TTS).
 */
class OkumaModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun ilerleme() = object : OkumaServisi.Progress {
    override fun onWord(index: Int, word: String?) {
      sendEvent("wordStart", mapOf("index" to index, "word" to (word ?: "")))
    }
    override fun onState(active: Boolean, paused: Boolean, index: Int, word: String?) {
      sendEvent("state", mapOf("active" to active, "paused" to paused, "index" to index, "word" to (word ?: "")))
    }
    override fun onDone() { sendEvent("done", emptyMap<String, Any>()) }
    override fun onError(msg: String?) { sendEvent("ttsError", mapOf("msg" to (msg ?: ""))) }
  }

  private fun liste(o: Map<String, Any?>, k: String): Array<String> =
    ((o[k] as? List<*>) ?: emptyList<Any?>()).map { it?.toString() ?: "" }.toTypedArray()

  override fun definition() = ModuleDefinition {
    Name("Okuma")
    Events("wordStart", "state", "done", "ttsError")

    // Ekran yeniden kurulsa da süren okumanın olayları buraya gelsin.
    OnCreate { OkumaServisi.progress = ilerleme() }
    OnDestroy { OkumaServisi.progress = null }

    Function("speakGroup") { o: Map<String, Any?> ->
      OkumaServisi.progress = ilerleme()
      bildirimIzniIste()
      val i = Intent(context, OkumaServisi::class.java).apply {
        action = OkumaServisi.ACTION_START
        putExtra("words", liste(o, "words"))
        putExtra("slugs", liste(o, "slugs"))
        putExtra("trs", liste(o, "trs"))
        putExtra("says", liste(o, "says"))
        putExtra("levels", liste(o, "levels"))
        putExtra("rate", (o["rate"] as? Number)?.toFloat() ?: 1.0f)
        putExtra("gap", (o["gap"] as? Number)?.toInt() ?: 0)
        putExtra("start", (o["start"] as? Number)?.toInt() ?: 0)
        putExtra("loop", o["loop"] as? Boolean ?: true)
        putExtra("readTr", o["readTr"] as? Boolean ?: false)
      }
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
    }

    // Çalışmıyorsa hizmeti boşuna başlatma.
    Function("stop") { OkumaServisi.instance?.requestStop() }

    Function("getState") {
      val s = OkumaServisi.instance
      if (s == null || !s.isActiveNow()) mapOf("active" to false)
      else mapOf("active" to true, "paused" to s.isPausedNow(), "index" to s.currentIndex(), "word" to s.currentWord(), "total" to s.total())
    }

    Function("setOptions") { loop: Boolean, readTr: Boolean -> OkumaServisi.instance?.applyOptions(loop, readTr) }

    // Kelimeler arası bekleme (ms): okuma sürerken değişir, yeniden başlatmaz.
    Function("setGap") { gap: Int -> OkumaServisi.instance?.applyGap(gap) }

    // Uygulamanın bildirim ayarları (bildirimler kapalıysa okuma bildirimi görünmez).
    Function("openNotificationSettings") {
      val pkg = context.packageName
      val i = if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
      else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      // Bazı telefonlarda bildirim ayarı sayfası yok: uygulama ayrıntılarına düş (eskisi gibi).
      try { context.startActivity(i) } catch (e: Exception) {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }

  // Android 13+: bildirim izni yoksa okuma başlarken iste (okuma bildirimi ve kilit ekranı düğmeleri için).
  private fun bildirimIzniIste() {
    if (Build.VERSION.SDK_INT < 33) return
    val a = appContext.currentActivity ?: return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(a, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4202)
    }
  }
}
