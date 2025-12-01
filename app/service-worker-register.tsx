'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[SW] Service Workers not supported')
      return
    }

    // Register Service Worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        console.log('[SW] Service Worker registered:', registration.scope)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          console.log('[SW] New Service Worker found')

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New Service Worker is available
                console.log('[SW] New content is available; please refresh.')

                // Optionally show a notification to the user
                if (window.confirm('新しいバージョンが利用可能です。更新しますか？')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              }
            })
          }
        })

        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW] Controller changed, reloading page')
          window.location.reload()
        })

        // Check for updates periodically (every hour)
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

      } catch (error) {
        console.error('[SW] Service Worker registration failed:', error)
      }
    }

    // Register on load
    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', registerServiceWorker)
      return () => window.removeEventListener('load', registerServiceWorker)
    }

    // Listen for messages from Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[SW] Message from SW:', event.data)

      if (event.data && event.data.type === 'BACKGROUND_SYNC') {
        // Trigger sync when online
        console.log('[SW] Background sync requested')
        window.dispatchEvent(new CustomEvent('sw-sync-requested'))
      }
    })

  }, [])

  return null
}
