package com.oxford3000.study;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

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

    private static boolean empty(String s) { return s == null || s.trim().isEmpty(); }
}
