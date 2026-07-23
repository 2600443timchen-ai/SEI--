@echo off
echo =========================================
echo       Start SEI Project
echo =========================================

IF EXIST ".venv\Scripts\activate.bat" GOTO START_SERVERS

echo [System] Virtual environment not found. Creating...
python -m venv .venv
echo [System] Installing requirements...
call .\.venv\Scripts\activate.bat
pip install -r backend\requirements.txt

:START_SERVERS
echo [1/2] Starting Frontend Server (Port 5500)...
start "Frontend Server" cmd /k "python backend/serve.py 5500"

echo [2/2] Starting FastAPI Backend Proxy (Port 8000)...
start "Backend Proxy" cmd /k "call .\.venv\Scripts\activate.bat && cd backend && python -m uvicorn main:app --reload"

echo Opening browser...
timeout /t 2 /nobreak > nul
start http://localhost:5500/index.html

echo =========================================
echo Done! Close the black windows to stop the servers.
echo =========================================
pause
