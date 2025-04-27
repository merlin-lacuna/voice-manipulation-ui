#!/usr/bin/env python3
"""
Spectrogram Generator Script

This script creates spectrogram images from audio files in the ./api/voices directory,
saving them with the same name but with a .png extension in the ./api/spectrograms directory.
"""

import os
import glob
import matplotlib.pyplot as plt
import librosa
import librosa.display
import numpy as np
from pathlib import Path
import soundfile as sf

# Configuration
VOICES_DIR = "./voices"  # Source directory containing audio files
SPECTROGRAMS_DIR = "./spectrograms"  # Target directory for spectrograms
# Ensure the spectrograms directory exists
os.makedirs(SPECTROGRAMS_DIR, exist_ok=True)

def create_spectrogram(audio_file, output_file):
    """
    Creates a spectrogram from an audio file and saves it as a PNG image.
    
    Args:
        audio_file (str): Path to the audio file
        output_file (str): Path where the spectrogram image will be saved
    """
    try:
        print(f"Processing {audio_file}...")
        
        # Load the audio file
        y, sr = librosa.load(audio_file, sr=None)
        
        # Create a figure with a specific size
        plt.figure(figsize=(10, 6))
        
        # Generate a mel-spectrogram
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        
        # Convert to dB scale
        S_dB = librosa.power_to_db(S, ref=np.max)
        
        # Plot the spectrogram
        librosa.display.specshow(S_dB, sr=sr, x_axis='time', y_axis='mel')
        
        # Remove axes and frame for a cleaner image
        plt.axis('off')
        plt.tight_layout()
        
        # Save the figure
        plt.savefig(output_file, bbox_inches='tight', pad_inches=0, dpi=150, transparent=False)
        plt.close()
        
        print(f"Created spectrogram: {output_file}")
        return True
    except Exception as e:
        print(f"Error creating spectrogram for {audio_file}: {e}")
        return False

def process_audio_files():
    """
    Process all audio files in the voices directory and create spectrograms
    """
    # Get all mp3 files in the voices directory
    audio_files = glob.glob(os.path.join(VOICES_DIR, "*.mp3"))
    
    # Filter out Zone.Identifier files
    audio_files = [f for f in audio_files if not f.endswith(".mp3:Zone.Identifier")]
    
    print(f"Found {len(audio_files)} audio files to process")
    
    success_count = 0
    error_count = 0
    
    for audio_file in audio_files:
        # Get just the filename without path and extension
        base_name = os.path.basename(audio_file)
        name_without_ext = os.path.splitext(base_name)[0]
        
        # Create the output filename
        output_file = os.path.join(SPECTROGRAMS_DIR, f"{name_without_ext}.png")
        
        # Generate the spectrogram
        if create_spectrogram(audio_file, output_file):
            success_count += 1
        else:
            error_count += 1
    
    print(f"Finished processing {len(audio_files)} audio files.")
    print(f"Successfully created {success_count} spectrograms.")
    print(f"Failed to create {error_count} spectrograms.")

if __name__ == "__main__":
    print("Starting spectrogram generation...")
    process_audio_files()
    print("Done!")