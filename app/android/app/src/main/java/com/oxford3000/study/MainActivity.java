package com.oxford3000.study;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroupTts.class);   // grup seslendirme (native TTS kuyruğu + döngü)
        super.onCreate(savedInstanceState);
    }
}
