package com.oxford3000.study;

import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Grup seslendirme eklentisi (ince köprü).
 *
 * Asıl iş {@link GroupTtsService} FOREGROUND SERVICE içinde yapılır: kalıcı
 * bildirimli servis ekran kapalıyken / uygulama arkada iken Android tarafından
 * öldürülmez, böylece TTS kesintisiz sürer ve döngü hiç durmaz. Bu eklenti
 * yalnızca servisi başlatır/durdurur ve servisin kelime/bitiş geri bildirimlerini
 * WebView'e ("wordStart" / "done") iletir — ekran açıkken JS okunan kartı vurgular.
 */
@CapacitorPlugin(name = "GroupTts")
public class GroupTts extends Plugin {

    @PluginMethod
    public void speakGroup(PluginCall call) {
        JSArray arr = call.getArray("words");
        Float r = call.getFloat("rate", 1.0f);
        float rate = (r == null ? 1.0f : r);
        boolean loop = Boolean.TRUE.equals(call.getBoolean("loop", false));
        Integer g = call.getInt("gap", 0);
        int gap = (g == null ? 0 : g);

        List<String> words = new ArrayList<>();
        if (arr != null) {
            try {
                List<Object> list = arr.toList();
                for (Object o : list) {
                    if (o != null) words.add(String.valueOf(o));
                }
            } catch (Exception e) {}
        }

        // Servisten gelen geri bildirimleri WebView olaylarına çevir.
        GroupTtsService.progress = new GroupTtsService.Progress() {
            @Override
            public void onWord(int index) {
                JSObject data = new JSObject();
                data.put("index", index);
                notifyListeners("wordStart", data);
            }

            @Override
            public void onDone() {
                notifyListeners("done", new JSObject());
            }
        };

        Intent i = new Intent(getContext(), GroupTtsService.class);
        i.setAction(GroupTtsService.ACTION_START);
        i.putExtra("words", words.toArray(new String[0]));
        i.putExtra("rate", rate);
        i.putExtra("loop", loop);
        i.putExtra("gap", gap);
        if (Build.VERSION.SDK_INT >= 26) {
            getContext().startForegroundService(i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent i = new Intent(getContext(), GroupTtsService.class);
        i.setAction(GroupTtsService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    // ---- Tek kelime: Cambridge'in gerçek insan sesini canlı çek ve çal ----
    // Kelime sayfasını native olarak indirir (CORS yok), US telaffuz mp3'ünü
    // ayıklar ve MediaPlayer ile çalar. Bulamazsa/başarısızsa ok:false döner →
    // JS cihaz TTS'ine düşer. Çözülen URL'ler bellekte önbelleğe alınır.

    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Map<String, String> urlCache = new ConcurrentHashMap<>();
    private MediaPlayer wordPlayer;
    private volatile String lastReason = "";   // teşhis: son başarısızlık nedeni
    private static final Pattern MP3_US = Pattern.compile("(/media/english/us_pron/[^\"'()\\s]+?\\.mp3)");
    private static final Pattern MP3_UK = Pattern.compile("(/media/english/uk_pron/[^\"'()\\s]+?\\.mp3)");
    private static final Pattern MP3_ANY = Pattern.compile("(/media/[^\"'()\\s]+?\\.mp3)");

    @PluginMethod
    public void speakWord(final PluginCall call) {
        final String word = call.getString("word", "");
        if (word == null || word.trim().isEmpty()) {
            JSObject r = new JSObject(); r.put("ok", false); call.resolve(r); return;
        }
        exec.submit(() -> {
            String url = urlCache.get(word.toLowerCase());
            if (url == null) {
                url = resolveCambridge(word);
                if (url != null) urlCache.put(word.toLowerCase(), url);
            }
            if (url == null) {
                JSObject r = new JSObject(); r.put("ok", false); r.put("reason", lastReason);
                call.resolve(r);
                return;
            }
            playUrl(url, call);
        });
    }

    @PluginMethod
    public void stopWord(PluginCall call) {
        releaseWordPlayer();
        call.resolve();
    }

    /** Cambridge kelime sayfasını indirip US (yoksa UK/herhangi) mp3 URL'sini döndürür. */
    private String resolveCambridge(String word) {
        HttpURLConnection c = null;
        try {
            String slug = word.trim().toLowerCase().replace(' ', '-');
            String page = "https://dictionary.cambridge.org/dictionary/english/"
                    + URLEncoder.encode(slug, "UTF-8").replace("%2F", "/");
            c = (HttpURLConnection) new URL(page).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36");
            c.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
            int code = c.getResponseCode();
            if (code != 200) { lastReason = "http:" + code; return null; }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append('\n');
                    if (sb.length() > 1_500_000) break;   // güvenlik sınırı
                }
            }
            String html = sb.toString();
            String path = firstMatch(MP3_US, html);
            if (path == null) path = firstMatch(MP3_UK, html);
            if (path == null) path = firstMatch(MP3_ANY, html);
            if (path == null) { lastReason = "no-audio(" + html.length() + ")"; return null; }
            lastReason = "";
            return "https://dictionary.cambridge.org" + path;
        } catch (Exception e) {
            lastReason = "exc:" + e.getClass().getSimpleName();
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private String firstMatch(Pattern p, String html) {
        Matcher m = p.matcher(html);
        return m.find() ? m.group(1) : null;
    }

    /** URL'yi MediaPlayer ile çal. Hazır olunca ok:true, hata olunca ok:false döner. */
    private void playUrl(String url, final PluginCall call) {
        releaseWordPlayer();
        final AtomicBoolean resolved = new AtomicBoolean(false);
        try {
            final MediaPlayer mp = new MediaPlayer();
            wordPlayer = mp;
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            // Cambridge medya sunucusu Referer/UA olmadan 403 verebilir → başlıkları geç.
            Map<String, String> headers = new HashMap<>();
            headers.put("Referer", "https://dictionary.cambridge.org/");
            headers.put("User-Agent",
                "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36");
            mp.setDataSource(getContext(), Uri.parse(url), headers);
            mp.setOnPreparedListener(m -> {
                m.start();
                if (resolved.compareAndSet(false, true)) {
                    JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
                }
            });
            mp.setOnCompletionListener(m -> {
                notifyListeners("wordAudioDone", new JSObject());
                releaseWordPlayer();
            });
            mp.setOnErrorListener((m, what, extra) -> {
                if (resolved.compareAndSet(false, true)) {
                    JSObject r = new JSObject(); r.put("ok", false);
                    r.put("reason", "play:" + what + "/" + extra);
                    call.resolve(r);
                }
                releaseWordPlayer();
                return true;
            });
            mp.prepareAsync();
        } catch (Exception e) {
            if (resolved.compareAndSet(false, true)) {
                JSObject r = new JSObject(); r.put("ok", false);
                r.put("reason", "playexc:" + e.getClass().getSimpleName());
                call.resolve(r);
            }
            releaseWordPlayer();
        }
    }

    private synchronized void releaseWordPlayer() {
        if (wordPlayer != null) {
            try { wordPlayer.reset(); wordPlayer.release(); } catch (Exception e) {}
            wordPlayer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        GroupTtsService.progress = null;
        releaseWordPlayer();
    }
}
