from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
from typing import Optional

app = FastAPI(title="Voice Manipulation API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VoiceProcessRequest(BaseModel):
    cardName: str
    zoneName: str
    laneName: str

class VoiceProcessResponse(BaseModel):
    message: str
    status: str
    processingTime: float

# Mapping operations to processing operations
ZONE_OPERATIONS = {
    "Zone 1": "initialization",
    "Zone 2": "feature_extraction",
    "Zone 3": "transformation",
    "Zone 4": "enhancement",
    "Zone 5": "finalization"
}

@app.get("/")
async def read_root():
    return {"status": "API is running", "version": "1.0.0"}

@app.post("/api/process", response_model=VoiceProcessResponse)
async def process_voice(request: VoiceProcessRequest):
    # Log the incoming request
    print(f"Processing request: {request}")
    
    # Simulate processing delay
    start_time = time.time()
    time.sleep(2)  # Simulating processing time
    
    # Determine the operation type based on zone
    operation = ZONE_OPERATIONS.get(request.zoneName, "unknown")
    
    # Generate response message based on zone (matching the original client-side messages)
    if request.zoneName == "Zone 1":
        message = f"{request.cardName} has been initialized in {request.laneName} of {request.zoneName}. Processing has begun."
    elif request.zoneName == "Zone 2":
        message = f"{request.cardName} is now in the second phase. It was moved to {request.laneName} of {request.zoneName}."
    elif request.zoneName == "Zone 3":
        message = f"Processing continues for {request.cardName}. Current position: {request.laneName} in {request.zoneName}."
    elif request.zoneName == "Zone 4":
        message = f"Someone just moved a card. It was {request.cardName} and they dropped it into {request.zoneName}, and more specifically {request.laneName}."
    elif request.zoneName == "Zone 5":
        message = f"Final stage reached! {request.cardName} has completed processing in {request.laneName} of {request.zoneName}."
    else:
        message = f"{request.cardName} was moved to {request.laneName} of {request.zoneName}."
    
    # Calculate processing time
    processing_time = time.time() - start_time
    
    return {
        "message": message,
        "status": "success",
        "processingTime": processing_time,
    }
    
@app.get("/api/operations")
async def get_operations():
    """Return a list of operations the API supports"""
    return {
        "operations": [
            {
                "id": op_id,
                "name": op_name,
                "zone": zone
            } 
            for zone, op_id in ZONE_OPERATIONS.items()
            for op_name in [op_id.replace("_", " ").title()]
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)