@echo off
REM Start both the API and frontend

REM Start the API in a separate window
echo Starting API server...
start cmd /k "cd /d "%~dp0\api" && call start.bat"

REM Wait a moment for the API to initialize
timeout /t 5 /nobreak > nul

REM Start the frontend
echo Starting frontend server...
cd /d "%~dp0"
where pnpm > nul 2>&1
if %ERRORLEVEL% == 0 (
    REM Clear Next.js cache first
    echo Clearing Next.js cache...
    pnpm clean
    pnpm dev
) else (
    REM Clear Next.js cache first
    echo Clearing Next.js cache...
    npm run clean
    npm run dev
)