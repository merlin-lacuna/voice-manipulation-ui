"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CircularProgress } from "@/components/ui/circular-progress"
import { MetadataItem } from "@/lib/api-client"
import Image from "next/image"
import { Loader2 } from "lucide-react"

interface MasterDetailsSectionProps {
  zoneMetadata: {
    [key: string]: {
      [key: string]: MetadataItem
    }
  }
  zoneCompletions: { [key: string]: number }
  selectedVoiceCard: string | null
  totalVoices: number
  processingCard: { id: string | null, zone: string | null, lane: string | null }
}

export function MasterDetailsSection({ 
  zoneMetadata, 
  zoneCompletions,
  selectedVoiceCard,
  totalVoices,
  processingCard
}: MasterDetailsSectionProps) {
  // Get the voice names from all metadata
  const voiceNames = React.useMemo(() => {
    const names = new Set<string>()
    Object.values(zoneMetadata).forEach(zoneData => {
      Object.keys(zoneData).forEach(name => names.add(name))
    })
    return Array.from(names).slice(0, 3) // Limit to 3 voices
  }, [zoneMetadata])

  // Get the latest metadata for each voice
  const getLatestVoiceMetadata = (voiceName: string) => {
    // Check zones in order from 3 to 1 to get the latest metadata
    for (const zone of ["Zone 3", "Zone 2", "Zone 1"]) {
      if (zoneMetadata[zone]?.[voiceName]) {
        return {
          metadata: zoneMetadata[zone][voiceName],
          zone
        }
      }
    }
    return null
  }

  // If no voice is explicitly selected but we have metadata, select the first voice with metadata
  const effectiveSelectedVoice = selectedVoiceCard || 
    (voiceNames.length > 0 ? voiceNames[0] : null)

  // Get metadata for the selected voice
  const selectedVoiceData = effectiveSelectedVoice ? 
    getLatestVoiceMetadata(effectiveSelectedVoice) : null

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* Circular Progress at the top */}
      <CircularProgress 
        zoneCompletions={zoneCompletions}
        totalVoices={totalVoices}
      />
      
      {/* Voice details */}
      <Card className="p-4 flex-1 bg-slate-800 border-slate-700 text-white">
        <h3 className="text-lg font-semibold mb-4">Voice Details</h3>
        
        {selectedVoiceData ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-medium">{effectiveSelectedVoice}</h4>
              <span className="text-sm text-slate-500">
                Last processed in: {selectedVoiceData.zone}
              </span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm">
                <span>Charisma</span>
                <span>{selectedVoiceData.metadata.charisma}%</span>
              </div>
              <Progress value={selectedVoiceData.metadata.charisma} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm">
                <span>Confidence</span>
                <span>{selectedVoiceData.metadata.confidence}%</span>
              </div>
              <Progress value={selectedVoiceData.metadata.confidence} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm">
                <span>Pitch</span>
                <span>{selectedVoiceData.metadata.pitch}%</span>
              </div>
              <Progress value={selectedVoiceData.metadata.pitch} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm">
                <span>Energy</span>
                <span>{selectedVoiceData.metadata.energy}%</span>
              </div>
              <Progress value={selectedVoiceData.metadata.energy} className="h-2" />
            </div>
            
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Spectrogram</p>
              <div className="bg-slate-700 rounded-md p-2 flex justify-center">
                <img 
                  src="/placeholder_spectrogram.png" 
                  alt="Voice spectrogram" 
                  className="h-32 object-contain" 
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm p-4">
            {processingCard.id ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <p>Analyzing voice...</p>
              </div>
            ) : (
              <p>No voice data available. Move a voice card to a processing zone to see metrics.</p>
            )}
          </div>
        )}
      </Card>
      
      {/* Voice selection buttons */}
      <div className="grid grid-cols-3 gap-2">
        {["Voice 1", "Voice 2", "Voice 3"].map((voice) => {
          const hasData = Object.values(zoneMetadata).some(zone => zone[voice])
          
          return (
            <button
              key={voice}
              className={`p-2 text-sm rounded-md transition-colors ${
                effectiveSelectedVoice === voice 
                  ? 'bg-blue-500 text-white' 
                  : hasData 
                    ? 'bg-slate-600 hover:bg-slate-500 text-white' 
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!hasData}
              onClick={() => hasData && selectedVoiceCard !== voice}
            >
              {voice}
            </button>
          )
        })}
      </div>
    </div>
  )
}