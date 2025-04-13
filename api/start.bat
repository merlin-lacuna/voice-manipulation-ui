@echo off
REM Start the FastAPI server with uvicorn using virtual environment

REM Navigate to the script directory
cd /d "%~dp0"

REM Check if virtual environment exists, create if it doesn't
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    
    REM Activate virtual environment
    call venv\Scripts\activate.bat
    
    REM Install dependencies
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    REM Activate virtual environment
    call venv\Scripts\activate.bat
)

echo Starting Voice Manipulation API...
REM Run server using the virtual environment's Python
venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload