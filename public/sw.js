// Service Worker for Momentum Task Manager
// Provides offline support and caching strategies

// Cache version will be replaced during build with timestamp
const CACHE_VERSION = 'v1768977567526';
const CACHE_NAME = `momentum-${CACHE_VERSION}`;
const RUNTIME_CACHE = `momentum-runtime-${CACHE_VERSION}`;

// Assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip Supabase API calls - always use network
  if (url.hostname.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Fetch from network in background
      const fetchPromise = fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Update cache with fresh response
          caches.open(RUNTIME_CACHE).then((cache) => {
            // Only cache same-origin requests or fonts
            if (url.origin === location.origin || url.hostname.includes('fonts')) {
              cache.put(request, responseToCache);
            }
          });

          return response;
        })
        .catch(() => {
          // Network failed - if we have cache, it was already returned
          // If not, return error page for navigation
          if (request.mode === 'navigate' && !cachedResponse) {
            return caches.match('/');
          }
          if (!cachedResponse) {
            return new Response('Offline - Network request failed', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
              }),
            });
          }
          // If we have cache, it was already returned above
          return cachedResponse;
        });

      // Stale-While-Revalidate: Return cached response immediately,
      // but also fetch in background to update cache
      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync for offline changes
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-projects') {
    event.waitUntil(
      // Notify all clients that sync is needed
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC',
            tag: event.tag,
          });
        });
      })
    );
  }
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'Task reminder',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [200, 100, 200],
    tag: 'task-notification',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification('Momentum', options)
  );
});

console.log('[SW] Service Worker loaded');
