"use client"

import React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Card } from "@/components/ui/card"

interface CircularProgressProps {
  zoneCompletions: { [key: string]: number }
  totalVoices: number
  className?: string
}

export function CircularProgress({ 
  zoneCompletions, 
  totalVoices,
  className 
}: CircularProgressProps) {
  // Transform the data for the pie chart
  const createData = () => {
    const data = []
    
    // Create segment data for each zone
    Object.entries(zoneCompletions).forEach(([zone, count], zoneIndex) => {
      // Special handling for Zone 4 is handled in the zone completion count calculation
      // in app/page.tsx - the count will already reflect if Lane 1 has a card
      
      // Create sub-segments for each voice in the zone
      for (let i = 0; i < totalVoices; i++) {
        // Standard completion check - a segment is complete if its index is less than the count
        const isCompleted = i < count;

        data.push({
          name: `${zone}-Voice-${i + 1}`,
          value: 1, // Each segment has equal value
          zone,
          completed: isCompleted,
          zoneIndex
        })
      }
    })
    
    return data
  }
  
  const data = createData()
  
  // Colors for each zone
  const zoneColors = [
    ["#FCD34D", "#F59E0B", "#D97706"], // Zone 1 - Amber
    ["#6EE7B7", "#10B981", "#059669"], // Zone 2 - Green
    ["#93C5FD", "#3B82F6", "#2563EB"], // Zone 3 - Blue
    ["#C4B5FD", "#8B5CF6", "#7C3AED"], // Zone 4 - Purple
  ]
  
  // Gray for empty/incomplete segments
  const grayColor = "#475569" // slate-600
  
  // Calculate total completion
  const totalComplete = Object.values(zoneCompletions).reduce((sum, count) => sum + count, 0)
  const totalPossible = Object.keys(zoneCompletions).length * totalVoices
  
  return (
    <Card className="p-2.5 flex flex-col items-center bg-[#322b98] border-indigo-900 text-white">
      <div className="text-lg font-medium mb-1">Progress</div>
      <div className="h-56 w-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              startAngle={90}
              endAngle={450}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => {
                // Choose color based on zone and completion
                let fillColor = grayColor
                if (entry.completed && entry.zoneIndex >= 0) {
                  const zoneColorSet = zoneColors[entry.zoneIndex]
                  // Use different shades based on voice order within zone
                  const voiceIndex = parseInt(entry.name.split('-').pop() || "1") - 1
                  fillColor = zoneColorSet[Math.min(voiceIndex, zoneColorSet.length - 1)]
                }
                
                return <Cell key={`cell-${index}`} fill={fillColor} />
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center bg-indigo-950 rounded-full w-24 h-24 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold">{totalComplete}/{totalPossible}</div>
            <div className="text-xs text-slate-400">Voices</div>
          </div>
        </div>
      </div>
    </Card>
  )
}