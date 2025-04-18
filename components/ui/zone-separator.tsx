"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ZoneSeparatorProps {
  className?: string
}

export function ZoneSeparator({ className, color }: ZoneSeparatorProps & { color?: 'blue' | 'green' | 'amber' | 'purple' }) {
  // A colored bar that acts as a "wall" between zones
  const getGradient = () => {
    switch (color) {
      case 'blue': return 'linear-gradient(to right, rgba(147, 197, 253, 0.7), rgba(59, 130, 246, 0.7))';
      case 'green': return 'linear-gradient(to right, rgba(134, 239, 172, 0.7), rgba(34, 197, 94, 0.7))';
      case 'amber': return 'linear-gradient(to right, rgba(252, 211, 77, 0.7), rgba(245, 158, 11, 0.7))';
      case 'purple': return 'linear-gradient(to right, rgba(192, 132, 252, 0.7), rgba(139, 92, 246, 0.7))';
      default: return 'linear-gradient(to right, rgba(147, 197, 253, 0.7), rgba(59, 130, 246, 0.7))';
    }
  };
  
  return (
    <div className="relative w-full my-8">
      {/* Wall with medium gray background and colored gradient */}
      <div 
        className="w-full h-10 rounded-md shadow-md"
        style={{ 
          backgroundColor: '#6B7280', // Tailwind gray-500
          backgroundImage: getGradient()
        }}
      />
      
      {/* Wall label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-3 py-1 bg-indigo-900 text-white text-sm font-bold rounded shadow">WALL</div>
      </div>
    </div>
  )
}