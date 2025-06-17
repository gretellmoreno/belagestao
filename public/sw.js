const CACHE_NAME = 'belagestao-v1';
const OFFLINE_URL = '/offline.html';

// Arquivos para cache inicial
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
  
  // Força o service worker a se tornar ativo
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar controle de todas as abas abertas
      self.clients.claim()
    ])
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições de API
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - retorna a resposta do cache
        if (response) {
          return response;
        }

        // Clone da requisição
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Verifica se recebemos uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone da resposta
            const responseToCache = response.clone();

            // Armazenar no cache
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Se falhar, tentar retornar a página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
}); 