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
        {metadata.charisma !== undefined && (
          <div>
            <div className="flex justify-between text-sm">
              <span>Charisma</span>
              <span>{metadata.charisma}%</span>
            </div>
            <Progress value={metadata.charisma} className="h-2" />
          </div>
        )}
        
        {metadata.confidence !== undefined && (
          <div>
            <div className="flex justify-between text-sm">
              <span>Confidence</span>
              <span>{metadata.confidence}%</span>
            </div>
            <Progress value={metadata.confidence} className="h-2" />
          </div>
        )}
        
        {metadata.pitch !== undefined && (
          <div>
            <div className="flex justify-between text-sm">
              <span>Pitch</span>
              <span>{metadata.pitch}%</span>
            </div>
            <Progress value={metadata.pitch} className="h-2" />
          </div>
        )}
        
        {metadata.energy !== undefined && (
          <div>
            <div className="flex justify-between text-sm">
              <span>Energy</span>
              <span>{metadata.energy}%</span>
            </div>
            <Progress value={metadata.energy} className="h-2" />
          </div>
        )}
        
        {metadata.language && metadata.language.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Language Emotions</p>
            {metadata.language.map((emotion, index) => (
              <div key={`lang-${index}`} className="mb-1">
                <div className="flex justify-between text-sm">
                  <span>{emotion.name}</span>
                  <span>{Math.round(emotion.score * 100)}%</span>
                </div>
                <Progress value={emotion.score * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
        
        {metadata.prosody && metadata.prosody.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Prosody Emotions</p>
            {metadata.prosody.map((emotion, index) => (
              <div key={`prosody-${index}`} className="mb-1">
                <div className="flex justify-between text-sm">
                  <span>{emotion.name}</span>
                  <span>{Math.round(emotion.score * 100)}%</span>
                </div>
                <Progress value={emotion.score * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Spectrogram</p>
          <div className="bg-gray-100 rounded-md p-2 flex justify-center">
            {/* Debug output to see what URL we're getting */}
            <div className="text-xs text-gray-500 mb-1">
              Debug URL: {metadata.spectrogram}
            </div>
            <img 
              src={metadata.spectrogram} 
              alt="Voice spectrogram" 
              className="h-40 w-full object-contain" 
              loading="lazy"
              onError={(e) => {
                console.log('Spectrogram load error, URL was:', metadata.spectrogram);
                const target = e.target as HTMLImageElement;
                console.log('Error loading spectrogram from:', metadata.spectrogram);
                // Simple fallback for now - log but don't change the image
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}