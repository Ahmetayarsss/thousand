package com.oxford3000.study;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * Seri / tekrar hatırlatmaları — yerel bildirim (sunucu yok).
 *
 * JS (hesap.js) önümüzdeki en çok 3 günün hatırlatmalarını içerikleriyle hesaplar ve {@link #plan} ile verir;
 * her biri gecikmeli tek seferlik bir WorkManager işi olur (etiket {@link #TAG}; yeni plan eskilerin hepsini
 * siler). Uygulama açılınca, her sınav cevabında ve arka plana geçerken plan yeniden kurulur: çalışınca o
 * günün seri hatırlatması kalkar; uygulama 3 gün açılmazsa hatırlatmalar biter.
 *
 * Çalışınca son kez bakar: sessiz saat (22:00–08:00) ya da gün geçmişse (iş gecikti) göstermez; izin/kanal
 * kapalıysa göstermez; aynı tür o gün zaten gösterildiyse ya da o gün 2 hatırlatma olduysa göstermez.
 */
public class HatirlatmaWorker extends Worker {
    public static final String TAG = "ox_hatirlatma";
    private static final long MAX_AHEAD = 4L * 86400000L;   // güvenlik payı (JS en çok 3 gün verir)

    public HatirlatmaWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try { show(getApplicationContext(), getInputData()); } catch (Throwable t) {}
        return Result.success();
    }

    /** Planı kur: eski hatırlatmaların hepsi silinir, gelecektekiler yeniden zamanlanır. Dönen: kurulan sayı. */
    public static int plan(Context c, JSONArray items) {
        WorkManager wm = WorkManager.getInstance(c);
        wm.cancelAllWorkByTag(TAG);
        Bildirimler.ensureRemindChannel(c);
        long now = System.currentTimeMillis();
        int n = 0;
        for (int i = 0; items != null && i < items.length() && n < 12; i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at", 0);
            String id = o.optString("id", ""), tip = o.optString("tip", ""), gun = o.optString("gun", ""), baslik = o.optString("baslik", "");
            if (at <= now || at - now > MAX_AHEAD || id.isEmpty() || tip.isEmpty() || gun.isEmpty() || baslik.isEmpty()) continue;
            Data d = new Data.Builder()
                    .putString("id", id).putString("tip", tip).putString("gun", gun).putString("baslik", baslik)
                    .putString("metin", o.optString("metin", "")).putString("hedef", o.optString("hedef", ""))
                    .putLong("at", at)
                    .build();
            OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(HatirlatmaWorker.class)
                    .setInitialDelay(at - now, TimeUnit.MILLISECONDS)
                    .setInputData(d)
                    .addTag(TAG)
                    .build();
            wm.enqueueUniqueWork("ox_hat_" + id, ExistingWorkPolicy.REPLACE, req);
            n++;
        }
        return n;
    }

    /** Zamanı gelen hatırlatma. Dönen durum (teşhis için). */
    static String show(Context c, Data d) {
        String tip = d.getString("tip"), gun = d.getString("gun"), baslik = d.getString("baslik");
        String metin = d.getString("metin"), hedef = d.getString("hedef");
        if (tip == null || gun == null || baslik == null) return "eksik";
        if (Bildirimler.quiet()) return "gece";                    // 22:00–08:00: hatırlatma yok
        if (!gun.equals(Bildirimler.todayStr())) return "eski";    // iş gecikti, gün geçti
        Bildirimler.ensureRemindChannel(c);
        if (!Bildirimler.canPost(c, Bildirimler.CH_REMIND)) return "izin_yok";
        synchronized (Bildirimler.LOCK) {
            SharedPreferences sp = Bildirimler.prefs(c);
            if (gun.equals(sp.getString("h_" + tip, null))) return "zaten";   // bu tür bugün gösterildi
            int sayi = gun.equals(sp.getString("h_gun", null)) ? sp.getInt("h_sayi", 0) : 0;
            if (sayi >= 2) return "sinir";                                     // günde en çok 2 hatırlatma
            sp.edit().putString("h_" + tip, gun).putString("h_gun", gun).putInt("h_sayi", sayi + 1).apply();
        }
        int id = "tekrar".equals(tip) ? Bildirimler.ID_REVIEW : Bildirimler.ID_STREAK;
        Bildirimler.post(c, Bildirimler.CH_REMIND, id, R.drawable.ic_stat_remind, NotificationCompat.CATEGORY_REMINDER,
                baslik, metin, (hedef == null || hedef.isEmpty()) ? null : hedef, 0);
        return "gosterildi";
    }
}
