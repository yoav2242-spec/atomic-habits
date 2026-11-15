package com.yoav.atomic;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugin has to be registered before the page loads.
        registerPlugin(AtomicNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
