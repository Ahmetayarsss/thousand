package com.oxford3000.study;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

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

    @Override
    protected void handleOnDestroy() {
        GroupTtsService.progress = null;
    }
}
