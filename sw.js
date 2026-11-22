/* Corazón Fuerte — service worker
   Permite que Chrome para Android ofrezca «Instalar app» de verdad
   (display standalone) y que la app abra aunque falle la conexión.
   Solo cachea los ficheros propios de la app: nunca intercepta las
   llamadas a Google (Drive, Gemini), que siempre van directas a la red. */
var CACHE = "corazon-fuerte-pwa-v1.68";
var CORE = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./logo-round.png",
  "./logo.webp",
  "./privacidad.html",
  "./condiciones.html"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("./index.html", { ignoreSearch: true });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});

/* ---------- Push (v1.11): avisos de pastillas y de revisión aunque la app esté cerrada ---------- */
self.addEventListener("push", function (event) {
  var data = { title: "Corazón Fuerte", body: "", tag: "corazon-fuerte" };
  try {
    if (event.data) {
      var j = event.data.json();
      if (j.title) data.title = j.title;
      if (j.body) data.body = j.body;
      if (j.tag) data.tag = j.tag;
    }
  } catch (e) { /* sin datos: aviso genérico */ }
  if (!data.body) data.body = "Tienes un aviso de Corazón Fuerte.";
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, tag: data.tag, icon: "./icon-192.png", badge: "./icon-192.png" })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf("index.html") >= 0 || list[i].url.replace(/\/$/, "").indexOf(self.location.origin) === 0) {
          list[i].focus();
          list[i].navigate("./index.html#pastillero");
          return list[i];
        }
      }
      return clients.openWindow("./index.html#pastillero");
    })
  );
});
