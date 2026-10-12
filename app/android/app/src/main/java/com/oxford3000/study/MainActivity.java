package com.oxford3000.study;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroupTts.class);   // "Listeyi oku" (foreground servis + medya kontrolleri)
        registerPlugin(Bildirim.class);   // bildirimler (arkadaşlık isteği; uygulama kapalıyken de)
        // Bildirime dokunarak açıldıysa (uygulama kapalıydı): açılacak sayfayı sakla, sayfa launchTarget() ile alır.
        if (savedInstanceState == null) takeTarget(getIntent());
        super.onCreate(savedInstanceState);
        // Bildirim izni (Android 13+) açılışta sorulmaz: hesap açılınca bir kez (hesap.js) ve
        // "Listeyi oku" başlarken (GroupTts) sorulur; Ayarlar → Bildirimler'den de verilebilir.
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        try {
            // Okuma bildirimine dokununca: açık sayfa ana sayfaya geçsin, okunan kelime işaretlensin.
            if (intent != null && intent.getBooleanExtra(GroupTtsService.EXTRA_FROM_TTS, false) && getBridge() != null) {
                getBridge().triggerWindowJSEvent("oxTtsOpen");
            }
            // Arkadaşlık isteği bildirimine dokununca (uygulama açıktı): sayfa hedefi launchTarget() ile alıp geçer.
            if (takeTarget(intent) && getBridge() != null) getBridge().triggerWindowJSEvent("oxHedef");
        } catch (Exception e) {}
    }

    /** Bildirimden gelen hedef sayfa (ör. arkadaslar.html); son uygulamalardan yeniden açılışta yok sayılır. */
    private static boolean takeTarget(Intent i) {
        try {
            if (i == null || (i.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return false;
            String t = i.getStringExtra(Bildirimler.EXTRA_TARGET);
            if (t == null) return false;
            i.removeExtra(Bildirimler.EXTRA_TARGET);
            Bildirimler.setTarget(t);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
