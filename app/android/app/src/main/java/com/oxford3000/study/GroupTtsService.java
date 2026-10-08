package com.oxford3000.study;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.KeyEvent;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.media.session.MediaButtonReceiver;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * "Listeyi oku" — Spotify tarzı okuma hizmeti (FOREGROUND SERVICE).
 *
 * Her kelime bir "parça" gibi: önce uygulamaya GÖMÜLÜ Cambridge mp3'ü (assets:
 * public/audio/{slug}.mp3) MediaPlayer ile çalınır, yoksa cihaz TTS'i (İngilizce).
 * Ayarda açıksa ardından Türkçe anlamı TTS ile okunur. Liste bitince döngü açıksa
 * baştan başlar, kapalıysa durur.
 *
 * Bildirim + kilit ekranı: MediaStyle + MediaSession. Başlık = kelime, alt satır =
 * Türkçesi, "Liste · 12/30"; görsel = seviye rengi (A1 yeşil, A2 sarı, B1 pembe,
 * B2 mavi). Düğmeler: önceki · duraklat/devam · sonraki · kapat.
 *
 * Süre çubuğu: liste tek bir "parça" gibi. Toplam = listenin bir turunun okuma süresi
 * (gömülü mp3 süreleri ölçülür + bekleme + varsa Türkçe), konum = turda gelinen yer.
 * Çubuk sürüklenince o ana denk gelen kelimeye atlanır.
 *
 * Kulaklık: 1 basış duraklat/devam (kaldığı yerden), 2 basış sonraki, 3 basış önceki;
 * Bluetooth ileri/geri tuşları da çalışır. Kulaklık çıkınca/Bluetooth kopunca durur.
 * Telefon/başka ses → durur; kısa kesintiden sonra kendiliğinden sürer; bildirim
 * sesi gelince kısılır. Duraklatılmışken bildirim kaydırılarak kapatılabilir.
 */
public class GroupTtsService extends Service {

    public static final String ACTION_START = "com.oxford3000.study.TTS_START";
    public static final String ACTION_STOP = "com.oxford3000.study.TTS_STOP";
    public static final String ACTION_TOGGLE = "com.oxford3000.study.TTS_TOGGLE";
    public static final String ACTION_NEXT = "com.oxford3000.study.TTS_NEXT";
    public static final String ACTION_PREV = "com.oxford3000.study.TTS_PREV";
    public static final String EXTRA_FROM_TTS = "fromTts";
    private static final String CUSTOM_CLOSE = "kapat";
    private static final String CHANNEL = "oxford_tts";
    private static final int NOTIF_ID = 4201;
    private static final int CLICK_WINDOW_MS = 450;   // kulaklık çoklu basış penceresi
    private static final int TR_PAUSE_MS = 450;       // İngilizce → Türkçe arası
    private static final Locale TR = new Locale("tr", "TR");

    /** WebView'e geri bildirim (eklenti kurar). Ana thread'den çağrılır. */
    public interface Progress {
        void onWord(int index, String word);
        void onState(boolean active, boolean paused, int index, String word);
        void onDone();
        void onError(String msg);
    }
    public static volatile Progress progress;
    /** Çalışan hizmet (eklenti durum sorgusu / ayar güncellemesi için). */
    public static volatile GroupTtsService instance;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean trOk = false;
    private MediaPlayer player;
    private final List<String> words = new ArrayList<>();
    private final List<String> slugs = new ArrayList<>();
    private final List<String> trs = new ArrayList<>();
    private final List<String> says = new ArrayList<>();
    private final List<String> levels = new ArrayList<>();
    private volatile boolean loop = true;
    private volatile boolean readTr = false;
    private volatile boolean active = false;
    private volatile boolean paused = false;
    private volatile int index = 0;
    private int phase = 0;              // 0 = İngilizce, 1 = Türkçe
    private boolean mpPaused = false;
    private int gapMs = 0;
    private float rate = 1.0f;
    private float volume = 1.0f;
    private boolean resumeOnFocus = false;
    private boolean isForeground = false;
    private int clicks = 0;
    private final Handler seq = new Handler(Looper.getMainLooper());   // okuma sırası / beklemeler
    private final Handler ui = new Handler(Looper.getMainLooper());    // kulaklık çoklu basış
    private PowerManager.WakeLock wakeLock;
    private MediaSessionCompat session;
    private AudioManager am;
    private Object focusReq;   // AudioFocusRequest (API 26+)
    private boolean noisyRegistered = false;
    private final Map<String, Bitmap> artCache = new HashMap<>();

