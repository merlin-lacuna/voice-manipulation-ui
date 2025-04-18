"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MetadataItem } from "@/lib/api-client"
import Image from "next/image"

interface MetadataDisplayProps {
  metadata: MetadataItem
  title: string
}

export function MetadataDisplay({ metadata, title }: MetadataDisplayProps) {
  return (
    <Card className="p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm">
            <span>Charisma</span>
            <span>{metadata.charisma}%</span>
          </div>
          <Progress value={metadata.charisma} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm">
            <span>Confidence</span>
            <span>{metadata.confidence}%</span>
          </div>
          <Progress value={metadata.confidence} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm">
            <span>Pitch</span>
            <span>{metadata.pitch}%</span>
          </div>
          <Progress value={metadata.pitch} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm">
            <span>Energy</span>
            <span>{metadata.energy}%</span>
          </div>
          <Progress value={metadata.energy} className="h-2" />
        </div>
        
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Spectrogram</p>
          <div className="bg-gray-100 rounded-md p-2 flex justify-center">
            <img 
              src="/placeholder_spectrogram.png" 
              alt="Voice spectrogram" 
              className="h-24 object-contain" 
            />
          </div>
        </div>
      </div>
    </Card>
  )
}