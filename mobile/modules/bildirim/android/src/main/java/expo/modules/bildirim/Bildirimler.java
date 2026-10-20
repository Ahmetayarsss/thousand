package expo.modules.bildirim;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Eski uygulamadan aynen; değişen yalnız paket. Bildirim yardımcıları — köprü (BildirimModule) ve arka plan işleri ({@link ArkadasWorker}:
 * arkadaşlık isteği + dürtme, {@link HatirlatmaWorker}: seri/tekrar hatırlatması) ortak kullanır:
 * kanallar, bildirim gösterilebilir mi, sessiz saatler (22:00–08:00), dokununca uygulamada bir sayfayı
 * açan bildirim, dokunulan bildirimin hedef sayfası, ayarlar (SharedPreferences) ve ISO zaman karşılaştırma.
 */
public final class Bildirimler {
    private Bildirimler() {}

    /** Bildirime dokununca açılacak sayfa (intent eki), ör. "arkadaslar.html". */
    public static final String EXTRA_TARGET = "oxHedef";
    /** Kanallar ve bildirim kimlikleri (aynı kimlik öncekinin yerine geçer). */
    public static final String CH_FRIENDS = "arkadaslik";   // arkadaşlık istekleri
    public static final String CH_NUDGE = "durtme";         // dürtmeler
    public static final String CH_REMIND = "hatirlatma";    // seri / tekrar hatırlatmaları
    public static final int ID_FRIENDS = 4301, ID_NUDGE = 4302, ID_STREAK = 4311, ID_REVIEW = 4312;
    /** Sessiz saatler: bu aralıkta hiç bildirim yok (arkadaş bildirimleri sabaha kalır). */
    public static final int QUIET_FROM = 22, QUIET_TO = 8;
    /** Ayarlar (url, key, secret, son, bad) değişirken kilit: eklenti ile arka plan işi aynı anda yazmasın. */
    public static final Object LOCK = new Object();

