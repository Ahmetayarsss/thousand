package com.oxford3000.study;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_NOTIF = 4200;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroupTts.class);   // "Listeyi oku" (foreground servis + medya kontrolleri)
        super.onCreate(savedInstanceState);

        // Android 13+ (API 33): bildirim gösterebilmek için çalışma-zamanı izni ŞART.
        // İzin verilmezse foreground servis çalışır ama bildirim (ve düğmeleri) gizlenir.
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{ Manifest.permission.POST_NOTIFICATIONS }, REQ_NOTIF);
                }
            } catch (Exception e) {}
        }
    }

    // Okuma bildirimine dokununca: açık sayfa ana sayfaya geçsin, okunan kelime işaretlensin.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        try {
            if (intent != null && intent.getBooleanExtra(GroupTtsService.EXTRA_FROM_TTS, false) && getBridge() != null) {
                getBridge().triggerWindowJSEvent("oxTtsOpen");
            }
        } catch (Exception e) {}
    }
}
