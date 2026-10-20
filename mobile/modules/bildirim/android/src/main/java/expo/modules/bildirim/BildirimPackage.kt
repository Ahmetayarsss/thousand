package expo.modules.bildirim

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Bildirime dokunarak açılınca hedef sayfayı saklar (eski uygulamada MainActivity yapıyordu); JS launchTarget() ile
 * alır. Son uygulamalar listesinden yeniden açılışta yok sayılır.
 */
class BildirimPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        if (savedInstanceState == null) hedefAl(activity.intent)
      }
      override fun onNewIntent(intent: Intent): Boolean {
        hedefAl(intent)
        return false
      }
    })

  companion object {
    fun hedefAl(i: Intent?): Boolean {
      try {
        if (i == null || (i.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return false
        val t = i.getStringExtra(Bildirimler.EXTRA_TARGET) ?: return false
        i.removeExtra(Bildirimler.EXTRA_TARGET)
        Bildirimler.setTarget(t)
        return true
      } catch (e: Exception) {
        return false
      }
    }
  }
}
