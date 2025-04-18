from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import time
import os
import sys
import random
import tempfile
from typing import Optional, Dict, Any, List
import shutil
from pathlib import Path
import librosa
import soundfile as sf
import numpy as np

app = FastAPI(title="Voice Manipulation API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a temporary directory for processed audio files
TEMP_DIR = tempfile.mkdtemp()
print(f"Created temporary directory for audio files: {TEMP_DIR}")

# Voice files mapping with correct paths relative to project root
VOICE_FILES = {
    "Voice 1": "../voices/everyday_cheerful_middle-aged_2.wav",
    "Voice 2": "../voices/everyday_irritated_female_5.wav",
    "Voice 3": "../voices/everyday_nervous_non-binary_3.wav"
}

# Keep track of processed files for each voice
processed_files = {}

class VoiceProcessRequest(BaseModel):
    cardName: str
    zoneName: str
    laneName: str

class MetadataItem(BaseModel):
    charisma: int
    confidence: int
    pitch: int
    energy: int
    spectrogram: str = "./public/placeholder.png"

class VoiceProcessResponse(BaseModel):
    message: str
    status: str
    processingTime: float
    audioFile: Optional[str] = None
    metadata: Optional[MetadataItem] = None

# Mapping operations to processing operations
ZONE_OPERATIONS = {
    "Zone 1": "initialization",
    "Zone 2": "feature_extraction",
    "Zone 3": "transformation"
}

@app.get("/")
async def read_root():
    return {"status": "API is running", "version": "1.0.0"}

@app.get("/debug")
async def debug_info():
    """Return debug information about the API environment"""
    # Check both relative paths from /api and project root
    project_voices_dir = "../voices"
    
    info = {
        "voices_directory_exists": os.path.exists(project_voices_dir),
        "voices_directory_contents": os.listdir(project_voices_dir) if os.path.exists(project_voices_dir) else [],
        "temp_directory": TEMP_DIR,
        "temp_directory_contents": os.listdir(TEMP_DIR) if os.path.exists(TEMP_DIR) else [],
        "voice_files_config": VOICE_FILES,
        "files_exist": {
            name: os.path.exists(path) for name, path in VOICE_FILES.items()
        },
        "working_directory": os.getcwd(),
        "python_path": sys.path,
    }
    return info

@app.get("/audio/{voice_id}")
async def get_audio(voice_id: str):
    """Return an audio file for a voice in the holding area"""
    print(f"Getting audio for voice_id: {voice_id}")
    voice_path = VOICE_FILES.get(voice_id)
    
    if not voice_path or not os.path.exists(voice_path):
        print(f"ERROR: Voice file not found: {voice_path}")
        # Check if files exist in the voices directory
        if os.path.exists("./voices"):
            print(f"Contents of voices directory: {os.listdir('./voices')}")
        else:
            print("Voices directory does not exist!")
        
        raise HTTPException(status_code=404, detail=f"Voice file not found: {voice_path}")
    
    print(f"Returning voice file: {voice_path}")
    return FileResponse(voice_path, media_type="audio/wav")

@app.get("/test-audio")
async def test_audio():
    """Test if audio files are available"""
    result = {}
    
    # Check if voices directory exists (relative to /api)
    voices_dir = "../voices"
    result["voices_dir_exists"] = os.path.exists(voices_dir)
    
    if result["voices_dir_exists"]:
        result["voices_dir_contents"] = os.listdir(voices_dir)
    else:
        result["voices_dir_contents"] = []
    
    # Check all voice files
    result["voice_files"] = {}
    for name, path in VOICE_FILES.items():
        if os.path.exists(path):
            file_size = os.path.getsize(path)
            result["voice_files"][name] = {
                "exists": True,
                "path": path,
                "size_bytes": file_size
            }
        else:
            result["voice_files"][name] = {
                "exists": False,
                "path": path
            }
    
    return result

def process_audio(voice_name: str, zone_name: str, lane_name: str) -> str:
    """Process audio file based on zone and lane"""
    # Get original voice file path
    original_file = VOICE_FILES.get(voice_name)
    if not original_file or not os.path.exists(original_file):
        raise Exception(f"Voice file not found: {original_file}")
    
    # Load the audio file
    if zone_name == "Zone 1":
        # For Zone 1, we use the original file
        input_file = original_file
    else:
        # For subsequent zones, use the processed file from the previous zone
        prev_zone = f"Zone {int(zone_name.split(' ')[1]) - 1}"
        input_file = processed_files.get(f"{voice_name}_{prev_zone}_{lane_name}")
        if not input_file or not os.path.exists(input_file):
            # Fallback to original if processed file not found
            input_file = original_file
    
    # Load the audio file
    y, sr = librosa.load(input_file, sr=None)
    
    # Process based on lane
    lane_number = int(lane_name.split(' ')[1])
    
    if lane_number == 1:
        # Lower pitch by 20%
        y_processed = librosa.effects.pitch_shift(y, sr=sr, n_steps=-2.4)  # About 20% lower
    elif lane_number == 2:
        # Raise pitch by 20%
        y_processed = librosa.effects.pitch_shift(y, sr=sr, n_steps=2.4)  # About 20% higher
    elif lane_number == 3:
        # Tremolo effect - modulate pitch up and down
        # Simulate tremolo by creating a simple oscillation
        time_array = np.arange(0, len(y)) / sr
        tremolo_rate = 4  # 4 Hz for 250ms cycle
        depth = 0.5
        tremolo = 1.0 + depth * np.sin(2 * np.pi * tremolo_rate * time_array)
        y_processed = y * tremolo
    else:
        # No processing for other lanes
        y_processed = y
    
    # Save the processed audio
    output_path = os.path.join(TEMP_DIR, f"{voice_name}_{zone_name}_{lane_name}.wav")
    sf.write(output_path, y_processed, sr)
    
    # Store the path for future reference
    processed_files[f"{voice_name}_{zone_name}_{lane_name}"] = output_path
    
    return output_path

def generate_metadata(voice_name: str, zone_name: str, lane_name: str) -> MetadataItem:
    """Generate placeholder metadata for the voice"""
    # Vary the metrics slightly for each voice
    voice_index = int(voice_name.split(' ')[1])
    lane_index = int(lane_name.split(' ')[1])
    zone_index = int(zone_name.split(' ')[1])
    
    # Base values with slight variations
    base = {
        "Voice 1": {"charisma": 50, "confidence": 30, "pitch": 50, "energy": 35},
        "Voice 2": {"charisma": 45, "confidence": 35, "pitch": 55, "energy": 30},
        "Voice 3": {"charisma": 55, "confidence": 25, "pitch": 45, "energy": 40}
    }
    
    # Apply some variation based on zone and lane
    variation = (zone_index * 2) + (lane_index * 3)
    metrics = base.get(voice_name, base["Voice 1"])
    
    return MetadataItem(
        charisma=metrics["charisma"] + random.randint(-5, 5) + variation,
        confidence=metrics["confidence"] + random.randint(-5, 5) + variation,
        pitch=metrics["pitch"] + random.randint(-5, 5) + variation,
        energy=metrics["energy"] + random.randint(-5, 5) + variation,
        spectrogram="./placeholder_spectrogram.png"  # Use placeholder from instructions
    )

@app.post("/api/process", response_model=VoiceProcessResponse)
async def process_voice(request: VoiceProcessRequest):
    # Log the incoming request
    print(f"Processing request: {request}")
    
    # Simulate processing delay
    start_time = time.time()
    
    result = {
        "message": "",
        "status": "success",
        "processingTime": 0,
        "audioFile": None,
        "metadata": None
    }
    
    try:
        if request.zoneName == "holding":
            # Return original audio file for holding zone
            voice_path = VOICE_FILES.get(request.cardName)
            
            if voice_path:
                print(f"Found voice path for {request.cardName}: {voice_path}")
                if os.path.exists(voice_path):
                    print(f"File exists at {voice_path}")
                    # Direct path to the file for simplicity
                    result["audioFile"] = f"/audio/{request.cardName}"
                    result["message"] = f"Playing original {request.cardName}"
                else:
                    print(f"File does not exist at {voice_path}")
                    # List all files in the voices directory
                    if os.path.exists("./voices"):
                        voices_files = os.listdir("./voices")
                        print(f"Files in ./voices: {voices_files}")
                    result["status"] = "error"
                    result["message"] = f"Voice file {voice_path} not found"
            else:
                print(f"No voice path found for {request.cardName}. Available voices: {list(VOICE_FILES.keys())}")
                result["status"] = "error" 
                result["message"] = f"Voice not configured: {request.cardName}"
        else:
            # Process audio for zones
            try:
                processed_path = process_audio(request.cardName, request.zoneName, request.laneName)
                
                # Set relative path for client to access
                file_name = os.path.basename(processed_path)
                result["audioFile"] = f"/processed/{file_name}"
                
                # Generate placeholder metadata
                result["metadata"] = generate_metadata(request.cardName, request.zoneName, request.laneName)
                
                # Generate message based on zone
                if request.zoneName == "Zone 1":
                    result["message"] = f"{request.cardName} has been processed in {request.laneName} of {request.zoneName}."
                elif request.zoneName == "Zone 2":
                    result["message"] = f"{request.cardName} is now in the second phase in {request.laneName} of {request.zoneName}."
                elif request.zoneName == "Zone 3":
                    result["message"] = f"Final processing of {request.cardName} in {request.laneName} of {request.zoneName}."
            except Exception as e:
                print(f"Error processing audio: {e}")
                raise
    except Exception as e:
        print(f"ERROR processing request: {e}")
        result["status"] = "error"
        result["message"] = f"Error: {str(e)}"
    
    # Add some additional processing delay for realism
    time.sleep(1)  
    
    # Calculate processing time
    result["processingTime"] = time.time() - start_time
    
    return result

@app.get("/processed/{file_name}")
async def get_processed_file(file_name: str):
    """Return a processed audio file"""
    print(f"Request for processed file: {file_name}")
    file_path = os.path.join(TEMP_DIR, file_name)
    
    if not os.path.exists(file_path):
        print(f"ERROR: Processed file not found: {file_path}")
        print(f"Contents of temp directory: {os.listdir(TEMP_DIR)}")
        raise HTTPException(status_code=404, detail=f"Processed file not found: {file_path}")
    
    print(f"Returning processed file: {file_path}")
    return FileResponse(file_path, media_type="audio/wav")
    
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