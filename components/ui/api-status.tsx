"use client"

import { useState, useEffect } from "react"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { checkApiStatus } from "@/lib/api-client"

interface ApiStatusProps {
  className?: string
  refreshInterval?: number
}

export function ApiStatus({ className, refreshInterval = 10000 }: ApiStatusProps) {
  const [status, setStatus] = useState<boolean | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isAvailable = await checkApiStatus()
        setStatus(isAvailable)
        setLastChecked(new Date())
      } catch (error) {
        setStatus(false)
        setLastChecked(new Date())
        console.error("API Status check failed:", error)
      }
    }

    // Check immediately
    checkStatus()

    // Set up periodic checking
    const interval = setInterval(checkStatus, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1 text-sm rounded-full transition-colors",
        status === true ? "bg-green-50 text-green-700" : 
        status === false ? "bg-red-50 text-red-700" : 
        "bg-gray-50 text-gray-500",
        className
      )}
    >
      {status === true && (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>API Online</span>
        </>
      )}
      {status === false && (
        <>
          <XCircle className="h-4 w-4 text-red-500" />
          <span>API Offline</span>
        </>
      )}
      {status === null && (
        <>
          <AlertCircle className="h-4 w-4 text-gray-400 animate-pulse" />
          <span>Checking API...</span>
        </>
      )}
    </div>
  )
}