    // ---- Süre çubuğu ----
    private static final long EN_TTS_MS = 900;      // mp3'ü olmayan kelime (cihaz sesi) tahmini
    private static final long EN_GUESS_MS = 1000;   // süresi henüz ölçülmemiş mp3
    private static final long OVERHEAD_MS = 120;    // kelime başına hazırlık payı
    private static final Map<String, Long> DUR = new ConcurrentHashMap<>();   // slug → mp3 süresi (ms; yoksa -1)
    private long[] startMs = new long[0];   // her kelimenin turdaki başlangıç anı (ms)
    private long totalMs = 0;
    private long itemStartedAt = 0;         // SystemClock.elapsedRealtime(): kelimenin başladığı an
    private long pausedAt = 0;
    private volatile int durGen = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    // ================= Komutlar =================

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            // MediaButtonReceiver bizi startForegroundService ile başlatmış olabilir: süre
            // dolmadan startForeground çağrılmazsa Android uygulamayı kapatır.
            if (!active) {
                try { goForeground(buildIdleNotification()); } catch (Exception e) {}
                stopEverything();
                return START_NOT_STICKY;
            }
            boolean wasFg = isForeground;
            if (!wasFg) { try { goForeground(buildNotification()); } catch (Exception e) {} }
            ensureSession();
            if (session != null) MediaButtonReceiver.handleIntent(session, intent);
            if (active && paused) detachForeground();   // duraklatılmışsa kaydırılabilir kalsın
            return START_NOT_STICKY;
        }
        if (ACTION_STOP.equals(action)) { stopEverything(); return START_NOT_STICKY; }
        if (ACTION_TOGGLE.equals(action)) { if (active) { if (paused) resume(); else pause(); } else stopIfIdle(); return START_NOT_STICKY; }
        if (ACTION_NEXT.equals(action)) { if (active) skip(1); else stopIfIdle(); return START_NOT_STICKY; }
        if (ACTION_PREV.equals(action)) { if (active) skip(-1); else stopIfIdle(); return START_NOT_STICKY; }
        if (!ACTION_START.equals(action) || intent == null) {
            if (!active) {
                try { goForeground(buildIdleNotification()); } catch (Exception e) {}
                stopEverything();
            }
            return START_NOT_STICKY;
        }

        // ---- Yeni liste ----
        ensureSession();
        seq.removeCallbacksAndMessages(null);
        releasePlayer();
        stopTts();
        fill(words, intent.getStringArrayExtra("words"));
        fill(slugs, intent.getStringArrayExtra("slugs"));
        fill(trs, intent.getStringArrayExtra("trs"));
        fill(says, intent.getStringArrayExtra("says"));
        fill(levels, intent.getStringArrayExtra("levels"));
        rate = intent.getFloatExtra("rate", 1.0f);
        loop = intent.getBooleanExtra("loop", true);
        readTr = intent.getBooleanExtra("readTr", false);
        gapMs = Math.max(0, intent.getIntExtra("gap", 0));
        int start = intent.getIntExtra("start", 0);
        index = (start >= 0 && start < words.size()) ? start : 0;
        phase = 0;
        mpPaused = false;
        resumeOnFocus = false;
        active = true;
        paused = false;
        itemStartedAt = pausedAt = SystemClock.elapsedRealtime();
        computeTimeline();
        measureDurations();

        updateMetadata();
        setState(true);
        try {
            goForeground(buildNotification());
        } catch (Exception e) {
            err("foreground başlatılamadı: " + e.getClass().getSimpleName());
        }
        checkNotificationsEnabled();
        requestFocus();
        registerNoisy();
        acquireLock();
        emitState();
        withTts(this::startSequence);
        return START_NOT_STICKY;
    }

    // ================= Okuma sırası =================

    private void startSequence() {
        if (!active) return;
        if (words.isEmpty()) { stopEverything(); return; }
        if (readTr && ttsReady && !trOk) err("Telefonda Türkçe ses paketi yok — Türkçe anlamlar okunamıyor.");
        computeTimeline();   // Türkçe ses durumu artık belli
        playIndex(index);
    }

    private void playIndex(int i) {
        if (!active || paused) return;
        if (words.isEmpty()) { stopEverything(); return; }
        if (i < 0) i = 0;
        if (i >= words.size()) { finishOrLoop(); return; }
        index = i;
        phase = 0;
        mpPaused = false;
        itemStartedAt = SystemClock.elapsedRealtime();
        Progress p = progress;
        if (p != null) { try { p.onWord(i, get(words, i)); } catch (Exception e) {} }
        updateMetadata();
        setState(true);      // konum = bu kelimenin başı (çubuk kaymasın diye her kelimede düzeltilir)
        refreshNotification();
        String slug = get(slugs, i);
        if (!slug.isEmpty() && playMp3(slug, i)) return;
        speak(get(words, i), Locale.US, "w" + i);
    }

    private boolean playMp3(String slug, final int i) {
        AssetFileDescriptor afd;
        try {
            afd = getAssets().openFd("public/audio/" + slug + ".mp3");
        } catch (Exception e) {
            return false;
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
                if (player != m) return;
                try { m.setVolume(volume, volume); } catch (Exception e) {}
                if (paused) return;
                try { m.start(); } catch (Exception e) { close(fafd); afterEnglish(i); }
            });
            mp.setOnCompletionListener(m -> { close(fafd); if (player == m) afterEnglish(i); });
            mp.setOnErrorListener((m, what, extra) -> { close(fafd); if (player == m) afterEnglish(i); return true; });
            mp.prepareAsync();
            return true;
        } catch (Exception e) {
            close(afd);
            return false;
        }
    }

    private void speak(String text, Locale loc, String id) {
        if (tts == null || !ttsReady || text == null || text.trim().isEmpty()) { onUtteranceDone(id); return; }
        try {
            tts.setLanguage(loc);
            tts.setSpeechRate(rate);
            Bundle pr = new Bundle();
            pr.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            pr.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            int r = tts.speak(text, TextToSpeech.QUEUE_FLUSH, pr, id);
            if (r != TextToSpeech.SUCCESS) onUtteranceDone(id);
        } catch (Exception e) {
            onUtteranceDone(id);
        }
    }

    private final UtteranceProgressListener ttsListener = new UtteranceProgressListener() {
        @Override public void onStart(String id) {}
        @Override public void onDone(String id) { onUtteranceDone(id); }
        @Override public void onError(String id) { onUtteranceDone(id); }
    };

    /** TTS bitişi (başka thread'den gelebilir) → ana thread'de sıradaki adım. */
    private void onUtteranceDone(final String id) {
        seq.post(() -> {
            if (!active || paused || id == null || id.length() < 2) return;
            int i;
            try { i = Integer.parseInt(id.substring(1)); } catch (Exception e) { return; }
            if (i != index) return;   // eski bir sözce
            if (id.charAt(0) == 'w') afterEnglish(i);
            else afterItem(i);
        });
    }

    private void afterEnglish(final int i) {
        if (!active || paused || i != index) return;
        final String say = get(says, i);
        if (readTr && trOk && !say.isEmpty()) {
            phase = 1;
            seq.postDelayed(() -> {
                if (active && !paused && index == i && phase == 1) speak(say, TR, "t" + i);
            }, TR_PAUSE_MS);
        } else {
            afterItem(i);
        }
    }

    private void afterItem(final int i) {
        if (!active || paused || i != index) return;
        seq.postDelayed(() -> {
            if (!active || paused || index != i) return;
            int next = i + 1;
            if (next >= words.size()) finishOrLoop();
            else playIndex(next);
        }, gapMs);
    }

    private void finishOrLoop() {
        if (loop) { playIndex(0); return; }
        Progress p = progress;
        if (p != null) { try { p.onDone(); } catch (Exception e) {} }
        stopEverything();
    }

    // ================= Kontroller =================

    private void pause() {
        if (!active || paused) return;
        pausedAt = SystemClock.elapsedRealtime();
        paused = true;
        resumeOnFocus = false;
        seq.removeCallbacksAndMessages(null);
        mpPaused = false;
        if (player != null) {
            try { if (player.isPlaying()) { player.pause(); mpPaused = true; } } catch (Exception e) {}
        }
        stopTts();
        setState(false);
        detachForeground();
        refreshNotification();
        emitState();
    }

    private void resume() {
        if (!active || !paused) return;
        itemStartedAt += SystemClock.elapsedRealtime() - pausedAt;   // duraklama süresi sayılmasın
        paused = false;
        resumeOnFocus = false;
        requestFocus();
        setState(true);
        goForegroundSafe();
        emitState();
        if (mpPaused && player != null) {
            try { player.start(); mpPaused = false; return; } catch (Exception e) {}
        }
        mpPaused = false;
        if (phase == 1) {
            final int i = index;
            speak(get(says, i), TR, "t" + i);
            return;
        }
        playIndex(index);
    }

    /** d=+1 sonraki, d=-1 önceki kelime. Duraklatılmışsa da çalmaya başlar (Spotify gibi). */
    private void skip(int d) {
        if (!active || words.isEmpty()) return;
        int n = words.size(), j = index + d;
        if (j >= n) j = loop ? 0 : n - 1;
        if (j < 0) j = loop ? n - 1 : 0;
        seq.removeCallbacksAndMessages(null);
        releasePlayer();
        stopTts();
        if (paused) {
            paused = false;
            resumeOnFocus = false;
            requestFocus();
            setState(true);
            goForegroundSafe();
            emitState();
        }
        playIndex(j);
    }

    /** Çubuk sürüklendi: o ana denk gelen kelimeye geç (duraklatılmışsa duraklatılmış kalır). */
    private void seekTo(long pos) {
        if (!active || startMs.length == 0) return;
        int j = 0;
        for (int k = 0; k < startMs.length; k++) { if (startMs[k] <= pos) j = k; else break; }
        seq.removeCallbacksAndMessages(null);
        releasePlayer();
        stopTts();
        if (paused) {
            index = j;
            phase = 0;
            mpPaused = false;
            itemStartedAt = pausedAt = SystemClock.elapsedRealtime();
            Progress p = progress;
            if (p != null) { try { p.onWord(j, get(words, j)); } catch (Exception e) {} }
            updateMetadata();
            setState(false);
            refreshNotification();
            return;
        }
        playIndex(j);
    }

    // ---- Süre çubuğu hesapları ----
    private void computeTimeline() {
        int n = words.size();
        long[] st = new long[n];
        long t = 0;
        for (int i = 0; i < n; i++) { st[i] = t; t += itemMs(i); }
        startMs = st;
        totalMs = t;
    }

    private long itemMs(int i) {
        float r = Math.max(0.3f, rate);
        String slug = get(slugs, i);
        Long d = slug.isEmpty() ? Long.valueOf(-1) : DUR.get(slug);
        long en = (d == null) ? EN_GUESS_MS : (d > 0 ? d : Math.round(EN_TTS_MS / r));
        long tr = 0;
        if (readTr && trOk) {
            String sy = get(says, i);
            if (!sy.isEmpty()) tr = TR_PAUSE_MS + Math.round((300 + sy.length() * 70) / r);
        }
        return en + OVERHEAD_MS + tr + gapMs;
    }

    private long currentPos() {
        if (index < 0 || index >= startMs.length) return 0;
        long base = startMs[index];
        long end = (index + 1 < startMs.length) ? startMs[index + 1] : totalMs;
        long ref = paused ? pausedAt : SystemClock.elapsedRealtime();
        long el = Math.max(0, ref - itemStartedAt);
        return base + Math.min(el, Math.max(0, end - base - 1));
    }

    /** Gömülü mp3 sürelerini arka planda ölç (bir kez; sonra önbellekten). */
    private void measureDurations() {
        final List<String> todo = new ArrayList<>();
        for (String sl : slugs) if (!sl.isEmpty() && !DUR.containsKey(sl) && !todo.contains(sl)) todo.add(sl);
        if (todo.isEmpty()) return;
        final int gen = ++durGen;
        new Thread(() -> {
            MediaMetadataRetriever mr = new MediaMetadataRetriever();
            try {
                for (String sl : todo) {
                    if (gen != durGen) break;
                    long ms = -1;
                    AssetFileDescriptor afd = null;
                    try {
                        afd = getAssets().openFd("public/audio/" + sl + ".mp3");
                        mr.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                        String v = mr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                        if (v != null) ms = Long.parseLong(v.trim());
                    } catch (Exception e) {
                        ms = -1;
                    } finally {
                        close(afd);
                    }
                    DUR.put(sl, ms);
                }
            } finally {
                try { mr.release(); } catch (Exception e) {}
            }
            seq.post(() -> { if (active && gen == durGen) refreshTimeline(); });
        }, "oxford-sureler").start();
    }

    private void refreshTimeline() {
        computeTimeline();
        updateMetadata();
        setState(!paused);
    }

    private void stopIfIdle() {
        if (!active) stopSelf();
    }

    // ---- Eklentiden çağrılanlar (herhangi bir thread) ----
    public boolean isActiveNow() { return active; }
    public boolean isPausedNow() { return paused; }
    public int currentIndex() { return index; }
    public int total() { try { return words.size(); } catch (Exception e) { return 0; } }
    public String currentWord() { try { return get(words, index); } catch (Exception e) { return ""; } }
    public void requestStop() { seq.post(this::stopEverything); }
    public void applyGap(final int ms) {
        seq.post(() -> { gapMs = Math.max(0, ms); if (active) refreshTimeline(); });
    }
    public void applyOptions(final boolean lp, final boolean rt) {
        seq.post(() -> {
            loop = lp;
            readTr = rt;
            if (rt && ttsReady && !trOk) err("Telefonda Türkçe ses paketi yok — Türkçe anlamlar okunamıyor.");
            if (active) refreshTimeline();
        });
    }

    // ================= MediaSession =================

    private void ensureSession() {
        if (session != null) return;
        try {
            session = new MediaSessionCompat(this, "OxfordTts");
            session.setCallback(sessionCallback);
            PendingIntent open = openPendingIntent();
            if (open != null) session.setSessionActivity(open);
            session.setActive(true);
        } catch (Exception e) {
            session = null;
        }
    }

    private final MediaSessionCompat.Callback sessionCallback = new MediaSessionCompat.Callback() {
        @Override public void onPlay() { resume(); }
        @Override public void onPause() { pause(); }
        @Override public void onStop() { stopEverything(); }
        @Override public void onSkipToNext() { skip(1); }
        @Override public void onSkipToPrevious() { skip(-1); }
        @Override public void onSeekTo(long pos) { seekTo(pos); }
        @Override public void onCustomAction(String action, Bundle extras) {
            if (CUSTOM_CLOSE.equals(action)) stopEverything();
        }
        @Override
        public boolean onMediaButtonEvent(Intent ev) {
            KeyEvent ke = null;
            try { ke = ev != null ? (KeyEvent) ev.getParcelableExtra(Intent.EXTRA_KEY_EVENT) : null; } catch (Exception e) {}
            if (ke != null) {
                int c = ke.getKeyCode();
                // Tek tuşlu kulaklık: basışları say → 1 duraklat/devam, 2 sonraki, 3 önceki.
                if (c == KeyEvent.KEYCODE_HEADSETHOOK || c == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) {
                    if (ke.getAction() == KeyEvent.ACTION_DOWN && ke.getRepeatCount() == 0) {
                        clicks++;
                        ui.removeCallbacks(clickRun);
                        ui.postDelayed(clickRun, CLICK_WINDOW_MS);
                    }
                    return true;
                }
            }
            return super.onMediaButtonEvent(ev);
        }
    };

    private final Runnable clickRun = () -> {
        int n = clicks;
        clicks = 0;
        if (!active) return;
        if (n <= 1) { if (paused) resume(); else pause(); }
        else if (n == 2) skip(1);
        else skip(-1);
    };

    private void setState(boolean playing) {
        if (session == null) return;
        try {
            long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                    | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP
                    | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                    | PlaybackStateCompat.ACTION_SEEK_TO;
            PlaybackStateCompat ps = new PlaybackStateCompat.Builder()
                    .setActions(actions)
                    .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                            currentPos(), playing ? 1.0f : 0f, SystemClock.elapsedRealtime())
                    .addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                            CUSTOM_CLOSE, "Kapat", R.drawable.ic_tts_close).build())
                    .build();
            session.setPlaybackState(ps);
        } catch (Exception e) {}
    }

    /** Başlık = kelime, sanatçı = Türkçesi, albüm = "Liste · 12/30", süre = listenin bir turu. */
    private void updateMetadata() {
        if (session == null || words.isEmpty()) return;
        try {
            int i = index, n = words.size();
            String w = get(words, i), tr = get(trs, i), album = "Liste · " + (i + 1) + "/" + n;
            MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, w)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, tr)
                    .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                    .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, w)
                    .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, tr)
                    .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, album)
                    .putLong(MediaMetadataCompat.METADATA_KEY_TRACK_NUMBER, i + 1)
                    .putLong(MediaMetadataCompat.METADATA_KEY_NUM_TRACKS, n);
            if (totalMs > 0) b.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalMs);
            Bitmap art = artFor(get(levels, i));
            if (art != null) b.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
            session.setMetadata(b.build());
        } catch (Exception e) {}
    }

    /** Seviye rengi görsel (önbellekli): A1 yeşil, A2 sarı, B1 pembe, B2 mavi. */
    private Bitmap artFor(String lv) {
        if (lv == null || lv.isEmpty()) lv = "A1";
        Bitmap cached = artCache.get(lv);
        if (cached != null) return cached;
        try {
            int base;
            switch (lv) {
                case "A2": base = 0xFFC79100; break;
                case "B1": base = 0xFFC2185B; break;
                case "B2": base = 0xFF1565C0; break;
                case "C1": base = 0xFF6A1B9A; break;
                default: base = 0xFF2E7D32;
            }
            int S = 256;
            Bitmap b = Bitmap.createBitmap(S, S, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
            bg.setShader(new LinearGradient(0, 0, S, S, lighten(base, 0.30f), base, Shader.TileMode.CLAMP));
            c.drawRect(0, 0, S, S, bg);
            Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
            t.setColor(Color.WHITE);
            t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            t.setTextAlign(Paint.Align.CENTER);
            t.setTextSize(S * 0.40f);
            Paint.FontMetrics fm = t.getFontMetrics();
            c.drawText(lv, S / 2f, S * 0.47f - (fm.ascent + fm.descent) / 2f, t);
            Paint s = new Paint(Paint.ANTI_ALIAS_FLAG);
            s.setColor(0xD9FFFFFF);
            s.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            s.setTextAlign(Paint.Align.CENTER);
            s.setTextSize(S * 0.075f);
            s.setLetterSpacing(0.18f);
            c.drawText("OXFORD 3000", S / 2f, S * 0.86f, s);
            artCache.put(lv, b);
            return b;
        } catch (Exception e) {
            return null;
        }
    }

    private static int lighten(int c, float f) {
        int r = Color.red(c), g = Color.green(c), b = Color.blue(c);
        return Color.rgb(r + Math.round((255 - r) * f), g + Math.round((255 - g) * f), b + Math.round((255 - b) * f));
    }

    // ================= Ses odağı / kulaklık çıkarma =================

    private void requestFocus() {
        try {
            if (am == null) am = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                if (focusReq == null) {
                    focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_MEDIA)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                            .setOnAudioFocusChangeListener(focusListener)
                            .build();
                }
                am.requestAudioFocus((AudioFocusRequest) focusReq);
            } else {
                am.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
        } catch (Exception e) {}
    }

    private void abandonFocus() {
        try {
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                if (focusReq != null) am.abandonAudioFocusRequest((AudioFocusRequest) focusReq);
            } else {
                am.abandonAudioFocus(focusListener);
            }
        } catch (Exception e) {}
    }

    // Telefon/başka uygulama → dur; kısa kesinti → sonra sür; bildirim sesi → kıs.
    private final AudioManager.OnAudioFocusChangeListener focusListener = f -> {
        if (f == AudioManager.AUDIOFOCUS_LOSS) {
            pause();
        } else if (f == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            boolean was = active && !paused;
            pause();
            resumeOnFocus = was;
        } else if (f == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            setVolume(0.25f);
        } else if (f == AudioManager.AUDIOFOCUS_GAIN) {
            setVolume(1.0f);
            if (resumeOnFocus) resume();
        }
    };

    private void setVolume(float v) {
        volume = v;
        if (player != null) { try { player.setVolume(v, v); } catch (Exception e) {} }
    }

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) pause();
        }
    };

    private void registerNoisy() {
        if (noisyRegistered) return;
        try {
            IntentFilter f = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisyReceiver, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(noisyReceiver, f);
            noisyRegistered = true;
        } catch (Exception e) {}
    }

    private void unregisterNoisy() {
        if (!noisyRegistered) return;
        try { unregisterReceiver(noisyReceiver); } catch (Exception e) {}
        noisyRegistered = false;
    }

    // ================= Bildirim =================

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Seslendirme", NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private PendingIntent servicePendingIntent(String action, int req) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, req, new Intent(this, GroupTtsService.class).setAction(action), flags);
    }

    private PendingIntent openPendingIntent() {
        Intent li = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (li == null) return null;
        li.putExtra(EXTRA_FROM_TTS, true);
        return PendingIntent.getActivity(this, 1, li, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification() {
        ensureChannel();
        int i = index, n = words.size();
        String w = n > 0 ? get(words, i) : "Oxford 3000";
        androidx.media.app.NotificationCompat.MediaStyle style =
                new androidx.media.app.NotificationCompat.MediaStyle().setShowActionsInCompactView(0, 1, 2);
        if (session != null) style.setMediaSession(session.getSessionToken());
        PendingIntent stopPi = servicePendingIntent(ACTION_STOP, 0);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_listen)
                .setContentTitle(w)
                .setContentText(get(trs, i))
                .setOngoing(!paused)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setStyle(style)
                .setDeleteIntent(stopPi)
                .addAction(R.drawable.ic_tts_prev, "Önceki", servicePendingIntent(ACTION_PREV, 3))
                .addAction(paused ? R.drawable.ic_tts_play : R.drawable.ic_tts_pause,
                        paused ? "Devam" : "Duraklat", servicePendingIntent(ACTION_TOGGLE, 2))
                .addAction(R.drawable.ic_tts_next, "Sonraki", servicePendingIntent(ACTION_NEXT, 4))
                .addAction(R.drawable.ic_tts_close, "Kapat", stopPi);
        if (n > 0) b.setSubText("Liste · " + (i + 1) + "/" + n);
        Bitmap art = artFor(get(levels, i));
        if (art != null) b.setLargeIcon(art);
        PendingIntent open = openPendingIntent();
        if (open != null) b.setContentIntent(open);
        return b.build();
    }

    /** Liste yokken (ör. eski bir kulaklık olayı) startForeground şartını karşılamak için. */
    private Notification buildIdleNotification() {
        ensureChannel();
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_listen)
                .setContentTitle("Oxford 3000")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void goForeground(Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIF_ID, n);
        } catch (RuntimeException e) {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n);   // türsüz dene
            else throw e;
        }
        isForeground = true;
    }

    /** Arka planda izin verilmezse çalmaya yine devam eder; bildirim yalnız güncellenir. */
    private void goForegroundSafe() {
        try { goForeground(buildNotification()); } catch (Exception e) { refreshNotification(); }
    }

    /** Duraklatınca: bildirim kalır ama kaydırılarak kapatılabilir. */
    private void detachForeground() {
        if (!isForeground) return;
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_DETACH);
            else stopForeground(false);
        } catch (Exception e) {}
        isForeground = false;
    }

    private void refreshNotification() {
        if (!active) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification());
        } catch (Exception e) {}
    }

    private void checkNotificationsEnabled() {
        try {
            if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
                err("Bildirim KAPALI. Telefon Ayarlar → Uygulamalar → 3000 → Bildirimler'i AÇ.");
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                NotificationChannel ch = nm != null ? nm.getNotificationChannel(CHANNEL) : null;
                if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                    err("Bildirim KAPALI: 'Seslendirme' kategorisi kapalı. Ayarlar → Uygulamalar → 3000 → Bildirimler'den aç.");
                }
            }
        } catch (Exception e) {}
    }

    // ================= Yardımcılar =================

    private void withTts(final Runnable then) {
        if (tts != null) { seq.post(then); return; }
        tts = new TextToSpeech(getApplicationContext(), status -> {
            ttsReady = (status == TextToSpeech.SUCCESS);
            TextToSpeech t = tts;
            if (ttsReady && t != null) {
                try { trOk = t.isLanguageAvailable(TR) >= TextToSpeech.LANG_AVAILABLE; } catch (Exception e) { trOk = false; }
            }
            seq.post(then);
        });
        try { tts.setOnUtteranceProgressListener(ttsListener); } catch (Exception e) {}
    }

    private void stopTts() {
        if (tts != null) { try { tts.stop(); } catch (Exception e) {} }
    }

    private void emitState() {
        Progress p = progress;
        if (p != null) { try { p.onState(active, paused, index, get(words, index)); } catch (Exception e) {} }
    }

    private void err(String m) {
        Progress p = progress;
        if (p != null) { try { p.onError(m); } catch (Exception e) {} }
    }

    private static void fill(List<String> out, String[] in) {
        out.clear();
        if (in != null) for (String s : in) out.add(s == null ? "" : s);
    }

    private static String get(List<String> l, int i) {
        if (l == null || i < 0 || i >= l.size()) return "";
        String s = l.get(i);
        return s == null ? "" : s;
    }

    private void close(AssetFileDescriptor afd) {
        try { if (afd != null) afd.close(); } catch (Exception e) {}
    }

    private void releasePlayer() {
        MediaPlayer p = player;
        player = null;
        if (p != null) {
            try { p.reset(); p.release(); } catch (Exception e) {}
        }
    }

    private void stopEverything() {
        boolean was = active;
        active = false;
        durGen++;   // süren süre ölçümünün sonucu yok sayılsın
        paused = false;
        resumeOnFocus = false;
        seq.removeCallbacksAndMessages(null);
        ui.removeCallbacksAndMessages(null);
        clicks = 0;
        releasePlayer();
        stopTts();
        unregisterNoisy();
        if (session != null) {
            // Kapandıktan sonra kulaklık tuşu bizi yeniden başlatmasın.
            try { session.setMediaButtonReceiver(null); } catch (Exception e) {}
            try { session.setActive(false); session.release(); } catch (Exception e) {}
            session = null;
        }
        abandonFocus();
        releaseLock();
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception e) {}
        isForeground = false;
        try { NotificationManagerCompat.from(this).cancel(NOTIF_ID); } catch (Exception e) {}   // ayrılmış bildirimi de kaldır
        if (was) emitState();
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
        seq.removeCallbacksAndMessages(null);
        ui.removeCallbacksAndMessages(null);
        releasePlayer();
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception e) {}
            tts = null;
        }
        unregisterNoisy();
        if (session != null) { try { session.setActive(false); session.release(); } catch (Exception e) {} session = null; }
        abandonFocus();
        releaseLock();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
