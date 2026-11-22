package com.elatajoia.corazonfuerte;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* v1.63: complemento local VozDirecta (dictado por voz directo con
           RecognizerIntent). Se registra aquí, antes de crear el puente,
           porque no vive en node_modules: es una clase del propio módulo
           de la app y sobrevive a `npx cap sync` y a las recompilaciones. */
        registerPlugin(VozDirectaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
