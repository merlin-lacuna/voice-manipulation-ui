// API client for interacting with the voice manipulation backend

// The base API URL can be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ProcessRequestParams {
  cardName: string;
  zoneName: string;
  laneName: string;
}

interface ProcessResponse {
  message: string;
  status: string;
  processingTime: number;
}

/**
 * Process a voice card by sending a request to the backend API
 */
export async function processVoice(params: ProcessRequestParams): Promise<string> {
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
  return data.message;
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