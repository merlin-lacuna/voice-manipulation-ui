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
  // List of all voices
  const allVoices = ["Voice 1", "Voice 2", "Voice 3"]
  
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

  // Check if any voice is being processed
  const isProcessingAnyVoice = processingCard.id !== null

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* Circular Progress at the top */}
      <CircularProgress 
        zoneCompletions={zoneCompletions}
        totalVoices={totalVoices}
      />
      
      {/* Voice details - three columns */}
      <Card className="p-4 flex-1 bg-slate-800 border-slate-700 text-white">
        <h3 className="text-lg font-semibold mb-4">Voice Statistics</h3>
        
        <div className="flex flex-row justify-between gap-4">
          {allVoices.map((voice) => {
            const voiceData = getLatestVoiceMetadata(voice)
            const isProcessing = processingCard.id !== null && 
              voice === selectedVoiceCard && isProcessingAnyVoice
            const isHighlighted = voice === selectedVoiceCard
            
            return (
              <div 
                key={voice} 
                className={`rounded-lg p-3 flex-1 ${
                  isHighlighted ? 'ring-2 ring-blue-500' : ''
                } ${
                  voiceData ? 'bg-slate-700' : 'bg-slate-700/50'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-medium">{voice}</h4>
                  {voiceData && (
                    <span className="text-xs text-slate-400">
                      Zone: {voiceData.zone.split(' ')[1]}
                    </span>
                  )}
                </div>
                
                {voiceData ? (
                  <div className="space-y-4">
                    {/* Language section */}
                    <div>
                      <h5 className="text-xs font-semibold mb-2 text-blue-300">Language</h5>
                      {voiceData.metadata.language ? (
                        voiceData.metadata.language.map((emotion, index) => (
                          <div key={`lang-${index}`} className="mb-2">
                            <div className="flex justify-between text-xs">
                              <span>{emotion.name}</span>
                              <span>{Math.round(emotion.score * 100)}%</span>
                            </div>
                            <Progress value={Math.round(emotion.score * 100)} className="h-1.5" />
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 py-2">Could not load language data</div>
                      )}
                    </div>
                    
                    {/* Prosody section */}
                    <div>
                      <h5 className="text-xs font-semibold mb-2 text-green-300">Prosody</h5>
                      {voiceData.metadata.prosody ? (
                        voiceData.metadata.prosody.map((emotion, index) => (
                          <div key={`prosody-${index}`} className="mb-2">
                            <div className="flex justify-between text-xs">
                              <span>{emotion.name}</span>
                              <span>{Math.round(emotion.score * 100)}%</span>
                            </div>
                            <Progress value={Math.round(emotion.score * 100)} className="h-1.5" />
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 py-2">Could not load prosody data</div>
                      )}
                    </div>
                    
                    {/* Spectrogram section */}
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Spectrogram</p>
                      <div className="bg-slate-800 rounded-md p-1 flex justify-center">
                        <Image 
                          src="/placeholder_spectrogram.png" 
                          alt={`${voice} spectrogram`}
                          className="h-24 w-full object-cover"
                          width={150}
                          height={75}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-xs p-2">
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
                        <p>Analyzing voice...</p>
                      </div>
                    ) : (
                      <p className="text-center">No data available. Move this voice to a processing zone.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}