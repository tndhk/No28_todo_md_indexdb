'use client'

/* eslint-disable react-hooks/set-state-in-effect */
import { useOnlineStatus } from '@/lib/hooks'
import { WifiOff, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const [showOnlineMessage, setShowOnlineMessage] = useState(false)
  const [hasBeenOffline, setHasBeenOffline] = useState(false)

  // Track when user goes offline
  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true)
    }
  }, [isOnline])

  // Show temporary message when coming back online
  useEffect(() => {
    if (isOnline && hasBeenOffline) {
      setShowOnlineMessage(true)
      const timer = setTimeout(() => {
        setShowOnlineMessage(false)
        setHasBeenOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, hasBeenOffline])

  // Don't show anything when online (unless showing reconnect message)
  if (isOnline && !showOnlineMessage) {
    return null
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium transition-all ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-orange-500 text-white'
      }`}
      style={{
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <Wifi size={16} />
            <span>オンラインに戻りました - 同期中...</span>
          </>
        ) : (
          <>
            <WifiOff size={16} />
            <span>オフラインモード - 変更はローカルに保存されます</span>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
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
