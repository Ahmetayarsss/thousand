package com.oxford3000.study;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * "Listeyi oku" eklentisi (ince köprü). Asıl iş {@link GroupTtsService} içinde.
 *
 * JS'te Capacitor.Plugins.GroupTts olarak görünür (sayfalar @capacitor/core
 * paketlemediği için registerPlugin YOK; Capacitor eklentiyi kendisi enjekte eder).
 *
 * Yöntemler: speakGroup, stop, getState, setOptions, setGap, openNotificationSettings.
 * Olaylar: wordStart {index, word}, state {active, paused, index, word}, done, ttsError {msg}.
 */
@CapacitorPlugin(name = "GroupTts")
public class GroupTts extends Plugin {

    private static final int REQ_NOTIF = 4202;

    @Override
    public void load() {
        // Sayfa/etkinlik yeniden kurulsa da süren okumanın olayları yeni eklentiye gelsin.
        GroupTtsService.progress = makeProgress();
    }

    private GroupTtsService.Progress makeProgress() {
        return new GroupTtsService.Progress() {
            @Override
            public void onWord(int index, String word) {
                JSObject d = new JSObject();
                d.put("index", index);
                d.put("word", word);
                notifyListeners("wordStart", d);
            }

            @Override
            public void onState(boolean active, boolean paused, int index, String word) {
                JSObject d = new JSObject();
                d.put("active", active);
                d.put("paused", paused);
                d.put("index", index);
                d.put("word", word);
                notifyListeners("state", d);
            }

            @Override
            public void onDone() {
                notifyListeners("done", new JSObject());
            }

            @Override
            public void onError(String msg) {
                JSObject d = new JSObject();
                d.put("msg", msg);
                notifyListeners("ttsError", d);
            }
        };
    }

    private static List<String> strings(PluginCall call, String key) {
        List<String> out = new ArrayList<>();
        JSArray arr = call.getArray(key);
        if (arr == null) return out;
        try {
            for (Object o : arr.toList()) out.add(o == null ? "" : String.valueOf(o));
        } catch (Exception e) {}
        return out;
    }

    @PluginMethod
    public void speakGroup(PluginCall call) {
        List<String> words = strings(call, "words");
        Float r = call.getFloat("rate", 1.0f);
        Integer g = call.getInt("gap", 0);
        Integer st = call.getInt("start", 0);
        Boolean loop = call.getBoolean("loop", true);
        Boolean readTr = call.getBoolean("readTr", false);

        GroupTtsService.progress = makeProgress();
        askNotificationPermission();

        Intent i = new Intent(getContext(), GroupTtsService.class);
        i.setAction(GroupTtsService.ACTION_START);
        i.putExtra("words", words.toArray(new String[0]));
        i.putExtra("slugs", strings(call, "slugs").toArray(new String[0]));
        i.putExtra("trs", strings(call, "trs").toArray(new String[0]));
        i.putExtra("says", strings(call, "says").toArray(new String[0]));
        i.putExtra("levels", strings(call, "levels").toArray(new String[0]));
        i.putExtra("rate", r == null ? 1.0f : r);
        i.putExtra("gap", g == null ? 0 : g);
        i.putExtra("start", st == null ? 0 : st);
        i.putExtra("loop", loop == null || loop);
        i.putExtra("readTr", readTr != null && readTr);
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
        } catch (Exception e) {
            call.reject("servis başlatılamadı: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        // Çalışmıyorsa hizmeti boşuna başlatma.
        GroupTtsService s = GroupTtsService.instance;
        if (s != null) s.requestStop();
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        GroupTtsService s = GroupTtsService.instance;
        JSObject r = new JSObject();
        boolean act = s != null && s.isActiveNow();
        r.put("active", act);
        if (act) {
            r.put("paused", s.isPausedNow());
            r.put("index", s.currentIndex());
            r.put("word", s.currentWord());
            r.put("total", s.total());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void setOptions(PluginCall call) {
        GroupTtsService s = GroupTtsService.instance;
        Boolean loop = call.getBoolean("loop", true);
        Boolean readTr = call.getBoolean("readTr", false);
        if (s != null) s.applyOptions(loop == null || loop, readTr != null && readTr);
        call.resolve();
    }

    /** Kelimeler arası bekleme (ms): okuma sürerken değişir, yeniden başlatmaz. */
    @PluginMethod
    public void setGap(PluginCall call) {
        GroupTtsService s = GroupTtsService.instance;
        Integer g = call.getInt("gap", 0);
        if (s != null) s.applyGap(g == null ? 0 : g);
        call.resolve();
    }

    /** Uygulamanın bildirim ayarları sayfasını aç (bildirimler kapalıysa). */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                call.resolve();
            } catch (Exception e2) {
                call.reject("ayar sayfası açılamadı: " + e2.getMessage());
            }
        }
    }

    /** Android 13+: bildirim izni yoksa okuma başlarken de iste (açılışta reddedildiyse). */
    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        try {
            if (getActivity() != null
                    && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[]{ Manifest.permission.POST_NOTIFICATIONS }, REQ_NOTIF);
            }
        } catch (Exception e) {}
    }

    @Override
    protected void handleOnDestroy() {
        GroupTtsService.progress = null;
    }
}
