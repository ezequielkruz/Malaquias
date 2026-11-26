const CACHE_NAME = 'gestor-financeiro-v3-10-offline-v3';

// Preenchido automaticamente no build do Vite (dist/sw.js) com todos os JS/CSS em /assets/*
const BUILD_ASSETS = [];

const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

async function matchFromCache(request, url) {
  const cache = await caches.open(CACHE_NAME);
  return (
    (await cache.match(request, { ignoreVary: true })) ||
    (await cache.match(url.pathname, { ignoreVary: true })) ||
    (await caches.match(request, { ignoreVary: true }))
  );
}

async function discoverHtmlAssets(cache) {
  try {
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (!res || !res.ok) return [];
    const html = await res.text();
    const headers = new Headers(res.headers);
    await Promise.all([
      cache.put(
        '/index.html',
        new Response(html, { status: res.status, statusText: res.statusText, headers }),
      ),
      cache.put(
        '/',
        new Response(html, { status: res.status, statusText: res.statusText, headers }),
      ),
    ]);

    const matches = html.match(/\/assets\/[^"'\s<>)]+/g) || [];
    return Array.from(new Set(matches));
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const htmlAssets = await discoverHtmlAssets(cache);
      const urlsToPrecache = Array.from(
        new Set([...CORE_SHELL_URLS, ...BUILD_ASSETS, ...htmlAssets]),
      );

      await Promise.allSettled(
        urlsToPrecache.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch {
            // Ignora falhas individuais para não impedir a instalação do SW
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFontsCss = url.origin === 'https://fonts.googleapis.com';
  const isGoogleFontsAsset = url.origin === 'https://fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFontsCss && !isGoogleFontsAsset) return;

  // Não intercepta endpoints internos do Vite dev server
  if (
    isSameOrigin &&
    (url.pathname.startsWith('/@vite') ||
      url.pathname.startsWith('/@react-refresh') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.startsWith('/src/'))
  ) {
    return;
  }

  // Navegação (HTML / rotas SPA): Network-First com fallback para index.html em cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copyForIndex = response.clone();
            const copyForRoot = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', copyForIndex);
              cache.put('/', copyForRoot);
            });
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex =
            (await cache.match('/index.html', { ignoreVary: true })) ||
            (await cache.match('/', { ignoreVary: true })) ||
            (await caches.match('/index.html', { ignoreVary: true }));
          if (cachedIndex) return cachedIndex;
          return new Response('Aplicação indisponível offline no momento.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }),
    );
    return;
  }

  // Arquivos estáticos compilados (/assets/*) e Google Fonts: Cache-First com ignoreVary
  if ((isSameOrigin && url.pathname.startsWith('/assets/')) || isGoogleFontsCss || isGoogleFontsAsset) {
    event.respondWith(
      (async () => {
        const cached = await matchFromCache(request, url);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(isSameOrigin ? url.pathname : request, copy);
          }
          return response;
        } catch {
          if (isGoogleFontsCss) {
            return new Response('/* offline font fallback */', {
              status: 200,
              headers: { 'Content-Type': 'text/css; charset=utf-8' },
            });
          }
          return new Response('', { status: 204 });
        }
      })(),
    );
    return;
  }

  // Demais recursos locais (manifest.json, ícones, etc.): Network-First com fallback automático para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await matchFromCache(request, url);
        return cached || new Response('', { status: 204 });
      }),
  );
});
