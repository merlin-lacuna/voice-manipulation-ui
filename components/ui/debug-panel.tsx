"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioTestResult, setAudioTestResult] = useState<any>(null)
  const [testingAudio, setTestingAudio] = useState(false)

  const fetchDebugInfo = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/debug`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch debug info: ${response.status}`)
      }
      
      const data = await response.json()
      setDebugInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Debug info fetch error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const testAudioFiles = async () => {
    setTestingAudio(true)
    setAudioTestResult(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/test-audio`)
      
      if (!response.ok) {
        throw new Error(`Failed to test audio files: ${response.status}`)
      }
      
      const data = await response.json()
      setAudioTestResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error testing audio')
      console.error('Audio test error:', err)
    } finally {
      setTestingAudio(false)
    }
  }

  const togglePanel = () => {
    setIsOpen(!isOpen)
    if (!isOpen && !debugInfo) {
      fetchDebugInfo()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={togglePanel}
        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-md text-sm"
      >
        {isOpen ? 'Hide Debug Info' : 'Show Debug Info'}
      </button>
      
      {isOpen && (
        <Card className="p-4 mt-2 w-[500px] max-h-[400px] overflow-auto bg-slate-100 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">API Debug Information</h3>
            <div className="flex space-x-2">
              <button 
                onClick={testAudioFiles}
                className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                disabled={testingAudio}
              >
                {testingAudio ? 'Testing...' : 'Test Audio'}
              </button>
              <button 
                onClick={fetchDebugInfo}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 p-2 rounded mb-2 text-xs">
              {error}
            </div>
          )}
          
          {audioTestResult && (
            <div className="text-xs mb-4 border p-2 bg-blue-50 rounded">
              <h4 className="font-medium mb-1">Audio Files Test Results:</h4>
              <div className="pl-2">
                <p>Voices Directory: {audioTestResult.voices_dir_exists ? '✅ Exists' : '❌ Missing'}</p>
                {audioTestResult.voices_dir_exists && (
                  <p>Contents: {audioTestResult.voices_dir_contents.join(', ')}</p>
                )}
                
                <div className="mt-1">
                  <p className="font-medium">Voice Files:</p>
                  <ul className="pl-2">
                    {Object.entries(audioTestResult.voice_files).map(([name, info]: [string, any]) => (
                      <li key={name}>
                        {name}: {info.exists ? 
                          `✅ Found (${(info.size_bytes / 1024).toFixed(1)}KB)` : 
                          `❌ Not found: ${info.path}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {debugInfo ? (
            <div className="text-xs space-y-2">
              <div>
                <h4 className="font-medium">Voices Directory:</h4>
                <div className="pl-2">
                  <p>Exists: {debugInfo.voices_directory_exists ? 'Yes' : 'No'}</p>
                  <p>Contents: {debugInfo.voices_directory_contents.length > 0 
                    ? debugInfo.voices_directory_contents.join(', ') 
                    : '(empty)'}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium">Voice Files Status:</h4>
                <div className="pl-2">
                  {Object.entries(debugInfo.files_exist).map(([name, exists]) => (
                    <p key={name}>
                      {name}: {exists ? '✅' : '❌'}
                    </p>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium">Temporary Directory:</h4>
                <div className="pl-2">
                  <p>Path: {debugInfo.temp_directory}</p>
                  <p>Contents: {debugInfo.temp_directory_contents.length > 0 
                    ? debugInfo.temp_directory_contents.join(', ') 
                    : '(empty)'}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium">Working Directory:</h4>
                <p className="pl-2">{debugInfo.working_directory}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500 border-opacity-50"></div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Click Refresh to load debug information</p>
          )}
        </Card>
      )}
    </div>
  )
}