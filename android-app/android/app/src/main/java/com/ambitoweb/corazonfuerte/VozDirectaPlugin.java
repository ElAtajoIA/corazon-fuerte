package com.ambitoweb.corazonfuerte;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/* VozDirecta (v1.63, solo nativa) — dictado por voz sin pasar por
   el chequeo de disponibilidad del complemento de la comunidad: en el
   Poco X3 ese chequeo devuelve falso aunque el móvil sí tiene
   reconocimiento de voz (el micrófono, Hey Google y la búsqueda por voz
   funcionan). Por eso el complemento @capacitor-community/speech-recognition
   nunca podía funcionar ahí: su available() y su start() se niegan con
   ese falso.

   Este complemento local lanza directamente
   RecognizerIntent.ACTION_RECOGNIZE_SPEECH, que atiende la app de Google
   y devuelve el texto. No pide permiso de micrófono: la ventana de voz
   corre en la actividad de Google, que ya tiene el suyo. */
@CapacitorPlugin(name = "VozDirecta")
public class VozDirectaPlugin extends Plugin {

    @PluginMethod
    public void escuchar(PluginCall call) {
        String language = call.getString("language", "es-ES");
        String prompt = call.getString("prompt", null);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, bridge.getActivity().getPackageName());
        if (prompt != null) {
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        }
        try {
            startActivityForResult(call, intent, "escucharResult");
        } catch (ActivityNotFoundException e) {
            call.reject("no disponible");
        }
    }

    @ActivityCallback
    private void escucharResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() == Activity.RESULT_OK) {
            try {
                ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String texto = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                JSObject ret = new JSObject();
                ret.put("texto", texto);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject(ex.getMessage());
            }
        } else if (result.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("cancelado");
        } else {
            call.reject(Integer.toString(result.getResultCode()));
        }
    }
}
