'use client'

import { useEffect } from 'react'

// Global variable to store the install prompt event if it fires before React mounts
declare global {
  interface Window {
    deferredInstallPrompt?: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Capture beforeinstallprompt event early (before InstallPrompt component mounts)
    const captureInstallPrompt = (e: Event) => {
      e.preventDefault()
      window.deferredInstallPrompt = e as BeforeInstallPromptEvent
      // Dispatch custom event so InstallPrompt component can listen
      window.dispatchEvent(new CustomEvent('install-prompt-ready'))
    }

    // Listen for install prompt event
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)

    // Register Service Worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New Service Worker is available

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
          window.location.reload()
        })

        // Check for updates immediately on page load
        registration.update()

        // Check for updates periodically (every 10 minutes)
        setInterval(() => {
          registration.update()
        }, 10 * 60 * 1000)

      } catch (error) {
        console.error('[SW] Service Worker registration failed:', error)
      }
    }

    // Register on load
    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', registerServiceWorker)
    }

    // Listen for messages from Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC') {
        // Trigger sync when online
        window.dispatchEvent(new CustomEvent('sw-sync-requested'))
      }
    })

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('load', registerServiceWorker)
    }
  }, [])

  return null
}
