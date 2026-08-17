package com.oxford3000.study;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_NOTIF = 4200;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroupTts.class);   // grup seslendirme (foreground servis + medya kontrolleri)
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
}
