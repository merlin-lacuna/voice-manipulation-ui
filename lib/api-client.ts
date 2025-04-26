// API client for interacting with the voice manipulation backend

// The base API URL can be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ProcessRequestParams {
  cardName: string;
  zoneName: string;
  laneName: string;
  previousZone?: string;
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
  try {
    // Add timeout to prevent long-hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${API_BASE_URL}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle errors gracefully
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // If JSON parsing fails, use the default error message
        console.error("Failed to parse error response:", e);
      }
      throw new Error(errorMessage);
    }

    const data: ProcessResponse = await response.json();
    
    // Convert relative URLs to absolute
    if (data.audioFile) {
      data.audioFile = `${API_BASE_URL}${data.audioFile}`;
    }
    
    return data;
  } catch (error) {
    console.error('Process Voice API Error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('API request timed out. The server might be overloaded or unreachable.');
      }
      throw error; // Re-throw the original error
    }
    
    // For unknown errors
    throw new Error('An unknown error occurred while processing the voice');
  }
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
    // Add timeout to fetch to fail faster if API is unreachable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_BASE_URL}/`, {
      signal: controller.signal,
      // Prevent caching issues
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('API Status Check Failed:', error);
    // Handle abort errors more gracefully
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('API request timed out');
      } else {
        console.log(`API error: ${error.message}`);
      }
    }
    return false;
  }
}