    public static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("ox_bildirim", Context.MODE_PRIVATE);
    }

    // ---------------- kanal / izin / gösterme ----------------

    /** Android 8+: kanal yoksa oluştur (varsa kullanıcının ayarına dokunulmaz). */
    public static void ensureChannel(Context c, String id, String name, String desc, int importance) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(id, name, importance);
            if (desc != null) ch.setDescription(desc);
            nm.createNotificationChannel(ch);
        } catch (Exception e) {}
    }

    public static void ensureFriendsChannel(Context c) {
        ensureChannel(c, CH_FRIENDS, "Arkadaşlık istekleri", "Biri sana arkadaşlık isteği gönderince",
                NotificationManager.IMPORTANCE_DEFAULT);
    }

    public static void ensureNudgeChannel(Context c) {
        ensureChannel(c, CH_NUDGE, "Dürtmeler", "Bir arkadaşın seni dürtünce", NotificationManager.IMPORTANCE_DEFAULT);
    }

    public static void ensureRemindChannel(Context c) {
        ensureChannel(c, CH_REMIND, "Hatırlatmalar", "Seri hatırlatması ve tekrar zamanı", NotificationManager.IMPORTANCE_DEFAULT);
    }

    /** Şu an sessiz saatlerde mi (telefonun yerel saati). */
    public static boolean quiet() {
        return quietAt(Calendar.getInstance().get(Calendar.HOUR_OF_DAY));
    }

    public static boolean quietAt(int hour) {
        return hour >= QUIET_FROM || hour < QUIET_TO;
    }

    /** Bugünün tarihi (yerel) "yyyy-MM-dd" — JS'in hatırlatma günüyle aynı biçim. */
    public static String todayStr() {
        Calendar k = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    /** Uygulama bildirim gösterebilir mi: izin (Android 13+) ve uygulamanın bildirimleri açık mı. */
    public static boolean enabled(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) return false;
            return NotificationManagerCompat.from(c).areNotificationsEnabled();
        } catch (Exception e) { return false; }
    }

    /** {@link #enabled} ve ayrıca kanal kullanıcı tarafından kapatılmamış mı. */
    public static boolean canPost(Context c, String channel) {
        if (!enabled(c)) return false;
        try {
            if (Build.VERSION.SDK_INT >= 26 && channel != null) {
                NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                NotificationChannel ch = nm != null ? nm.getNotificationChannel(channel) : null;
                if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
            }
            return true;
        } catch (Exception e) { return false; }
    }

    /**
     * Bildirim göster. Dokununca uygulama açılır; {@code target} verilmişse o sayfaya geçilir, ör. "arkadaslar.html"
     * ya da "kartlar.html?exam=1" (BildirimPackage → {@link #setTarget} → JS launchTarget(); yeni uygulama sayfa adını
     * ekrana çevirir: src/bildirim.js).
     * Aynı {@code id} öncekinin yerine geçer. {@code text} boşsa yalnız başlık.
     */
    public static void post(Context c, String channel, int id, int icon, String category,
                            String title, String text, String target, int number) {
        try {
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, channel)
                    .setSmallIcon(icon)
                    .setContentTitle(title)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setColor(0xFF3B6EA5);
            if (text != null && !text.isEmpty()) b.setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text));
            if (category != null) b.setCategory(category);
            if (number > 0) b.setNumber(number);
            PendingIntent pi = openIntent(c, id, target);
            if (pi != null) b.setContentIntent(pi);
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException e) {
            // izin tam bu arada geri alındıysa: sessizce geç
        }
    }

    /** Uygulamayı açan PendingIntent (istek kodu = bildirim kimliği: "Listeyi oku"nunkiyle karışmaz). */
    private static PendingIntent openIntent(Context c, int id, String target) {
        Intent li = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (li == null) return null;
        if (target != null) li.putExtra(EXTRA_TARGET, target);
        return PendingIntent.getActivity(c, id, li, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------------- dokunulan bildirimin hedef sayfası ----------------

    private static String target;
    private static long targetAt;

    /** Etkinlik bildirimle açıldı (BildirimPackage): açılacak sayfa. */
    public static synchronized void setTarget(String t) {
        target = t;
        targetAt = SystemClock.elapsedRealtime();
    }

    /** Hedefi bir kez verir ve siler (sayfaya bir kez gidilsin); 2 dk'dan eskiyse yok sayılır. */
    public static synchronized String takeTarget() {
        String t = target;
        target = null;
        if (t == null || SystemClock.elapsedRealtime() - targetAt > 120000) return null;
        return t;
    }

    // ---------------- zaman ----------------

    /** Görülen en yeni istek zamanını sakla (yalnız daha yeniyse). */
    public static void saveSon(Context c, String son) {
        if (isoMicros(son) == Long.MIN_VALUE) return;
        synchronized (LOCK) {
            SharedPreferences sp = prefs(c);
            if (later(son, sp.getString("son", null))) sp.edit().putString("son", son).apply();
        }
    }

    private static final Pattern ISO = Pattern.compile(
            "^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2}):(\\d{2})(?:[.,](\\d{1,9}))?\\s*(Z|[+-]\\d{2}(?::?\\d{2})?)?$");

    /** ISO-8601 zaman (sunucunun "2026-10-12T19:05:03.123456+00:00" biçimi) → epoch mikrosaniye; okunamazsa Long.MIN_VALUE. */
    public static long isoMicros(String s) {
        if (s == null) return Long.MIN_VALUE;
        try {
            Matcher m = ISO.matcher(s.trim());
            if (!m.matches()) return Long.MIN_VALUE;
            Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            cal.clear();
            cal.set(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)) - 1, Integer.parseInt(m.group(3)),
                    Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5)), Integer.parseInt(m.group(6)));
            long us = cal.getTimeInMillis() * 1000L;
            String f = m.group(7);
            if (f != null) us += Long.parseLong((f + "000000").substring(0, 6));
            String z = m.group(8);
            if (z != null && !z.equals("Z")) {
                int sign = z.charAt(0) == '-' ? -1 : 1;
                String d = z.substring(1).replace(":", "");
                long off = Integer.parseInt(d.substring(0, 2)) * 3600L + (d.length() >= 4 ? Integer.parseInt(d.substring(2, 4)) * 60L : 0);
                us -= sign * off * 1000000L;
            }
            return us;
        } catch (Exception e) {
            return Long.MIN_VALUE;
        }
    }

    /** a, b'den sonra mı (b yoksa/okunamıyorsa: a geçerliyse evet). */
    public static boolean later(String a, String b) {
        long x = isoMicros(a);
        return x != Long.MIN_VALUE && x > isoMicros(b);
    }
}
