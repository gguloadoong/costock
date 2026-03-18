'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // SW 등록 실패 — 앱 기능에 영향 없음
        })
    }
  }, [])
  return null
}
