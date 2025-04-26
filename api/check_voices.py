#!/usr/bin/env python3
"""
Utility script to check if the voice files are available
"""

import os
import sys

# Voice files that should be available
EXPECTED_VOICE_FILES = [
    "./voices/voice_1_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3",  # Path relative to /api directory
    "./voices/voice_2_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3",
    "./voices/voice_3_Z1_L0_Z2_L0_Z3_L0_Z4_L0.mp3"
]

def check_voices():
    """Check if the voice files are available"""
    print("Checking voice files...")
    
    if not os.path.exists("./voices"):
        print("ERROR: voices directory does not exist!")
        return False
        
    print(f"voices directory exists. Contents: {os.listdir('./voices')}")
    
    all_exist = True
    for voice_path in EXPECTED_VOICE_FILES:
        if os.path.exists(voice_path):
            print(f"✓ Found: {voice_path}")
        else:
            print(f"✗ Missing: {voice_path}")
            all_exist = False
            
    if all_exist:
        print("All voice files found!")
    else:
        print("Some voice files are missing!")
        
    return all_exist

if __name__ == "__main__":
    success = check_voices()
    sys.exit(0 if success else 1)