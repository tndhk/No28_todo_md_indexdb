'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    deferredInstallPrompt?: BeforeInstallPromptEvent
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      return
    }

    // Listen for custom event dispatched when prompt is captured
    const handleInstallPromptReady = () => {
      if (window.deferredInstallPrompt) {
        setDeferredPrompt(window.deferredInstallPrompt)
        setTimeout(() => {
          setShowPrompt(true)
        }, 2000)
      }
    }

    // Listen for the beforeinstallprompt event (backup in case early capture didn't work)
    const handler = (e: Event) => {
      e.preventDefault()

      setDeferredPrompt(e as BeforeInstallPromptEvent)
      window.deferredInstallPrompt = e as BeforeInstallPromptEvent

      // Show our custom install prompt after a delay
      setTimeout(() => {
        setShowPrompt(true)
      }, 2000)
    }

    window.addEventListener('install-prompt-ready', handleInstallPromptReady)
    window.addEventListener('beforeinstallprompt', handler)

    // Check if the event was already captured before this component mounted
    // Trigger the event handler if so
    if (window.deferredInstallPrompt) {
      // Trigger via setTimeout to avoid direct setState in effect body
      setTimeout(() => {
        handleInstallPromptReady()
      }, 0)
    }

    return () => {
      window.removeEventListener('install-prompt-ready', handleInstallPromptReady)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    // Show the browser's install prompt
    await deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice

    // Clear the deferredPrompt
    setDeferredPrompt(null)
    setShowPrompt(false)

    // Store dismissal in localStorage
    if (outcome === 'dismissed') {
      localStorage.setItem('pwa-install-dismissed', 'true')
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4"
      style={{
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <Download size={24} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            アプリをインストール
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            ホーム画面に追加して、オフラインでも使えるようになります
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              インストール
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              後で
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
