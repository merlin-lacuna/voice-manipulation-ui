#!/bin/bash
# Start the FastAPI server with uvicorn using virtual environment

# Navigate to the script directory
cd "$(dirname "$0")"

# Check if virtual environment exists, create if it doesn't
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing dependencies..."
    pip install -r requirements.txt
else
    # Activate virtual environment
    source venv/bin/activate
fi

echo "Starting Voice Manipulation API..."
# Run server using the virtual environment's Python
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload