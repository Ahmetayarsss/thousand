package expo.modules.bildirim

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.util.Locale

/**
 * Bildirimler köprüsü (eski uygulamadaki Bildirim eklentisinin karşılığı; yöntemler ve dönenler aynı).
 * JS: requireOptionalNativeModule("Bildirim") — mobile/src/bildirim.js. Asıl iş Bildirimler, ArkadasWorker,
 * HatirlatmaWorker'da (eski uygulamadan aynen).
 *
 *   configure({url, key, secret, son, arkadas?, durt?}) → {ok, izin} ya da {ok:false, gecersiz:true}
 *   disable(), seen(son), planla(items) → {ok, n}, checkNow() → {durum, …}
 *   permission() / requestPermission() → {display: granted | denied | prompt}, openSettings()
 *   launchTarget() → {sayfa?}, cihaz() → {marka, sdk, otobas}, otomatikBaslatma() → {acildi}
 */
class BildirimModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** granted | denied | prompt (prompt: sorulabilir). İzin bir kez sorulup kalıcı reddedildiyse denied. */
  private fun izin(): String {
    if (Bildirimler.enabled(context)) return "granted"
    if (Build.VERSION.SDK_INT < 33) return "denied"   // Android 12 ve altı: ayarlardan kapatılmış
    val soruldu = Bildirimler.prefs(context).getBoolean("izin_soruldu", false)
    val a = appContext.currentActivity
    val yenidenSorulur = a != null && ActivityCompat.shouldShowRequestPermissionRationale(a, Manifest.permission.POST_NOTIFICATIONS)
    return if (!soruldu || yenidenSorulur) "prompt" else "denied"
  }

  private fun ac(i: Intent): Boolean = try {
    val a = appContext.currentActivity
    if (a != null) a.startActivity(i) else { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(i) }
    true
  } catch (e: Exception) { false }

  override fun definition() = ModuleDefinition {
    Name("Bildirim")

    Function("configure") { o: Map<String, Any?> ->
      val url = o["url"] as? String
      val key = o["key"] as? String
      val secret = o["secret"] as? String
      val son = o["son"] as? String
      if (url.isNullOrBlank() || key.isNullOrBlank() || secret.isNullOrBlank()) throw IllegalArgumentException("url, key ve secret gerekli")
      synchronized(Bildirimler.LOCK) {
        val sp = Bildirimler.prefs(context)
        if (secret == sp.getString("bad", null)) return@Function mapOf("ok" to false, "gecersiz" to true)   // sunucu tanımıyor: JS yenisini alsın
        val ed = sp.edit().putString("url", url).putString("key", key)
          .putBoolean("t_arkadas", o["arkadas"] != false)
          .putBoolean("t_durt", o["durt"] != false)
        if (secret != sp.getString("secret", null)) {   // yeni anahtar (yeni hesap/telefon): baştan
          ed.putString("secret", secret).remove("son").remove("bad")
          if (Bildirimler.isoMicros(son) != Long.MIN_VALUE) ed.putString("son", son)
        } else if (Bildirimler.later(son, sp.getString("son", null))) {
          ed.putString("son", son)
        }
        ed.apply()
      }
      Bildirimler.ensureFriendsChannel(context)
      ArkadasWorker.schedule(context)
      mapOf("ok" to true, "izin" to izin())
    }

    Function("disable") {
      try { ArkadasWorker.cancel(context) } catch (e: Exception) {}
      synchronized(Bildirimler.LOCK) {
        Bildirimler.prefs(context).edit().remove("url").remove("key").remove("secret").remove("son").remove("bad").apply()
      }
    }

    Function("planla") { items: List<Map<String, Any?>> ->
      mapOf("ok" to true, "n" to HatirlatmaWorker.plan(context, JSONArray(items)))
    }

    Function("seen") { son: String? -> Bildirimler.saveSon(context, son) }

    AsyncFunction("checkNow") { promise: Promise ->
      val c = context.applicationContext
      Thread {
        val r = try { ArkadasWorker.check(c) } catch (e: Exception) { null }
        val m = mutableMapOf<String, Any?>()
        if (r == null) m["durum"] = "hata" else r.keys().forEach { k -> m[k] = r.opt(k) }
        promise.resolve(m)
      }.start()
    }

    Function("permission") { mapOf("display" to izin()) }

    AsyncFunction("requestPermission") { promise: Promise ->
      val pm = appContext.permissions
      if (Build.VERSION.SDK_INT < 33 || Bildirimler.enabled(context) || pm == null) {
        promise.resolve(mapOf("display" to izin()))
        return@AsyncFunction
      }
      pm.askForPermissions({ _ ->
        Bildirimler.prefs(context).edit().putBoolean("izin_soruldu", true).apply()
        promise.resolve(mapOf("display" to izin()))
      }, Manifest.permission.POST_NOTIFICATIONS)
    }

    // Uygulamanın bildirim ayarları (izin kalıcı reddedildiyse tek yol).
    Function("openSettings") {
      val pkg = context.packageName
      val i = if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
      else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
      if (!ac(i)) ac(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
    }

    Function("launchTarget") {
      val t = Bildirimler.takeTarget()
      if (t != null) mapOf("sayfa" to t) else emptyMap<String, Any>()
    }

    // ---- kurulum ekranı ----
    Function("cihaz") { mapOf("marka" to marka(), "sdk" to Build.VERSION.SDK_INT, "otobas" to OTOBAS_MARKA.any { marka().contains(it) }) }

    Function("otomatikBaslatma") {
      for (k in OTOBAS_EKRAN) {
        if (ac(Intent().setComponent(ComponentName(k[0], k[1])))) return@Function mapOf("acildi" to "otobas")
      }
      if (ac(Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT))) return@Function mapOf("acildi" to "otobas")
      // uygulama bilgisinde "Otomatik başlatma" anahtarı olabilir
      mapOf("acildi" to if (ac(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))) "uygulama" else "")
    }
  }

  companion object {
    private fun marka() = ((Build.MANUFACTURER ?: "") + " " + (Build.BRAND ?: "")).lowercase(Locale.ROOT).trim()

    /** Otomatik başlatma ayarı olan (arka plan uygulamalarını kendiliğinden kapatan) markalar. */
    private val OTOBAS_MARKA = listOf("xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "realme",
      "oneplus", "vivo", "iqoo", "meizu", "asus", "letv", "leeco")

    /** Markaların otomatik başlatma ekranları (sırayla denenir; ilk açılan kullanılır). */
    private val OTOBAS_EKRAN = listOf(
      arrayOf("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      arrayOf("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      arrayOf("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
      arrayOf("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"),
      arrayOf("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      arrayOf("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      arrayOf("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      arrayOf("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
      arrayOf("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
      arrayOf("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      arrayOf("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
      arrayOf("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      arrayOf("com.meizu.safe", "com.meizu.safe.permission.SmartBGActivity"),
      arrayOf("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
      arrayOf("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"),
    )
  }
}
