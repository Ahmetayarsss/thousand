package com.oxford3000.study;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Grup seslendirmesini FOREGROUND SERVICE içinde çalıştırır.
 *
 * Her kelime için önce uygulamaya GÖMÜLÜ Cambridge mp3'ü (assets: public/audio/
 * {slug}.mp3) MediaPlayer ile çalınır; o kelimenin gömülü sesi yoksa cihaz TTS'ine
 * düşülür. Sıra, bekleme (gap) ve döngü ana thread'deki Handler ile yürür. Kalıcı
 * bildirimli servis + wake lock sayesinde ekran kapalıyken/arka planda kesilmez.
 * Her kelime başında GroupTts eklentisine geri bildirim (onWord) yollanır → ekran
 * açıkken JS kartı vurgular.
 */
public class GroupTtsService extends Service {

    public static final String ACTION_START = "com.oxford3000.study.TTS_START";
    public static final String ACTION_STOP = "com.oxford3000.study.TTS_STOP";
    private static final String CHANNEL = "oxford_tts";
    private static final int NOTIF_ID = 4201;

    public interface Progress {
        void onWord(int index);
        void onDone();
    }
    public static volatile Progress progress;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private MediaPlayer player;
    private final List<String> words = new ArrayList<>();
    private final List<String> slugs = new ArrayList<>();
    private volatile boolean loop = false;
    private volatile boolean active = false;
    private volatile int gapMs = 0;
    private float rate = 1.0f;
    private final Handler main = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopEverything();
            return START_NOT_STICKY;
        }
        String[] ws = intent != null ? intent.getStringArrayExtra("words") : null;
        String[] sl = intent != null ? intent.getStringArrayExtra("slugs") : null;
        rate = intent != null ? intent.getFloatExtra("rate", 1.0f) : 1.0f;
        loop = intent != null && intent.getBooleanExtra("loop", false);
        gapMs = intent != null ? Math.max(0, intent.getIntExtra("gap", 0)) : 0;

        main.removeCallbacksAndMessages(null);
        releasePlayer();
        words.clear();
        slugs.clear();
        if (ws != null) for (String w : ws) words.add(w == null ? "" : w);
        if (sl != null) for (String s : sl) slugs.add(s == null ? "" : s);
        active = true;

        startAsForeground();
        acquireLock();

        if (tts == null) {
            tts = new TextToSpeech(getApplicationContext(), status -> {
                ttsReady = (status == TextToSpeech.SUCCESS);
                if (ttsReady) {
                    tts.setLanguage(Locale.US);
                    tts.setOnUtteranceProgressListener(ttsListener);
                }
                // MediaPlayer ana thread'de kurulsun (callback'ler için Looper garantisi).
                main.post(this::startSequence);   // gömülü sesler TTS'siz de çalar; yine de başlat
            });
        } else {
            main.post(this::startSequence);
        }
        return START_STICKY;
    }

    private void startSequence() {
        if (!active || words.isEmpty()) { if (!words.isEmpty()) return; stopEverything(); return; }
        playIndex(0);
    }

    /** i. kelimeyi çal: önce gömülü mp3, yoksa TTS. */
    private void playIndex(int i) {
        if (!active) return;
        if (i < 0 || i >= words.size()) { afterItem(words.size() - 1); return; }
        Progress p = progress;
        if (p != null) p.onWord(i);
        String slug = (i < slugs.size()) ? slugs.get(i) : "";
        if (slug != null && !slug.isEmpty() && playMp3(slug, i)) return;
        speakTts(i < words.size() ? words.get(i) : "", i);
    }

    /** Gömülü mp3'ü assets'ten çal. Başlatabildiyse true. */
    private boolean playMp3(String slug, final int i) {
        AssetFileDescriptor afd;
        try {
            afd = getAssets().openFd("public/audio/" + slug + ".mp3");
        } catch (Exception e) {
            return false;   // bu kelimenin gömülü sesi yok → TTS'e düş
        }
        try {
            releasePlayer();
            final MediaPlayer mp = new MediaPlayer();
            player = mp;
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            final AssetFileDescriptor fafd = afd;
            mp.setOnPreparedListener(m -> {
                try { m.start(); } catch (Exception e) { close(fafd); afterItem(i); }
            });
            mp.setOnCompletionListener(m -> { close(fafd); afterItem(i); });
            mp.setOnErrorListener((m, what, extra) -> { close(fafd); afterItem(i); return true; });
            mp.prepareAsync();
            return true;
        } catch (Exception e) {
            close(afd);
            return false;
        }
    }

    private void speakTts(String word, int i) {
        if (tts == null || !ttsReady) { afterItem(i); return; }
        tts.setSpeechRate(rate);
        Bundle pr = new Bundle();
        pr.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "w" + i);
        try {
            tts.speak(word, TextToSpeech.QUEUE_FLUSH, pr, "w" + i);
        } catch (Exception e) {
            afterItem(i);
        }
    }

    private final UtteranceProgressListener ttsListener = new UtteranceProgressListener() {
        @Override public void onStart(String id) {}
        @Override public void onError(String id) { Integer i = idx(id); if (i != null) afterItem(i); }
        @Override public void onDone(String id) { Integer i = idx(id); if (i != null) afterItem(i); }
    };

    /** i. kelime bitti → gap kadar bekle → sonraki (ya da döngü/bitiş). */
    private void afterItem(final int i) {
        if (!active) return;
        main.postDelayed(() -> {
            if (!active) return;
            int next = i + 1;
            if (next >= words.size()) {
                if (loop) {
                    playIndex(0);
                } else {
                    Progress p = progress;
                    if (p != null) p.onDone();
                    stopEverything();
                }
            } else {
                playIndex(next);
            }
        }, gapMs);
    }

    private Integer idx(String id) {
        if (id == null || !id.startsWith("w")) return null;
        try { return Integer.valueOf(id.substring(1)); } catch (Exception e) { return null; }
    }

    private void close(AssetFileDescriptor afd) {
        try { if (afd != null) afd.close(); } catch (Exception e) {}
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.reset(); player.release(); } catch (Exception e) {}
            player = null;
        }
    }

    private void startAsForeground() {
        Notification n = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            try { startForeground(NOTIF_ID, n); } catch (Exception ignored) {}
        }
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Seslendirme", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent stopIntent = new Intent(this, GroupTtsService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 0, stopIntent, flags);
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPending = openIntent != null
            ? PendingIntent.getActivity(this, 1, openIntent, flags) : null;

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Oxford 3000")
            .setContentText("Grup okunuyor…")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_pause, "Durdur", stopPending);
        if (openPending != null) b.setContentIntent(openPending);
        return b.build();
    }

    private void stopEverything() {
        active = false;
        loop = false;
        main.removeCallbacksAndMessages(null);
        releasePlayer();
        if (tts != null) { try { tts.stop(); } catch (Exception e) {} }
        releaseLock();
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception e) {}
        stopSelf();
    }

    private void acquireLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "oxford3000:tts");
            }
            if (!wakeLock.isHeld()) wakeLock.acquire(3 * 60 * 60 * 1000L);
        } catch (Exception e) {}
    }

    private void releaseLock() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception e) {}
    }

    @Override
    public void onDestroy() {
        active = false;
        loop = false;
        main.removeCallbacksAndMessages(null);
        releasePlayer();
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception e) {}
            tts = null;
        }
        releaseLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
