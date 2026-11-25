# Corazón Fuerte — proyecto Android (Google Play)

Este es el proyecto Capacitor que se compila para Google Play. La app web
vive en la raíz del repo (los 12 archivos que sirve GitHub Pages); esto de
aquí es solo la envoltura Android.

## Qué hay aquí

- `www/` — la app ya transformada para la versión nativa (v1.66). **No se
  edita a mano**: se genera a partir del `index.html` web de la raíz con el
  script de transformación y se copia aquí tal cual.
- `android/` — el proyecto Android (Gradle 8.14.3, AGP 8.13.0, compileSdk y
  targetSdk 36, minSdk 26, JVM 21). Incluye `MainActivity.java` y el
  complemento local `VozDirectaPlugin.java`.
- `package.json` / `package-lock.json` — dependencias Capacitor 8.6.2
  (`@capacitor/app`, `browser`, `local-notifications`,
  `@capacitor-community/speech-recognition`).
- `capacitor.config.ts` — `appId: com.ambitoweb.corazonfuerte`,
  `webDir: www`.

## Compilación en la nube

La hace GitHub Actions (`.github/workflows/build-android.yml`):

- A mano: Actions → Build Android → Run workflow.
- Sola: al subir cambios a `android-app/` o al propio workflow.
- El resultado son dos artefactos: `corazon-fuerte-apk` (para probar en el
  móvil) y `corazon-fuerte-aab` (para publicar en Play).

La firma release usa solo variables de entorno (`android/app/build.gradle`):
`CF_KEYSTORE_PATH`, `CF_KEYSTORE_PASSWORD`, `CF_KEY_ALIAS`,
`CF_KEY_PASSWORD`. La clave en sí llega como secreto del repo
(`CF_KEYSTORE_BASE64`, el archivo en base64) y se decodifica solo dentro
del runner. Ninguna contraseña ni clave está en este repo.

## Para una versión nueva

1. Sustituir `www/` por la app transformada de la nueva versión (y dejar
   que `npx cap sync android` copie a `android/app/src/main/assets/public/`).
2. **Subir `versionCode` en `android/app/build.gradle`** (hoy es 1): Google
   Play no acepta dos subidas con el mismo `versionCode`. `versionName`
   (`1.0`) se puede subir también si se quiere.
3. Subir los cambios y disparar el workflow.

## Archivos binarios: cómo llegan a la nube

GitHub no admite binarios en la subida por API que usa este proyecto, así que
los binarios llegan por dos vías, y el workflow los junta antes de compilar:

- **Iconos y vídeo de `www/`** (icon-192.png, icon-512.png,
  icon-maskable-512.png, apple-touch-icon.png, logo-round.png, logo.webp,
  tutorial-corazon-fuerte.mp4): NO se publican aquí. Son los mismos archivos
  que ya están en la raíz del repo, y el workflow los copia a `www/` con `cp`
  antes de `cap sync`.
- **Iconos y splashes de `android/app/src/main/res/`** (15 iconos de launcher
  + 11 splash): van en el zip `res-binarios.zip` (aquí, en `android-app/`),
  que se sube por la web de GitHub. El workflow lo descomprime con `unzip`
  en `android/app/src/main/res/` antes de compilar. Si cambia el logo, hay
  que regenerar el zip con los 26 PNG de `res/` (solo PNG, sin los XML).
- **`android/app/src/main/assets/public/`** no se publica: lo regenera
  `npx cap sync android` en cada compilación.
