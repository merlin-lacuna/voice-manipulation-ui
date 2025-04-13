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

### Current Implementation

The application currently uses a mock API implementation that simulates backend processing:

```typescript
// Mock API call in page.tsx
const callAPI = async (cardName: string, zoneName: string, laneName: string) => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Different responses based on zone
  switch (zoneName) {
    case "Zone 1":
      return `${cardName} has been initialized in ${laneName} of ${zoneName}. Processing has begun.`
    // Additional cases for other zones...
  }
}
```

### API Trigger Points

API calls are triggered when:
1. A card is dragged from one zone to another
2. The move is determined to be valid (adjacent zones only)

The API is NOT called when:
- A card is moved within the same zone
- A card is moved back to the holding zone
- The drag operation is invalid

### Expected Backend Implementation

To implement the actual backend, you'll need to:

1. Create Python API endpoints that accept the following parameters:
   - `cardName`: The voice sample identifier
   - `zoneName`: The destination processing zone
   - `laneName`: The specific lane within the zone

2. Each zone represents a different processing stage:
   - **Zone 1**: Initialization/preparation
   - **Zone 2**: First-stage processing
   - **Zone 3**: Mid-stage processing
   - **Zone 4**: Advanced processing
   - **Zone 5**: Finalization

### API Integration Points

In `page.tsx`, locate the following code that needs to be replaced:

```typescript
// Line ~185
callAPI(card.content, destZoneId, `Lane ${destLaneId}`).then((message) => {
  setApiMessage(message)
  // Clear processing state after API call completes
  setProcessingCard({ id: null, zone: null, lane: null })
})
```

Replace this with your actual API endpoint calls, maintaining the same interface. The UI will:
1. Show a loading spinner while the API call is in progress
2. Display the returned message from the API
3. Update the UI when processing is complete

## UI State Management

During API operations, the UI provides visual feedback:
- Cards show a loading spinner overlay
- The destination zone briefly glows
- Success/failure messages from the API are displayed

## Development

### Prerequisites
- Node.js 18+
- pnpm (preferred) or npm

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Building for Production
```bash
pnpm build
pnpm start
```

## Future Enhancements

1. Implement real backend API endpoints in Python
2. Add authentication for API calls
3. Implement error handling for failed API calls
4. Add ability to preview processed audio
5. Enable persisting state between sessions