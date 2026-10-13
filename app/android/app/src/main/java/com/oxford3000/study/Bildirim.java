package com.oxford3000.study;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import java.util.Locale;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bildirimler eklentisi — JS'te Capacitor.Plugins.Bildirim (hesap.js kullanır).
 *
 * Arkadaşlık isteği ve dürtme: configure ile sunucu adresi, herkese açık anahtar ve hesaba özel bildirim
 * anahtarı saklanır, {@link ArkadasWorker} dönemli olarak kurulur (uygulama kapalıyken de çalışır).
 * Seri / tekrar hatırlatmaları: planla ile JS'in hesapladığı yerel bildirimler zamanlanır ({@link HatirlatmaWorker}).
 * 22:00–08:00 arası hiç bildirim gösterilmez.
 *
 * Yöntemler:
 *   configure({url, key, secret, son, arkadas?, durt?})  ayarları sakla + dönemli kontrolü kur (her açılışta
 *                                       çağrılabilir). arkadas/durt: o tür bildirilsin mi (varsayılan evet).
 *                                       Dönen {ok, izin} ya da anahtar sunucuda geçersizse {ok:false, gecersiz:true}.
 *   disable()                           arkadaş kontrolünü durdur, ayarları sil (hatırlatmalara dokunmaz).
 *   seen({son})                         uygulamada görülen en yeni istek/dürtme zamanı (aynısı bildirilmesin).
 *   planla({items:[{id, tip, gun, at, baslik, metin, hedef}]})  hatırlatma planı (öncekilerin hepsinin yerine).
 *   checkNow()                          hemen bir kontrol (test için) → {durum, n?, bekleyen?}.
 *   permission() / requestPermission()  bildirim izni → {display: granted | denied | prompt}.
 *   openSettings()                      uygulamanın bildirim ayarları sayfası.
 *   launchTarget()                      bildirime dokunarak açıldıysa açılacak sayfa → {sayfa?} (bir kez verir).
 *   cihaz()                             kurulum ekranı için → {marka, sdk, pil (arka plan izni var mı), otobas (otomatik
 *                                       başlatma ayarı gereken marka mı)}.
 *   pilIzni()                           "arka planda çalışmaya izin ver" sistem penceresi (pil optimizasyonu dışı).
 *   otomatikBaslatma()                  markanın otomatik başlatma ekranı (Xiaomi, Huawei, Oppo, Vivo…) → {acildi:
 *                                       otobas | uygulama (bulunamadı, uygulama bilgisi açıldı) | ''}.
 */
@CapacitorPlugin(
        name = "Bildirim",
        permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = Bildirim.ALIAS) }
)
public class Bildirim extends Plugin {
    static final String ALIAS = "bildirim";

    @PluginMethod
    public void configure(PluginCall call) {
        String url = call.getString("url"), key = call.getString("key"), secret = call.getString("secret");
        String son = call.getString("son");
        if (empty(url) || empty(key) || empty(secret)) { call.reject("url, key ve secret gerekli"); return; }
        Context c = getContext();
        JSObject r = new JSObject();
        synchronized (Bildirimler.LOCK) {
            SharedPreferences sp = Bildirimler.prefs(c);
            if (secret.equals(sp.getString("bad", null))) {   // sunucu bu anahtarı tanımıyor: JS yenisini alsın
                r.put("ok", false);
                r.put("gecersiz", true);
                call.resolve(r);
                return;
            }
            SharedPreferences.Editor ed = sp.edit().putString("url", url).putString("key", key)
                    .putBoolean("t_arkadas", !Boolean.FALSE.equals(call.getBoolean("arkadas", true)))
                    .putBoolean("t_durt", !Boolean.FALSE.equals(call.getBoolean("durt", true)));
            if (!secret.equals(sp.getString("secret", null))) {   // yeni anahtar (yeni hesap/telefon): baştan
                ed.putString("secret", secret).remove("son").remove("bad");
                if (Bildirimler.isoMicros(son) != Long.MIN_VALUE) ed.putString("son", son);
            } else if (Bildirimler.later(son, sp.getString("son", null))) {
                ed.putString("son", son);
            }
            ed.apply();
        }
        Bildirimler.ensureFriendsChannel(c);
        try {
            ArkadasWorker.schedule(c);
        } catch (Exception e) {
            call.reject("zamanlanamadı: " + e.getMessage());
            return;
        }
        r.put("ok", true);
        r.put("izin", permText());
        call.resolve(r);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context c = getContext();
        try { ArkadasWorker.cancel(c); } catch (Exception e) {}
        synchronized (Bildirimler.LOCK) {
            Bildirimler.prefs(c).edit().remove("url").remove("key").remove("secret").remove("son").remove("bad").apply();
        }
        call.resolve();
    }

    @PluginMethod
    public void planla(PluginCall call) {
        JSArray items = call.getArray("items");
        try {
            JSObject r = new JSObject();
            r.put("ok", true);
            r.put("n", HatirlatmaWorker.plan(getContext(), items));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("planlanamadı: " + e.getMessage());
        }
    }

    @PluginMethod
    public void seen(PluginCall call) {
        Bildirimler.saveSon(getContext(), call.getString("son"));
        call.resolve();
    }

