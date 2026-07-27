package com.oxford3000.study;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.content.pm.ServiceInfo;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Grup seslendirmesini FOREGROUND SERVICE içinde çalıştırır.
 *
 * Kalıcı bildirimli servis, ekran kapalıyken/uygulama arkada iken Android
 * tarafından öldürülmez; böylece TTS kesintisiz sürer. Tüm kelimeler Android
 * TTS kuyruğuna (QUEUE_ADD) verilir; döngü ve "son kelime" mantığı native
 * UtteranceProgressListener ile yürür. Her kelime başında GroupTts eklentisine
 * geri bildirim (Progress) yollanır → ekran açıkken JS kartı vurgular.
 */
public class GroupTtsService extends Service {

    public static final String ACTION_START = "com.oxford3000.study.TTS_START";
    public static final String ACTION_STOP = "com.oxford3000.study.TTS_STOP";
    private static final String CHANNEL = "oxford_tts";
    private static final int NOTIF_ID = 4201;

    // Servis → eklenti (kelime olayları / bitiş). Aynı süreçte çalıştığı için statik yeterli.
    public interface Progress {
        void onWord(int index);
        void onDone();
    }
    public static volatile Progress progress;

    private TextToSpeech tts;
    private final List<String> words = new ArrayList<>();
    private volatile boolean loop = false;
    private volatile boolean active = false;
    private float rate = 1.0f;
    private boolean ready = false;
    private final Handler main = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopEverything();
            return START_NOT_STICKY;
        }
        String[] ws = intent != null ? intent.getStringArrayExtra("words") : null;
        rate = intent != null ? intent.getFloatExtra("rate", 1.0f) : 1.0f;
        loop = intent != null && intent.getBooleanExtra("loop", false);
        main.removeCallbacksAndMessages(null);   // önceki turdan kalan döngü post'unu iptal et
        words.clear();
        if (ws != null) {
            for (String w : ws) if (w != null) words.add(w);
        }
        active = true;

        startAsForeground();
        acquireLock();

        if (tts == null) {
            tts = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    tts.setLanguage(Locale.US);
                    tts.setOnUtteranceProgressListener(listener);
                    ready = true;
                    enqueueAll();
                }
            });
        } else if (ready) {
            enqueueAll();
        }
        return START_STICKY;
    }

    private final UtteranceProgressListener listener = new UtteranceProgressListener() {
        @Override
        public void onStart(String utteranceId) {
            Integer i = idx(utteranceId);
            Progress p = progress;
            if (i != null && p != null) p.onWord(i.intValue());
        }

        @Override
        public void onError(String utteranceId) {}

        @Override
        public void onDone(String utteranceId) {
            Integer i = idx(utteranceId);
            if (i != null && i.intValue() == words.size() - 1) {   // son kelime bitti
                if (active && loop) {
                    // Döngü: yeni turu TTS callback'inin İÇİNDEN değil, ana thread'e
                    // post ederek başlat. Motorların çoğu, onDone içinden yapılan
                    // speak() çağrısını sessizce düşürür → döngü bir turdan sonra ölür.
                    main.post(() -> {
                        if (active && loop) enqueueAll();
                    });
                } else {
                    Progress p = progress;
                    if (p != null) p.onDone();
                    stopEverything();
                }
            }
        }
    };

    private Integer idx(String id) {
        if (id == null || !id.startsWith("w")) return null;
        try {
            return Integer.valueOf(id.substring(1));
        } catch (Exception e) {
            return null;
        }
    }

    private void enqueueAll() {
        if (tts == null || words.isEmpty()) return;
        tts.setSpeechRate(rate);
        int n = words.size();
        for (int i = 0; i < n; i++) {
            String id = "w" + i;
            int mode = (i == 0) ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
            Bundle params = new Bundle();
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            tts.speak(words.get(i), mode, params, id);
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
        if (tts != null) {
            try { tts.stop(); } catch (Exception e) {}
        }
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
            if (!wakeLock.isHeld()) wakeLock.acquire(3 * 60 * 60 * 1000L);   // en fazla 3 saat güvenlik
        } catch (Exception e) {}
    }

    private void releaseLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception e) {}
    }

    @Override
    public void onDestroy() {
        active = false;
        loop = false;
        main.removeCallbacksAndMessages(null);
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
