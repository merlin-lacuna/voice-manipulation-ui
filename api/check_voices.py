#!/usr/bin/env python3
"""
Utility script to check if the voice files are available
"""

import os
import sys

# Voice files that should be available
EXPECTED_VOICE_FILES = [
    "../voices/everyday_cheerful_middle-aged_2.wav",  # Path relative to /api directory
    "../voices/everyday_irritated_female_5.wav",
    "../voices/everyday_nervous_non-binary_3.wav"
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