"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ZoneSeparatorProps {
  className?: string
}

export function ZoneSeparator({ className, color }: ZoneSeparatorProps & { color?: 'blue' | 'green' | 'amber' | 'purple' }) {
  // All walls now use a single color: #B0B0B0
  
  return (
    <div className="relative w-full my-8">
      {/* Wall with standard gray color */}
      <div 
        className="w-full h-10 rounded-md shadow-md"
        style={{ 
          backgroundColor: '#B0B0B0' // Standard wall color for all walls
        }}
      />
      
      {/* Wall label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-3 py-1 bg-indigo-900 text-white text-sm font-bold rounded shadow">WALL</div>
      </div>
    </div>
  )
}