    @PluginMethod
    public void checkNow(final PluginCall call) {
        final Context c = getContext().getApplicationContext();
        new Thread(() -> {
            JSObject r;
            try {
                r = JSObject.fromJSONObject(ArkadasWorker.check(c));
            } catch (Exception e) {
                r = new JSObject();
                r.put("durum", "hata");
            }
            call.resolve(r);
        }).start();
    }

    @PluginMethod
    public void permission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("display", permText());
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState(ALIAS) == PermissionState.GRANTED) {
            permission(call);   // Android 12 ve altı: çalışma-zamanı izni yok
            return;
        }
        requestPermissionForAlias(ALIAS, call, "permCallback");
    }

    @PermissionCallback
    private void permCallback(PluginCall call) {
        permission(call);
    }

    /** granted | denied | prompt (prompt: hiç sorulmadı — "daha karar verilmedi"). */
    private String permText() {
        Context c = getContext();
        if (Bildirimler.enabled(c)) return "granted";
        if (Build.VERSION.SDK_INT < 33) return "denied";   // ayarlardan kapatılmış
        PermissionState ps = getPermissionState(ALIAS);
        if (ps == PermissionState.PROMPT) {
            // Capacitor yalnız kendi sorduğunu hatırlar; başka yerden sorulup reddedildiyse "denied".
            Activity a = getActivity();
            if (a != null && ActivityCompat.shouldShowRequestPermissionRationale(a, Manifest.permission.POST_NOTIFICATIONS)) return "denied";
            return "prompt";
        }
        return "denied";   // reddedildi ya da izin var ama ayarlardan kapalı
    }

    /** Uygulamanın bildirim ayarları (izin kalıcı reddedildiyse tek yol). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Context c = getContext();
        String pkg = c.getPackageName();
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                call.resolve();
            } catch (Exception e2) {
                call.reject("ayar sayfası açılamadı: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void launchTarget(PluginCall call) {
        JSObject r = new JSObject();
        String t = Bildirimler.takeTarget();
        if (t != null) r.put("sayfa", t);
        call.resolve(r);
    }

    // ---------------- kurulum ekranı ----------------
    /** Otomatik başlatma ayarı olan (arka plan uygulamalarını kendiliğinden kapatan) markalar. */
    private static final String[] OTOBAS_MARKA = { "xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "realme",
            "oneplus", "vivo", "iqoo", "meizu", "asus", "letv", "leeco" };
    /** Markaların otomatik başlatma ekranları (sırayla denenir; ilk açılan kullanılır). */
    private static final String[][] OTOBAS_EKRAN = {
            { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
            { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
            { "com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity" },
            { "com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity" },
            { "com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
            { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
            { "com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity" },
            { "com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity" },
            { "com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity" },
            { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
            { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity" },
            { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager" },
            { "com.meizu.safe", "com.meizu.safe.permission.SmartBGActivity" },
            { "com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity" },
            { "com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity" }
    };

    private static String marka() {
        String m = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER) + " " + (Build.BRAND == null ? "" : Build.BRAND);
        return m.toLowerCase(Locale.ROOT).trim();
    }

    private static boolean otobasGerekli() {
        String m = marka();
        for (String b : OTOBAS_MARKA) if (m.contains(b)) return true;
        return false;
    }

    /** Uygulama pil optimizasyonu dışında mı (Android 6+; daha eskisinde kısıtlama yok). */
    private boolean pilSerbest() {
        if (Build.VERSION.SDK_INT < 23) return true;
        try {
            Context c = getContext();
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void cihaz(PluginCall call) {
        JSObject r = new JSObject();
        r.put("marka", marka());
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("pil", pilSerbest());
        r.put("otobas", otobasGerekli());
        call.resolve(r);
    }

    private boolean ac(Intent i) {
        try {
            Activity a = getActivity();
            if (a != null) a.startActivity(i);
            else { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean uygulamaBilgisi() {
        return ac(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
    }

    /** "Arka planda çalışmaya izin ver" penceresi; olmazsa pil optimizasyonu listesi, o da olmazsa uygulama bilgisi. */
    @PluginMethod
    public void pilIzni(PluginCall call) {
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT < 23 || pilSerbest()) { r.put("pil", true); call.resolve(r); return; }
        boolean ok = ac(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName())));
        if (!ok) ok = ac(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        if (!ok) uygulamaBilgisi();
        r.put("pil", pilSerbest());
        call.resolve(r);
    }

    @PluginMethod
    public void otomatikBaslatma(PluginCall call) {
        JSObject r = new JSObject();
        for (String[] k : OTOBAS_EKRAN) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(k[0], k[1]));
            if (ac(i)) { r.put("acildi", "otobas"); call.resolve(r); return; }
        }
        Intent miui = new Intent("miui.intent.action.OP_AUTO_START");
        miui.addCategory(Intent.CATEGORY_DEFAULT);
        if (ac(miui)) { r.put("acildi", "otobas"); call.resolve(r); return; }
        r.put("acildi", uygulamaBilgisi() ? "uygulama" : "");   // uygulama bilgisinde "Otomatik başlatma" anahtarı olabilir
        call.resolve(r);
    }

    private static boolean empty(String s) { return s == null || s.trim().isEmpty(); }
}
