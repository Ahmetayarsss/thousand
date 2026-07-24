package com.oxford3000.study;

import android.content.Context;
import android.os.Bundle;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Grup seslendirme eklentisi.
 *
 * Tüm kelimeleri Android'in TextToSpeech kuyruğuna (QUEUE_ADD) tek seferde
 * ekler; böylece kelimeler arasında JavaScript'e ihtiyaç kalmaz ve ekran
 * kapalıyken bile kesintisiz okur. Döngü ve "son kelime bitti" mantığı
 * native (Java) UtteranceProgressListener ile yürür — WebView JS donsa bile
 * çalışır. Her kelime başında "wordStart" olayı yollanır; ekran açıkken JS
 * bu olayla okunan kartı vurgular.
 */
@CapacitorPlugin(name = "GroupTts")
public class GroupTts extends Plugin {

    private TextToSpeech tts;
    private final List<String> words = new ArrayList<>();
    private volatile boolean loop = false;
    private volatile boolean active = false;
    private float rate = 1.0f;
    private boolean ready = false;
    private PowerManager.WakeLock wakeLock;

    @PluginMethod
    public void speakGroup(PluginCall call) {
        JSArray arr = call.getArray("words");
        Float r = call.getFloat("rate", 1.0f);
        rate = (r == null ? 1.0f : r);
        loop = Boolean.TRUE.equals(call.getBoolean("loop", false));

        words.clear();
        if (arr != null) {
            try {
                List<Object> list = arr.toList();
                for (Object o : list) {
                    if (o != null) words.add(String.valueOf(o));
                }
            } catch (Exception e) {}
        }
        active = true;
        acquireLock();

        if (tts == null) {
            tts = new TextToSpeech(getContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS) {
                        tts.setLanguage(Locale.US);
                        tts.setOnUtteranceProgressListener(progressListener);
                        ready = true;
                        enqueueAll();
                    }
                }
            });
        } else if (ready) {
            enqueueAll();
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        active = false;
        loop = false;
        if (tts != null) tts.stop();
        releaseLock();
        call.resolve();
    }

    private final UtteranceProgressListener progressListener = new UtteranceProgressListener() {
        @Override
        public void onStart(String utteranceId) {
            Integer idx = parseIdx(utteranceId);
            if (idx != null) {
                JSObject data = new JSObject();
                data.put("index", idx.intValue());
                notifyListeners("wordStart", data);
            }
        }

        @Override
        public void onError(String utteranceId) {}

        @Override
        public void onDone(String utteranceId) {
            Integer idx = parseIdx(utteranceId);
            if (idx != null && idx.intValue() == words.size() - 1) {   // son kelime bitti
                if (active && loop) {
                    enqueueAll();                        // döngü: baştan (native → ekran kapalı güvenli)
                } else {
                    active = false;
                    releaseLock();
                    notifyListeners("done", new JSObject());
                }
            }
        }
    };

    private Integer parseIdx(String id) {
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

    private void acquireLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "oxford3000:grouptts");
            }
            if (!wakeLock.isHeld()) wakeLock.acquire(60 * 60 * 1000L);   // en fazla 1 saat güvenlik sınırı
        } catch (Exception e) {}
    }

    private void releaseLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception e) {}
    }

    @Override
    protected void handleOnDestroy() {
        active = false;
        loop = false;
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception e) {}
            tts = null;
        }
        releaseLock();
    }
}
