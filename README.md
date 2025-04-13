# Voice Manipulation UI

A drag-and-drop interface for manipulating voice samples with a pipeline-based processing workflow.

## Technical Overview

This application provides a visual interface for audio processing where voice samples can be manipulated by moving them through various processing zones. The frontend is built with Next.js, TypeScript, and TailwindCSS, using a card-based drag-and-drop system powered by [@hello-pangea/dnd](https://github.com/hello-pangea/dnd).

## Architecture

The application follows a client-server architecture:

- **Frontend**: React/Next.js application handling UI interactions and API calls
- **Backend**: Expected to be a Python service (not yet implemented) that processes audio samples

## Core Components

### Drag and Drop System

The core interaction uses `@hello-pangea/dnd` with three main components:
- `DragDropContext`: Wraps the entire draggable area
- `Droppable`: Defines drop zones (holding area and processing zones)
- `Draggable`: Represents voice sample cards that users can move between zones

### Card System

Voice sample cards have the following properties:
- `id`: Unique identifier (e.g., "voice-a")
- `content`: Display name (e.g., "Voice A")
- `zone`: Current location (e.g., "holding", "Zone 1")
- `lane`: Position within zone (e.g., "Lane 1")

### Workflow Zones

The UI contains six zones:
1. **Holding Zone**: Initial storage for voice samples
2. **Zone 1-5**: Processing zones, each with 5 lanes

## API Integration

### Architecture Overview

The application uses a client-server architecture:
- **Frontend**: Next.js React application that provides the drag-and-drop interface
- **Backend**: Python FastAPI application that processes voice operations

The communication flow is:
1. User drags a voice card to a processing zone
2. Frontend validates the move
3. Frontend sends API request to the Python backend
4. Backend processes the request and returns a response
5. Frontend updates UI based on the response

### Backend Implementation

The Python backend is built with FastAPI and runs in a virtual environment:

```python
# Core API endpoint in api/main.py
@app.post("/api/process", response_model=VoiceProcessResponse)
async def process_voice(request: VoiceProcessRequest):
    # Simulate processing delay
    start_time = time.time()
    time.sleep(2)  # Simulating processing time
    
    # Determine the operation type based on zone
    operation = ZONE_OPERATIONS.get(request.zoneName, "unknown")
    
    # Generate response message based on zone
    if request.zoneName == "Zone 1":
        message = f"{request.cardName} has been initialized in {request.laneName} of {request.zoneName}. Processing has begun."
    # ... other zone handlers
    
    return {
        "message": message,
        "status": "success",
        "processingTime": time.time() - start_time,
    }
```

### Frontend API Client

The frontend uses a dedicated API client to communicate with the backend:

```typescript
// API client in lib/api-client.ts
export async function processVoice(params: ProcessRequestParams): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API request failed with status ${response.status}`);
  }

  const data: ProcessResponse = await response.json();
  return data.message;
}
```

### API Endpoints

The Python backend provides these endpoints:

1. `POST /api/process` - Main endpoint for voice processing operations
   - **Request body**:
     ```json
     {
       "cardName": "Voice A",
       "zoneName": "Zone 1",
       "laneName": "Lane 1"
     }
     ```
   - **Response**:
     ```json
     {
       "message": "Voice A has been initialized in Lane 1 of Zone 1. Processing has begun.",
       "status": "success",
       "processingTime": 2.0051
     }
     ```

2. `GET /api/operations` - Returns information about supported operations
   - Lists all available voice processing operations by zone

3. `GET /` - API status check endpoint
   - Used by the frontend to monitor API availability

### Processing Zones & Operations

Each zone in the UI triggers a different type of voice processing operation:

| Zone    | Operation Type       | Description                      |
|---------|----------------------|----------------------------------|
| Zone 1  | `initialization`     | Preparing voice sample           |
| Zone 2  | `feature_extraction` | Extracting audio features        |
| Zone 3  | `transformation`     | Transforming voice qualities     |
| Zone 4  | `enhancement`        | Enhancing audio characteristics  |
| Zone 5  | `finalization`       | Finalizing the processed audio   |

### API Trigger Points

API calls are triggered when:
1. A card is dragged from one zone to another
2. The move is determined to be valid (must be to an adjacent zone)

The API is NOT called when:
- A card is moved within the same zone
- A card is moved back to the holding zone
- The drag operation is invalid (e.g., trying to skip zones)

### UI Feedback During API Operations

The frontend provides several types of feedback during API calls:

1. **Card State**: Cards show a loading spinner overlay while being processed
2. **Zone Highlighting**: The destination zone briefly glows when receiving a card
3. **Status Messages**: API response messages are displayed at the top of the UI
4. **API Status Indicator**: An indicator in the header shows API availability

### Error Handling

The API client includes error handling for failed API calls:

```typescript
processVoice({...}).then(message => {
  // Success handling
}).catch(error => {
  // Error displayed to user
  setApiMessage(`Error: ${error.message}`)
  // Reset card processing state
  setProcessingCard({ id: null, zone: null, lane: null })
})
```

## UI State Management

During API operations, the UI provides visual feedback:
- Cards show a loading spinner overlay
- The destination zone briefly glows
- Success/failure messages from the API are displayed

## Development

### Prerequisites
- Node.js 18+
- Python 3.9+ (for the API)
- pnpm (preferred) or npm

### Quick Start (Both Frontend and Backend)
```bash
# On macOS/Linux:
./start-all.sh

# On Windows:
start-all.bat
```

This will:
1. Start the Python API with a virtual environment
2. Start the Next.js frontend
3. Open both services on their respective ports

### Frontend Setup (Manual)
```bash
# Install dependencies
pnpm install  # or: npm install

# Start development server
pnpm dev  # or: npm run dev
```

### Backend Setup (Manual)
```bash
# Navigate to API directory
cd api

# Create and activate a virtual environment
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start API server manually
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Alternatively, use the startup script which handles the virtual environment
# On macOS/Linux:
./start.sh
# On Windows:
start.bat
```

The `start.sh` script will:
1. Create a virtual environment if it doesn't exist
2. Install dependencies if needed
3. Start the API server with the correct configuration

### Docker Setup
```bash
# Run both frontend and backend with Docker
docker-compose up -d

# Build and run only the API
docker-compose up -d api
```

### API Documentation
Once the API is running, access the auto-generated OpenAPI documentation at:
- http://localhost:8000/docs

### Building for Production
```bash
# Frontend build
pnpm build
pnpm start

# Docker build
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d
```

## Future Enhancements

1. Extend the Python API to perform actual voice processing
2. Add authentication for API calls
3. Improve error handling for API calls
4. Add ability to preview processed audio
5. Enable persisting state between sessions
6. Add unit and integration tests
7. Implement user management and voice sample storage
8. Deploy to cloud infrastructure with proper CI/CD