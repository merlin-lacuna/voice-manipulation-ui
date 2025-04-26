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
import json

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

# Directory containing the pregenerated voice files
VOICE_FILES_DIR = "./voices"

# Directory containing the stats JSON files
STATS_DIR = "./stats"

# Default voice files for holding zone (initial state)
VOICE_FILES = {
    "Voice 1": f"{VOICE_FILES_DIR}/voice_1_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3",
    "Voice 2": f"{VOICE_FILES_DIR}/voice_2_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3",
    "Voice 3": f"{VOICE_FILES_DIR}/voice_3_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3"
}

# Keep track of processed files for each voice
processed_files = {}

class VoiceProcessRequest(BaseModel):
    cardName: str
    zoneName: str
    laneName: str
    previousZone: Optional[str] = None

class EmotionData(BaseModel):
    name: str
    score: float

class MetadataItem(BaseModel):
    language: Optional[List[EmotionData]] = None
    prosody: Optional[List[EmotionData]] = None
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
    "Zone 3": "transformation",
    "Zone 4": "finalization"
}

# Keep track of voice traversal history for each voice
voice_traversal = {
    "Voice 1": {"Zone 1": None, "Zone 2": None, "Zone 3": None, "Zone 4": None},
    "Voice 2": {"Zone 1": None, "Zone 2": None, "Zone 3": None, "Zone 4": None},
    "Voice 3": {"Zone 1": None, "Zone 2": None, "Zone 3": None, "Zone 4": None}
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

def reset_traversal_history(voice_name: str, zone_name: str) -> None:
    """Reset the traversal history for a voice when moving backwards"""
    # Get the zone number to reset from
    zone_num = int(zone_name.split(" ")[1])
    
    # Reset this zone and all higher zones
    for z_num in range(zone_num, 5):  # Reset from current zone to Zone 4
        z_name = f"Zone {z_num}"
        voice_traversal[voice_name][z_name] = None
    
    print(f"Reset traversal history for {voice_name} from zone {zone_name}: {voice_traversal[voice_name]}")

def get_voice_filename(voice_name: str, zone_name: str, lane_name: str, moving_backwards: bool = False) -> str:
    """Generate the correct filename based on traversal history"""
    # Extract voice number (e.g., "Voice 1" -> "1")
    voice_number = voice_name.split(" ")[1]
    
    # Extract lane number (e.g., "Lane 3" -> "3")
    lane_number = lane_name.split(" ")[1]
    
    # Convert to numeric for array indexing
    current_zone_num = int(zone_name.split(" ")[1])
    
    # If moving backwards, reset history for this zone and higher zones
    if moving_backwards:
        reset_traversal_history(voice_name, zone_name)
    
    # Update traversal history for this voice at the current zone
    voice_traversal[voice_name][zone_name] = lane_number
    
    # Build the filename based on traversal history
    filename_parts = [f"voice_{voice_number}"]
    
    # Add zone/lane combinations in order
    for z_num in range(1, 5):  # Zones 1-4
        z_name = f"Zone {z_num}"
        
        # If the voice has passed through this zone, use the recorded lane
        if z_num <= current_zone_num:
            # Use the recorded lane for zones we've passed through
            lane_val = voice_traversal[voice_name][z_name] if voice_traversal[voice_name][z_name] else "0"
        else:
            # Use "0" for zones we haven't reached yet
            lane_val = "0"
            
        filename_parts.append(f"Z{z_num}")
        filename_parts.append(f"L{lane_val}")
    
    # Construct the complete filename
    filename = "_".join(filename_parts) + ".mp3"
    return filename

def process_audio(voice_name: str, zone_name: str, lane_name: str, prev_zone_name: str = None) -> str:
    """Get the appropriate audio file based on voice traversal history"""
    # Determine if we're moving backwards
    moving_backwards = False
    if prev_zone_name and zone_name != "holding":
        prev_zone_num = int(prev_zone_name.split(" ")[1]) if prev_zone_name != "holding" else 0
        current_zone_num = int(zone_name.split(" ")[1])
        moving_backwards = current_zone_num < prev_zone_num
    
    # Generate the filename based on traversal history
    filename = get_voice_filename(voice_name, zone_name, lane_name, moving_backwards)
    
    # Full path to the audio file
    file_path = os.path.join(VOICE_FILES_DIR, filename)
    
    # Verify file exists
    if not os.path.exists(file_path):
        print(f"Warning: Expected file not found: {file_path}")
        # Use fallback file if the specific one doesn't exist
        voice_number = voice_name.split(" ")[1]
        fallback_file = os.path.join(VOICE_FILES_DIR, f"voice_{voice_number}_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3")
        if os.path.exists(fallback_file):
            return fallback_file
        raise Exception(f"Voice file not found: {file_path}")
    
    return file_path

def generate_metadata(voice_name: str, zone_name: str, lane_name: str) -> MetadataItem:
    """Load metadata from JSON files in the stats directory"""
    # Extract voice number, zone number, and lane number
    voice_number = voice_name.split(" ")[1]
    
    # Use same filename pattern as audio files but with .json extension
    filename_parts = []
    
    # Check traversal history to get the correct file
    for voice, zones in voice_traversal.items():
        if voice == voice_name:
            # Use "voice1" format as seen in existing files (no underscore)
            filename_parts = [f"voice{voice_number}"]
            
            # Add zone and lane info from traversal history
            for z in range(1, 5):  # Zones 1-4
                z_name = f"Zone {z}"
                # For zones we've passed through, use recorded lane
                if z_name in zones and zones[z_name] is not None:
                    lane_val = zones[z_name]
                else:
                    lane_val = "0"
                
                filename_parts.append(f"Z{z}")
                filename_parts.append(f"L{lane_val}")
            
            break
    
    # Add .json extension (without _stats suffix)
    stats_filename = "_".join(filename_parts) + ".json"
    stats_path = os.path.join(STATS_DIR, stats_filename)
    
    print(f"Looking for stats file: {stats_path}")
    
    # Default response with placeholder data
    metadata = MetadataItem(
        language=None,
        prosody=None,
        spectrogram="./placeholder_spectrogram.png"
    )
    
    # Try to load the stats file
    try:
        if os.path.exists(stats_path):
            with open(stats_path, 'r') as f:
                stats_data = json.load(f)
                
            # Check if the file has the expected structure
            if "top_emotions" in stats_data:
                # Convert language data
                if "language" in stats_data["top_emotions"]:
                    language_data = [
                        EmotionData(name=item["name"], score=item["score"])
                        for item in stats_data["top_emotions"]["language"]
                    ]
                    metadata.language = language_data
                
                # Convert prosody data
                if "prosody" in stats_data["top_emotions"]:
                    prosody_data = [
                        EmotionData(name=item["name"], score=item["score"])
                        for item in stats_data["top_emotions"]["prosody"]
                    ]
                    metadata.prosody = prosody_data
        else:
            print(f"Stats file not found: {stats_path}")
            # Try sample file as fallback
            sample_path = os.path.join(STATS_DIR, "sample_voice_analysis.json")
            if os.path.exists(sample_path):
                print(f"Using sample stats file: {sample_path}")
                with open(sample_path, 'r') as f:
                    stats_data = json.load(f)
                
                # Convert language data
                if "top_emotions" in stats_data and "language" in stats_data["top_emotions"]:
                    language_data = [
                        EmotionData(name=item["name"], score=item["score"])
                        for item in stats_data["top_emotions"]["language"]
                    ]
                    metadata.language = language_data
                
                # Convert prosody data
                if "top_emotions" in stats_data and "prosody" in stats_data["top_emotions"]:
                    prosody_data = [
                        EmotionData(name=item["name"], score=item["score"])
                        for item in stats_data["top_emotions"]["prosody"]
                    ]
                    metadata.prosody = prosody_data
    except Exception as e:
        print(f"Error loading stats file {stats_path}: {e}")
    
    return metadata

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
            # Return default starting audio file for holding zone
            voice_number = request.cardName.split(" ")[1]
            voice_path = VOICE_FILES.get(request.cardName)
            
            if voice_path:
                print(f"Found voice path for {request.cardName}: {voice_path}")
                if os.path.exists(voice_path):
                    print(f"File exists at {voice_path}")
                    # Serve the file directly
                    result["audioFile"] = f"/processed/{os.path.basename(voice_path)}"
                    result["message"] = f"Playing {request.cardName} in holding zone"
                else:
                    print(f"File does not exist at {voice_path}")
                    # List files in the voices directory
                    if os.path.exists(VOICE_FILES_DIR):
                        voices_files = os.listdir(VOICE_FILES_DIR)
                        print(f"Files in {VOICE_FILES_DIR}: {voices_files[:5]}...")
                    result["status"] = "error"
                    result["message"] = f"Voice file {voice_path} not found"
            else:
                print(f"No voice path found for {request.cardName}. Available voices: {list(VOICE_FILES.keys())}")
                result["status"] = "error" 
                result["message"] = f"Voice not configured: {request.cardName}"
        else:
            # Get appropriate audio file based on traversal path
            try:
                # Get the file path based on traversal history
                voice_file_path = process_audio(request.cardName, request.zoneName, request.laneName, request.previousZone)
                
                # Copy the file to temp directory for serving
                file_name = os.path.basename(voice_file_path)
                temp_file_path = os.path.join(TEMP_DIR, file_name)
                shutil.copy2(voice_file_path, temp_file_path)
                
                # Set relative path for client to access
                result["audioFile"] = f"/processed/{file_name}"
                
                # Generate placeholder metadata
                result["metadata"] = generate_metadata(request.cardName, request.zoneName, request.laneName)
                
                # Generate message based on zone
                if request.zoneName == "Zone 1":
                    result["message"] = f"{request.cardName} is now in {request.laneName} of {request.zoneName}."
                elif request.zoneName == "Zone 2":
                    result["message"] = f"{request.cardName} has moved to {request.laneName} of {request.zoneName}."
                elif request.zoneName == "Zone 3":
                    result["message"] = f"{request.cardName} is now in {request.laneName} of {request.zoneName}."
                elif request.zoneName == "Zone 4":
                    result["message"] = f"Final zone reached: {request.cardName} is in {request.laneName} of {request.zoneName}."
                
                # Log the traversal path and filename being used
                print(f"Voice traversal for {request.cardName}: {voice_traversal[request.cardName]}")
                print(f"Using audio file: {file_name}")
                
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
    
    # First try the temp directory
    file_path = os.path.join(TEMP_DIR, file_name)
    
    # If not in temp dir, try the voices directory
    if not os.path.exists(file_path):
        print(f"File not found in temp dir: {file_path}")
        voice_file_path = os.path.join(VOICE_FILES_DIR, file_name)
        
        if os.path.exists(voice_file_path):
            print(f"Found file in voices directory: {voice_file_path}")
            file_path = voice_file_path
        else:
            print(f"ERROR: File not found in any location: {file_name}")
            print(f"Contents of temp directory: {os.listdir(TEMP_DIR)}")
            print(f"Contents of voices directory: {os.listdir(VOICE_FILES_DIR)[:5]}...")
            raise HTTPException(status_code=404, detail=f"File not found: {file_name}")
    
    print(f"Returning file: {file_path}")
    # Determine content type based on file extension
    media_type = "audio/mpeg" if file_path.endswith(".mp3") else "audio/wav"
    return FileResponse(file_path, media_type=media_type)
    
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