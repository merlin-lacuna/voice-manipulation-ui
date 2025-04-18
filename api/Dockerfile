FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Make sure the voices directory is available
RUN mkdir -p /app/voices

COPY . .

# Create a volume mount point for the voices directory
VOLUME /app/voices

# Make the check_voices script executable
RUN chmod +x /app/check_voices.py

EXPOSE 8000

# Create a startup script
RUN echo '#!/bin/bash\n\
echo "Starting voice manipulation API..."\n\
echo "Checking for voice files..."\n\
python /app/check_voices.py\n\
echo "Starting FastAPI server..."\n\
exec /opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload\n\
' > /app/start.sh && chmod +x /app/start.sh

# Use the startup script
CMD ["/app/start.sh"]