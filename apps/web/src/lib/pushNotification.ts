const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY ?? ''
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied'
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

export async function subscribeToPush(traderId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false

  try {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready

    // VAPID 키 없으면 localStorage만 업데이트 (Phase 0 fallback)
    if (!VAPID_PUBLIC_KEY) {
      localStorage.setItem(`sub_${traderId}`, 'true')
      return true
    }

    // PushSubscription 생성
    const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray.buffer as ArrayBuffer,
    })

    // BE API 전달
    await fetch(`${API_BASE}/api/v1/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderId, deviceToken: JSON.stringify(sub) }),
    })

    localStorage.setItem(`sub_${traderId}`, 'true')
    return true
  } catch {
    return false
  }
}

export async function unsubscribeFromPush(traderId: string): Promise<void> {
  if (typeof window === 'undefined') return

  localStorage.removeItem(`sub_${traderId}`)

  if (!('serviceWorker' in navigator)) return

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await fetch(`${API_BASE}/api/v1/notifications/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traderId, deviceToken: JSON.stringify(sub) }),
      })
    }
  } catch {
    // unsubscribe 실패는 무시
  }
}

export function getStoredSubscription(traderId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(`sub_${traderId}`) === 'true'
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
