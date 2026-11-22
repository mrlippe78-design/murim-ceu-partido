// Service worker: deixa as regras disponíveis offline.
// HTML: rede primeiro, cache se estiver sem internet. Arquivos estáticos: cache primeiro.
// Chamadas ao Supabase (outro domínio) nunca passam pelo cache.
const VERSAO = 'murim-v1';
const BASE = new URL(self.registration.scope).pathname;
const ESSENCIAIS = ['', 'biblioteca/', 'glossario/', 'ferramentas/', 'ferramentas/dados/', 'ferramentas/tecnica/', 'ferramentas/progresso/', 'ferramentas/modelos/', 'offline/', 'manifest.webmanifest', 'favicon.svg'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// "Baixar a biblioteca para ler offline": a página pede e o SW guarda todas as páginas da lista.
self.addEventListener('message', (e) => {
  if (e.data?.tipo !== 'baixar-biblioteca') return;
  e.waitUntil((async () => {
    const lista = await fetch(BASE + 'biblioteca-offline.json').then((r) => r.json());
    const cache = await caches.open(VERSAO);
    let feitos = 0;
    for (const url of lista) {
      try { await cache.add(url); } catch { /* segue */ }
      feitos++;
      if (feitos % 10 === 0 || feitos === lista.length) e.source?.postMessage({ tipo: 'progresso', feitos, total: lista.length });
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(VERSAO);
        cache.put(req, resp.clone());
        return resp;
      } catch {
        return (await caches.match(req)) || (await caches.match(BASE + 'offline/'));
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const resp = await fetch(req);
    if (resp.ok && /\.(css|js|woff2?|webp|png|svg|json)$/.test(url.pathname)) (await caches.open(VERSAO)).put(req, resp.clone());
    return resp;
  })());
});
