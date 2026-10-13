package com.oxford3000.study;

import android.app.Activity;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Uygulama geneli küçük işler. geri(): sayfa onay sorduktan sonra (ör. sınavdan çıkış)
 * geri tuşunun eski davranışını uygular (uygulamadan çık / arka plana al).
 */
@CapacitorPlugin(name = "Uygulama")
public class Uygulama extends Plugin {

    @PluginMethod
    public void geri(PluginCall call) {
        try {
            Activity a = getActivity();
            if (a instanceof MainActivity) ((MainActivity) a).varsayilanGeri();
        } catch (Exception e) {}
        call.resolve();
    }
}
