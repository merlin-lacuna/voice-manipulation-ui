#!/bin/bash

# This script simulates the Render.com environment locally
# It builds and runs the combined Docker image on port 10000

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed or not in PATH"
    exit 1
fi

# Check if port 10000 is already in use
if lsof -Pi :10000 -sTCP:LISTEN -t &> /dev/null ; then
    echo "WARNING: Port 10000 is already in use. Stopping any containers using it..."
    # Stop any containers using port 10000
    docker stop $(docker ps -q --filter publish=10000) 2>/dev/null || true
    sleep 2
fi

# Clean up any previous containers with the same name
docker rm -f voice-render 2>/dev/null || true

echo "Building combined Docker image for Render.com deployment..."
docker build -t voice-manipulation-render -f Dockerfile.combined .

if [ $? -ne 0 ]; then
    echo "Docker build failed. Please check the errors above."
    exit 1
fi

echo "Starting container on port 10000..."
docker run --name voice-render -p 0.0.0.0:10000:10000 \
  -v "$(pwd)/api/voices:/app/api/voices" \
  -v "$(pwd)/api/stats:/app/api/stats" \
  -v "$(pwd)/api/spectrograms:/app/api/spectrograms" \
  -e PORT=10000 \
  -e NEXT_PUBLIC_API_URL="" \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=8000 \
  voice-manipulation-render

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "Container is running at http://localhost:10000"
else
    echo "Failed to start container. Please check the errors above."
fi