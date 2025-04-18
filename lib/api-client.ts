// API client for interacting with the voice manipulation backend

// The base API URL can be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ProcessRequestParams {
  cardName: string;
  zoneName: string;
  laneName: string;
}

export interface MetadataItem {
  charisma: number;
  confidence: number;
  pitch: number;
  energy: number;
  spectrogram: string;
}

export interface ProcessResponse {
  message: string;
  status: string;
  processingTime: number;
  audioFile?: string;
  metadata?: MetadataItem;
}

/**
 * Process a voice card by sending a request to the backend API
 */
export async function processVoice(params: ProcessRequestParams): Promise<ProcessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    // Handle errors gracefully
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API request failed with status ${response.status}`);
  }

  const data: ProcessResponse = await response.json();
  
  // Convert relative URLs to absolute
  if (data.audioFile) {
    data.audioFile = `${API_BASE_URL}${data.audioFile}`;
  }
  
  return data;
}

/**
 * Play an audio file
 */
export async function playAudio(url: string): Promise<void> {
  console.log('Playing audio from URL:', url);
  
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    
    audio.onended = () => {
      console.log('Audio playback completed');
      resolve();
    };
    
    audio.onloadeddata = () => {
      console.log('Audio loaded successfully');
    };
    
    audio.onerror = (error) => {
      console.error('Audio error:', error);
      console.error('Error code:', audio.error?.code);
      console.error('Error message:', audio.error?.message);
      reject(new Error(`Failed to play audio: ${audio.error?.message || 'Unknown error'}`));
    };
    
    audio.play()
      .then(() => console.log('Audio playback started'))
      .catch(error => {
        console.error('Failed to start audio playback:', error);
        reject(error);
      });
  });
}

/**
 * Get a list of supported operations from the API
 */
export async function getOperations() {
  const response = await fetch(`${API_BASE_URL}/api/operations`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch operations: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Check if the API is available
 */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    return response.ok;
  } catch (error) {
    console.error('API Status Check Failed:', error);
    return false;
  }
}