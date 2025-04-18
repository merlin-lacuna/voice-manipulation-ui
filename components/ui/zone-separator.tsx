"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ZoneSeparatorProps {
  className?: string
}

export function ZoneSeparator({ className }: ZoneSeparatorProps) {
  // A simple colored bar that acts as a "wall" between zones
  return (
    <div 
      className={cn(
        "w-full h-2 bg-gradient-to-r from-blue-300 to-blue-500 rounded-full my-8",
        className
      )}
    />
  )
}