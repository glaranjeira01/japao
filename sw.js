/* Service worker do roteiro: deixa o site, as fontes e as fotos disponíveis sem internet. */
const SHELL = "jp-shell-v1";
const MEDIA = "jp-media-v1";
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_FILES.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function isPage(req, url) {
  return req.mode === "navigate" || (url.origin === location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")));
}
function isMedia(url) {
  return /(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$|(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(url.hostname);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Página: tenta a versão nova primeiro; sem internet, usa a salva.
  if (isPage(req, url)) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(req, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) await c.put("index.html", r.clone());
        return r;
      } catch (err) {
        return (await c.match("index.html")) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Fontes, fotos e respostas da Wikipédia: usa o que estiver salvo; senão busca e guarda.
  if (isMedia(url) || url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (isMedia(url) && (r.ok || r.type === "opaque")) {
          const c = await caches.open(MEDIA);
          c.put(req.url, r.clone()).catch(() => {});
        }
        return r;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
