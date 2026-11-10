@echo off
title Smart Attendance System - Startup

echo ============================================
echo   SMART ATTENDANCE SYSTEM - STARTING UP
echo ============================================
echo.

REM Check MongoDB
echo [1/4] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo   [OK] MongoDB service found
    net start MongoDB >nul 2>&1
) else (
    echo   [WARN] MongoDB service not found. Trying to start mongod directly...
    start "MongoDB" /min mongod --dbpath "C:\data\db" --port 27017
    timeout /t 3 /nobreak >nul
)

REM Start Backend
echo [2/4] Starting Node.js Backend (port 5000)...
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo   Installing backend dependencies...
    call npm install
)
start "Smart Attendance Backend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

REM Start Python CV Service
echo [3/4] Starting Python CV Service (port 8001)...
cd /d "%~dp0python-cv"
if not exist ".venv" (
    echo   Creating Python virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo   Installing Python dependencies...
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)
start "Smart Attendance CV" cmd /k ".venv\Scripts\activate.bat && python main.py"
timeout /t 5 /nobreak >nul

REM Start Frontend
echo [4/4] Starting React Frontend (port 5173)...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo   Installing frontend dependencies...
    call npm install
)
start "Smart Attendance Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   ALL SERVICES STARTING...
echo.
echo   Frontend:   http://localhost:5173
echo   Backend:    http://localhost:5000
echo   CV Service: http://localhost:8001
echo   MongoDB:    mongodb://localhost:27017
echo.
echo   Default Login:
echo   Email:    admin@school.edu
echo   Password: Admin@123
echo ============================================
echo.

timeout /t 5 /nobreak >nul
start http://localhost:5173

echo Press any key to exit this launcher...
pause >nul

