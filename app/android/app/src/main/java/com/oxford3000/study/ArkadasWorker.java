package com.oxford3000.study;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * Arkadaşlık isteği kontrolü — WorkManager ile ~15 dk'da bir, internet varken; uygulama kapalıyken de.
 *
 * Supabase'teki bildirim_kontrol'ü hesaba özel bildirim anahtarıyla çağırır (uygulamanın oturumu/JWT
 * kullanılmaz; yalnız herkese açık anahtar "apikey" başlığında). Son görülen istekten (son) yeni istek
 * varsa bildirim gösterir. Anahtar geçersizse (hesap başka telefona taşındı / silindi) kendini kapatır.
 * Bildirim izni yoksa sunucuya hiç gitmez. Hiçbir hata uygulamayı düşürmez.
 */
public class ArkadasWorker extends Worker {
    public static final String WORK = "ox_arkadas";

    public ArkadasWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try { check(getApplicationContext()); } catch (Throwable t) {}
        return Result.success();   // hata olsa da: bir sonraki dönemde yeniden denenir
    }

    /** Dönemli işi kur. Varsa takvimi sıfırlamadan yeni tanımı uygular (UPDATE); ayarlar her çalışmada okunur. */
    public static void schedule(Context c) {
        Constraints cons = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(ArkadasWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(cons)
                .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req);
    }

    public static void cancel(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork(WORK);
    }

    /** Bir kontrol. Dönen: {durum, n?, bekleyen?} (eklentinin checkNow'u için; teşhis). */
    public static synchronized JSONObject check(Context c) {
        JSONObject out = new JSONObject();
        try {
            SharedPreferences sp = Bildirimler.prefs(c);
            String url, key, secret, son;
            synchronized (Bildirimler.LOCK) {
                url = sp.getString("url", null);
                key = sp.getString("key", null);
                secret = sp.getString("secret", null);
                son = sp.getString("son", null);
            }
            if (empty(url) || empty(key) || empty(secret)) return out.put("durum", "ayar_yok");
            Bildirimler.ensureFriendsChannel(c);
            if (!Bildirimler.canPost(c, Bildirimler.CH_FRIENDS)) return out.put("durum", "izin_yok");

            JSONObject body = new JSONObject();
            body.put("p_anahtar", secret);
            if (son != null) body.put("p_sonra", son);
            int[] code = new int[1];
            String text = post(url + "/rest/v1/rpc/bildirim_kontrol", key, body.toString(), code);
            out.put("http", code[0]);
            if (code[0] != 200 || text == null) return out.put("durum", "http_" + code[0]);   // ör. 404: kurulum.sql henüz çalıştırılmadı
            JSONObject r = new JSONObject(text);
            if (!r.optBoolean("ok", false)) {
                synchronized (Bildirimler.LOCK) {   // bu arada yeni anahtar geldiyse dokunma
                    if (secret.equals(sp.getString("secret", null))) {
                        sp.edit().putString("bad", secret).remove("secret").remove("son").apply();
                        cancel(c);
                    }
                }
                return out.put("durum", "gecersiz");
            }
            int bekleyen = r.optInt("bekleyen", 0);
            out.put("bekleyen", bekleyen);
            JSONArray yeni = r.optJSONArray("yeni");
            int n = yeni == null ? 0 : yeni.length();
            if (n == 0) return out.put("durum", "yeni_yok");

            JSONObject ilk = yeni.optJSONObject(0);
            String nick = ilk != null ? ilk.optString("nick", "") : "";
            if (nick.trim().isEmpty()) nick = "Biri";
            String metin = n == 1 ? nick + " sana arkadaşlık isteği gönderdi"
                    : nick + " ve " + (n - 1) + " kişi daha sana arkadaşlık isteği gönderdi";
            Bildirimler.post(c, Bildirimler.CH_FRIENDS, Bildirimler.ID_FRIENDS, R.drawable.ic_stat_friends,
                    NotificationCompat.CATEGORY_SOCIAL, "👥 Arkadaşlık isteği", metin, "arkadaslar.html", bekleyen);
            // En yeni istek zamanı: bir sonraki kontrol yalnız bundan yenilerini sorar (aynı istek iki kez bildirilmez).
            String enYeni = null;
            for (int i = 0; i < n; i++) {
                JSONObject o = yeni.optJSONObject(i);
                String at = o != null ? o.optString("at", null) : null;
                if (at != null && (enYeni == null || Bildirimler.later(at, enYeni))) enYeni = at;
            }
            if (enYeni != null) Bildirimler.saveSon(c, enYeni);
            return out.put("durum", "gosterildi").put("n", n);
        } catch (Exception e) {
            try { out.put("durum", "hata").put("m", String.valueOf(e.getMessage())); } catch (Exception ignored) {}
            return out;
        }
    }

    /** JSON POST; yalnız apikey başlığı (herkese açık anahtar JWT değildir, Bearer olarak gönderilmez). */
    private static String post(String url, String key, String json, int[] code) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        try {
            con.setRequestMethod("POST");
            con.setConnectTimeout(15000);
            con.setReadTimeout(20000);
            con.setDoOutput(true);
            con.setRequestProperty("apikey", key);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("Accept", "application/json");
            byte[] b = json.getBytes(StandardCharsets.UTF_8);
            con.setFixedLengthStreamingMode(b.length);
            try (OutputStream os = con.getOutputStream()) { os.write(b); }
            code[0] = con.getResponseCode();
            InputStream in = code[0] >= 400 ? con.getErrorStream() : con.getInputStream();
            if (in == null) return null;
            try (InputStream is = in) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int r;
                while ((r = is.read(buf)) != -1 && bo.size() < 65536) bo.write(buf, 0, r);
                return bo.toString("UTF-8");
            }
        } finally {
            con.disconnect();
        }
    }

    private static boolean empty(String s) { return s == null || s.trim().isEmpty(); }
}
