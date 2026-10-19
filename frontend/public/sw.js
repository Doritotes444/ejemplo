const CACHE_NAME = 'tiendapp-shell-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // No interceptar llamadas autenticadas de datos API (las gestiona offlineDB en IndexedDB)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/token') || url.pathname.startsWith('/me')) {
    return
  }

  // Estrategia Cache-First con actualización en red para fotografías de productos (/media/) y assets estáticos
  if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return response
          })
          .catch(() => cached)
        return cached || networkFetch
      })
    )
    return
  }

  // Navegación SPA: Network-First con fallback a index.html para soporte offline completo
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
  }
})
