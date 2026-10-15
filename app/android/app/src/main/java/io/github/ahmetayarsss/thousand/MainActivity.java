package io.github.ahmetayarsss.thousand;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private OnBackPressedCallback geriCb;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroupTts.class);   // "Listeyi oku" (foreground servis + medya kontrolleri)
        registerPlugin(Bildirim.class);   // bildirimler (arkadaşlık isteği; uygulama kapalıyken de)
        registerPlugin(Uygulama.class);   // geri tuşu: sayfa onay sorduktan sonra eski davranış
        // Bildirime dokunarak açıldıysa (uygulama kapalıydı): açılacak sayfayı sakla, sayfa launchTarget() ile alır.
        if (savedInstanceState == null) takeTarget(getIntent());
        super.onCreate(savedInstanceState);
        // Geri tuşu: önce sayfaya sorulur (window.oxGeri). Sayfa "x" derse kendisi ele alır (ör. sınav
        // sürerken "Emin misin?" sorar, onaylanırsa Uygulama.geri() çağırır); yoksa eski davranış sürer.
        geriCb = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    if (getBridge() == null) { varsayilanGeri(); return; }
                    getBridge().eval("(window.oxGeri&&window.oxGeri())||''", v -> {
                        if (!"\"x\"".equals(v)) varsayilanGeri();
                    });
                } catch (Exception e) {
                    varsayilanGeri();
                }
            }
        };
        getOnBackPressedDispatcher().addCallback(this, geriCb);
        // Bildirim izni (Android 13+) açılışta sorulmaz: hesap açılınca bir kez (hesap.js) ve
        // "Listeyi oku" başlarken (GroupTts) sorulur; Ayarlar → Bildirimler'den de verilebilir.
    }

    /** Geri tuşunun eski davranışı: uygulamadan çık / arka plana al (Android'in kendi işlemi). */
    public void varsayilanGeri() {
        runOnUiThread(() -> {
            try {
                if (geriCb != null) geriCb.setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            } catch (Exception e) {
                try { moveTaskToBack(true); } catch (Exception ignored) {}
            } finally {
                if (geriCb != null) geriCb.setEnabled(true);
            }
        });
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
