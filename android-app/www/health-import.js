/* Importar la caminata de hoy desde Health Connect (solo app nativa de Play).
   ---------------------------------------------------------------------------
   Plugin: @capgo/capacitor-health (v8, gratis). En Android usa Health Connect,
   que es donde tu app de salud (Zepp, Mi Fitness, Samsung Health, Fitbit...)
   deja los datos cuando está vinculada a Health Connect.
   La app WEB no puede leer estos datos: en web el botón «Importar datos de
   salud» muestra el aviso de «solo en la app de Google Play».

   El reloj NO sabe el BORG: este archivo nunca guarda nada por sí solo.
   Devuelve los datos de la caminata y el formulario pregunta al usuario
   «¿Qué BORG has tenido?» antes de guardar (eso se conecta en la Fase 2).

   Uso (solo nativo, tras cargar www/index.html con este archivo):
     var r = await CorazonSalud.importarCaminataHoy();
     // r.ok === true  -> { fecha, minutos, km, pulsoMedio, pulsoMaximo,
     //                      pulsoReposo, inicio, fin, fuente }
     // r.ok === false -> { codigo, mensaje } para mostrar al usuario.
   Códigos de error: 'no-nativo' | 'sin-health-connect' | 'sin-permiso' |
                      'sin-sesion' | 'error'.
*/
(function(){
  'use strict';

  /* Tipos que se leen para la caminata. Cuando «Mis datos» importe peso,
     sueño, oxígeno y pasos, se añaden aquí 'weight', 'sleep',
     'oxygenSaturation' y 'bloodPressure' (los permisos ya están declarados
     en el manifiesto del plugin, no hay que tocar nada más). */
  var TIPOS_LECTURA = ['workouts', 'heartRate', 'restingHeartRate', 'steps', 'distance'];

  /* Sesiones que cuentan como caminata. */
  var TIPOS_CAMINATA = ['walking', 'hiking'];

  function pluginSalud(){
    try{
      if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health) return window.Capacitor.Plugins.Health;
    }catch(e){}
    return null;
  }

  function esNativo(){
    try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }catch(e){ return false; }
  }

  /* ¿Está disponible el plugin en este móvil? (solo nativo). */
  function saludDisponible(){
    var H = pluginSalud();
    if(!esNativo() || !H) return Promise.resolve({ ok:false, codigo:'no-nativo',
      mensaje:'La importación solo funciona en la app de Google Play, no en la web.' });
    return H.isAvailable().then(function(r){
      if(r && r.available) return { ok:true };
      return { ok:false, codigo:'sin-health-connect',
        mensaje:'Este móvil no tiene Health Connect. En Android 14 o más nuevo ya viene dentro; en versiones anteriores hay que instalar «Health Connect de Android» desde Google Play.' };
    }).catch(function(){
      return { ok:false, codigo:'error', mensaje:'No se ha podido comprobar Health Connect. Inténtalo de nuevo.' };
    });
  }

  /* Comprueba el permiso sin preguntar (no abre ninguna pantalla). */
  function comprobarPermiso(){
    var H = pluginSalud();
    if(!H) return Promise.resolve({ ok:false, codigo:'no-nativo', mensaje:'La importación solo funciona en la app de Google Play.' });
    return H.checkAuthorization({ read: TIPOS_LECTURA }).then(function(r){
      var denegados = (r && r.readDenied) || [];
      return { ok: denegados.length === 0, denegados: denegados };
    }).catch(function(){ return { ok:false, denegados: TIPOS_LECTURA.slice() }; });
  }

  /* Pide el permiso: abre la pantalla de Health Connect. El usuario marca
     qué datos permite (caminatas, pulso...). Si dice que no, no pasa nada:
     la app sigue funcionando y se puede importar a mano. */
  function pedirPermiso(){
    var H = pluginSalud();
    if(!H) return Promise.resolve({ ok:false, codigo:'no-nativo', mensaje:'La importación solo funciona en la app de Google Play.' });
    return H.requestAuthorization({ read: TIPOS_LECTURA }).then(function(r){
      var denegados = (r && r.readDenied) || [];
      if(denegados.length > 0) return { ok:false, codigo:'sin-permiso',
        mensaje:'Falta el permiso para leer los datos de salud. Puedes darlo en Ajustes de Health Connect.' };
      return { ok:true };
    }).catch(function(){
      return { ok:false, codigo:'sin-permiso', mensaje:'No se ha dado el permiso para leer los datos de salud.' };
    });
  }

  /* Abre los ajustes de Health Connect (también sirve para instalarlo si
     falta: desde ahí se llega a Google Play). */
  function abrirAjustesHealthConnect(){
    var H = pluginSalud();
    if(!H) return Promise.resolve(false);
    return H.openHealthConnectSettings().then(function(){ return true; }).catch(function(){ return false; });
  }

  function aISO(d){ return d.toISOString(); }

  /* Lee las muestras de un tipo en un intervalo y devuelve sus valores. */
  function leerMuestras(H, tipo, desde, hasta, limite){
    return H.readSamples({ dataType: tipo, startDate: aISO(desde), endDate: aISO(hasta), limit: limite || 1000 })
      .then(function(r){ return (r && r.samples) || []; })
      .catch(function(){ return []; });
  }

  /* Importa la caminata de hoy.
     opciones: { desde, hasta } en ISO (por defecto: hoy 00:00 -> ahora).
     En la Fase 2, quien llama pasa el inicio del día de la app (diaInicio)
     como «desde», para que «hoy» sea el día de la app y no el del reloj. */
  function importarCaminataHoy(opciones){
    opciones = opciones || {};
    var ahora = new Date();
    var inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
    var desde = opciones.desde ? new Date(opciones.desde) : inicioHoy;
    var hasta = opciones.hasta ? new Date(opciones.hasta) : ahora;

    return saludDisponible().then(function(disp){
      if(!disp.ok) return disp;
      var H = pluginSalud();
      return comprobarPermiso().then(function(perm){
        if(!perm.ok) return pedirPermiso();
        return { ok:true };
      }).then(function(perm){
        if(!perm.ok) return perm;
        /* Última sesión de caminata de hoy (la más reciente). */
        return H.queryWorkouts({ startDate: aISO(desde), endDate: aISO(hasta), limit: 20, ascending: false })
          .then(function(r){
            var sesiones = ((r && r.workouts) || []).filter(function(w){
              return TIPOS_CAMINATA.indexOf(w.workoutType) !== -1;
            });
            if(sesiones.length === 0) return { ok:false, codigo:'sin-sesion',
              mensaje:'Hoy no hay ninguna caminata en tu app de salud. Sincroniza primero tu reloj con tu app de salud y vuelve a pulsar «Importar».' };
            sesiones.sort(function(a, b){ return new Date(b.endDate) - new Date(a.endDate); });
            return { ok:true, sesion: sesiones[0] };
          });
      }).then(function(res){
        if(!res.ok || !res.sesion) return res;
        var s = res.sesion;
        var ini = new Date(s.startDate), fin = new Date(s.endDate);
        var minutos = Math.round((s.duration || 0) / 60);
        /* Distancia: la sesión la trae en metros; si no, se suman las
           muestras de distancia dentro de la sesión. */
        var promDist = (typeof s.totalDistance === 'number' && s.totalDistance > 0)
          ? Promise.resolve(s.totalDistance)
          : leerMuestras(H, 'distance', ini, fin, 500).then(function(ms){
              var t = 0; ms.forEach(function(m){ t += (m.value || 0); }); return t;
            });
        /* Pulso durante la sesión: media y máximo de las muestras. */
        var promPulso = leerMuestras(H, 'heartRate', ini, fin, 2000).then(function(ms){
          var vals = ms.map(function(m){ return m.value; }).filter(function(v){ return typeof v === 'number' && v > 0; });
          if(vals.length === 0) return { medio: null, maximo: null };
          var suma = 0, max = 0; vals.forEach(function(v){ suma += v; if(v > max) max = v; });
          return { medio: Math.round(suma / vals.length), maximo: Math.round(max) };
        });
        /* Pulso en reposo: la última muestra de hoy. */
        var promReposo = leerMuestras(H, 'restingHeartRate', desde, hasta, 50).then(function(ms){
          if(ms.length === 0) return null;
          ms.sort(function(a, b){ return new Date(b.startDate) - new Date(a.startDate); });
          var v = ms[0].value;
          return (typeof v === 'number' && v > 0) ? Math.round(v) : null;
        });
        return Promise.all([promDist, promPulso, promReposo]).then(function(res2){
          var metros = res2[0], pulso = res2[1], reposo = res2[2];
          return { ok:true,
            fecha: ini.getFullYear() + '-' + String(ini.getMonth() + 1).padStart(2, '0') + '-' + String(ini.getDate()).padStart(2, '0'),
            minutos: minutos,
            km: (typeof metros === 'number' && metros > 0) ? Math.round(metros / 10) / 100 : null,
            pulsoMedio: pulso.medio, pulsoMaximo: pulso.maximo, pulsoReposo: reposo,
            inicio: s.startDate, fin: s.endDate,
            fuente: s.sourceName || '' };
        });
      }).catch(function(){
        return { ok:false, codigo:'error', mensaje:'No se han podido leer los datos de salud. Inténtalo de nuevo.' };
      });
    });
  }

  /* API pública: se conecta al botón «Importar datos de salud» en la Fase 2. */
  window.CorazonSalud = {
    disponible: saludDisponible,
    comprobarPermiso: comprobarPermiso,
    pedirPermiso: pedirPermiso,
    abrirAjustesHealthConnect: abrirAjustesHealthConnect,
    importarCaminataHoy: importarCaminataHoy,
    esNativo: esNativo
  };
})();
