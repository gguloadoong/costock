const CACHE_NAME = 'costock-v1'
const STATIC_ASSETS = [
  '/',
  '/explore',
  '/market',
  '/my',
  '/icon.svg',
]

// Install: 정적 에셋 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  )
  self.clients.claim()
})

// Push: FCM Web Push 알림 수신
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'CoStock 알림', {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: data.data,
    })
  )
})

// NotificationClick: 알림 클릭 시 해당 URL 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(clients.openWindow(url))
})

// Fetch: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 요청은 캐시하지 않음 (항상 네트워크)
  if (url.pathname.startsWith('/api/')) return

  // WebSocket은 SW가 처리 불가
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답 캐싱
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
